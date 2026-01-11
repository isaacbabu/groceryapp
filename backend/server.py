from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    phone_number: Optional[str] = None
    home_address: Optional[str] = None
    is_admin: bool = False
    created_at: datetime

class UserProfileUpdate(BaseModel):
    phone_number: str
    home_address: str

class Item(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    name: str
    rate: float
    image_url: str
    category: str
    created_at: datetime

class ItemCreate(BaseModel):
    name: str
    rate: float
    image_url: str
    category: str

class OrderItem(BaseModel):
    item_id: str
    item_name: str
    rate: float
    quantity: int
    total: float

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str
    user_id: str
    items: List[OrderItem]
    grand_total: float
    status: str
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    user_address: Optional[str] = None
    created_at: datetime

class OrderCreate(BaseModel):
    items: List[OrderItem]
    grand_total: float

# Helper function to get user from cookie or header
async def get_current_user(request: Request, session_token: Optional[str] = Cookie(None)) -> User:
    token = session_token
    if not token:
        auth_header = request.headers.get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

# Auth endpoints
@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get('session_id')
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    try:
        auth_response = requests.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': session_id},
            timeout=10
        )
        auth_response.raise_for_status()
        session_data = auth_response.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get session data: {str(e)}")
    
    session_token = session_data['session_token']
    user_email = session_data['email']
    user_name = session_data['name']
    user_picture = session_data.get('picture')
    
    existing_user = await db.users.find_one({"email": user_email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user['user_id']
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": user_name, "picture": user_picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": user_email,
            "name": user_name,
            "picture": user_picture,
            "phone_number": None,
            "home_address": None,
            "is_admin": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return {"user": User(**user_doc).model_dump(), "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

# User profile endpoints
@api_router.get("/user/profile")
async def get_profile(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    return user

@api_router.put("/user/profile")
async def update_profile(profile: UserProfileUpdate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "phone_number": profile.phone_number,
            "home_address": profile.home_address
        }}
    )
    
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if isinstance(updated_user['created_at'], str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    
    return User(**updated_user)

# Items endpoints
@api_router.get("/items", response_model=List[Item])
async def get_items():
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items

@api_router.post("/admin/items", response_model=Item)
async def create_item(item: ItemCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    item_id = f"item_{uuid.uuid4().hex[:12]}"
    item_doc = {
        "item_id": item_id,
        "name": item.name,
        "rate": item.rate,
        "image_url": item.image_url,
        "category": item.category,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.items.insert_one(item_doc)
    return Item(**item_doc)

@api_router.put("/admin/items/{item_id}", response_model=Item)
async def update_item(item_id: str, item: ItemCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.items.update_one(
        {"item_id": item_id},
        {"$set": {
            "name": item.name,
            "rate": item.rate,
            "image_url": item.image_url,
            "category": item.category
        }}
    )
    
    updated_item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if isinstance(updated_item['created_at'], str):
        updated_item['created_at'] = datetime.fromisoformat(updated_item['created_at'])
    
    return Item(**updated_item)

@api_router.delete("/admin/items/{item_id}")
async def delete_item(item_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.items.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item deleted"}

# Orders endpoints
@api_router.post("/orders", response_model=Order)
async def create_order(order: OrderCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    order_doc = {
        "order_id": order_id,
        "user_id": user.user_id,
        "items": [item.model_dump() for item in order.items],
        "grand_total": order.grand_total,
        "status": "Pending",
        "user_name": user.name,
        "user_email": user.email,
        "user_phone": user.phone_number,
        "user_address": user.home_address,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.orders.insert_one(order_doc)
    return Order(**order_doc)

@api_router.get("/orders", response_model=List[Order])
async def get_user_orders(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    orders = await db.orders.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for order in orders:
        if isinstance(order['created_at'], str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order['user_id'] != user.user_id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.orders.delete_one({"order_id": order_id})
    return {"message": "Order deleted"}

# Admin endpoints
@api_router.get("/admin/orders", response_model=List[Order])
async def get_all_orders(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for order in orders:
        if isinstance(order['created_at'], str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@api_router.patch("/admin/orders/{order_id}/confirm")
async def confirm_order(order_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "Order Confirmed"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    updated_order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if isinstance(updated_order['created_at'], str):
        updated_order['created_at'] = datetime.fromisoformat(updated_order['created_at'])
    
    return Order(**updated_order)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
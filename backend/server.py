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

class CartItem(BaseModel):
    item_id: str
    item_name: str
    rate: float
    quantity: float
    total: float

class Cart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cart_id: str
    user_id: str
    items: List[CartItem]
    updated_at: datetime

class CartUpdate(BaseModel):
    items: List[CartItem]

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

# Cart endpoints
@api_router.get("/cart")
async def get_cart(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    cart = await db.carts.find_one({"user_id": user.user_id}, {"_id": 0})
    if not cart:
        return {"cart_id": None, "user_id": user.user_id, "items": [], "updated_at": None}
    if isinstance(cart.get('updated_at'), str):
        cart['updated_at'] = datetime.fromisoformat(cart['updated_at'])
    return cart

@api_router.put("/cart")
async def update_cart(cart_data: CartUpdate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    existing_cart = await db.carts.find_one({"user_id": user.user_id}, {"_id": 0})
    
    cart_doc = {
        "user_id": user.user_id,
        "items": [item.model_dump() for item in cart_data.items],
        "updated_at": datetime.now(timezone.utc)
    }
    
    if existing_cart:
        await db.carts.update_one(
            {"user_id": user.user_id},
            {"$set": cart_doc}
        )
        cart_doc["cart_id"] = existing_cart["cart_id"]
    else:
        cart_doc["cart_id"] = f"cart_{uuid.uuid4().hex[:12]}"
        await db.carts.insert_one(cart_doc)
    
    return cart_doc

@api_router.delete("/cart")
async def clear_cart(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    await db.carts.delete_one({"user_id": user.user_id})
    return {"message": "Cart cleared"}

# Seed sample items endpoint
@api_router.post("/seed-items")
async def seed_sample_items():
    # Check if items already exist
    existing_count = await db.items.count_documents({})
    if existing_count > 0:
        return {"message": f"Items already exist ({existing_count} items). Skipping seed."}
    
    sample_items = [
        # Vegetables
        {"name": "Fresh Tomatoes", "rate": 40.00, "category": "Vegetables", "image_url": "https://images.unsplash.com/photo-1546470427-227c7369a9b0?w=400"},
        {"name": "Onions", "rate": 35.00, "category": "Vegetables", "image_url": "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400"},
        {"name": "Potatoes", "rate": 30.00, "category": "Vegetables", "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82ber?w=400"},
        {"name": "Carrots", "rate": 45.00, "category": "Vegetables", "image_url": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400"},
        # Fruits
        {"name": "Bananas", "rate": 50.00, "category": "Fruits", "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400"},
        {"name": "Apples", "rate": 180.00, "category": "Fruits", "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400"},
        {"name": "Oranges", "rate": 80.00, "category": "Fruits", "image_url": "https://images.unsplash.com/photo-1547514701-42782101795e?w=400"},
        {"name": "Grapes", "rate": 120.00, "category": "Fruits", "image_url": "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400"},
        # Dairy
        {"name": "Fresh Milk (1L)", "rate": 60.00, "category": "Dairy", "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400"},
        {"name": "Butter (500g)", "rate": 250.00, "category": "Dairy", "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400"},
        {"name": "Cheese Slices", "rate": 150.00, "category": "Dairy", "image_url": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400"},
        {"name": "Yogurt (400g)", "rate": 45.00, "category": "Dairy", "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400"},
        # Beverages
        {"name": "Orange Juice (1L)", "rate": 120.00, "category": "Beverages", "image_url": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400"},
        {"name": "Green Tea (25 bags)", "rate": 180.00, "category": "Beverages", "image_url": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=400"},
        {"name": "Coffee Powder (200g)", "rate": 350.00, "category": "Beverages", "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400"},
        # Snacks
        {"name": "Potato Chips", "rate": 30.00, "category": "Snacks", "image_url": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400"},
        {"name": "Mixed Nuts (250g)", "rate": 280.00, "category": "Snacks", "image_url": "https://images.unsplash.com/photo-1536591375352-6037fd3f5c66?w=400"},
        {"name": "Chocolate Bar", "rate": 50.00, "category": "Snacks", "image_url": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=400"},
        # Essentials
        {"name": "Rice (5kg)", "rate": 350.00, "category": "Essentials", "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400"},
        {"name": "Cooking Oil (1L)", "rate": 180.00, "category": "Essentials", "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400"},
        {"name": "Salt (1kg)", "rate": 25.00, "category": "Essentials", "image_url": "https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400"},
        {"name": "Sugar (1kg)", "rate": 45.00, "category": "Essentials", "image_url": "https://images.unsplash.com/photo-1581268955317-b68b6f23ef26?w=400"},
    ]
    
    for item in sample_items:
        item_doc = {
            "item_id": f"item_{uuid.uuid4().hex[:12]}",
            "name": item["name"],
            "rate": item["rate"],
            "image_url": item["image_url"],
            "category": item["category"],
            "created_at": datetime.now(timezone.utc)
        }
        await db.items.insert_one(item_doc)
    
    return {"message": f"Successfully seeded {len(sample_items)} items"}

# Get categories endpoint
@api_router.get("/categories")
async def get_categories():
    categories = await db.items.distinct("category")
    return categories

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
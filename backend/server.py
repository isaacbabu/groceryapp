from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import html
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import requests
import asyncio
import traceback

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    logger.error("MONGO_URL environment variable is missing!")

client = AsyncIOMotorClient(mongo_url, maxPoolSize=50, minPoolSize=10)
db = client[os.environ.get('DB_NAME', 'groceryapp')]

# Simple in-memory cache with TTL
class SimpleCache:
    def __init__(self):
        self.cache = {}
        self.timestamps = {}
    
    def get(self, key: str, ttl_seconds: int = 300):
        if key in self.cache:
            if datetime.now().timestamp() - self.timestamps[key] < ttl_seconds:
                return self.cache[key]
            else:
                del self.cache[key]
                del self.timestamps[key]
        return None
    
    def set(self, key: str, value):
        self.cache[key] = value
        self.timestamps[key] = datetime.now().timestamp()
    
    def invalidate(self, key: str):
        if key in self.cache:
            del self.cache[key]
            del self.timestamps[key]
    
    def clear(self):
        self.cache.clear()
        self.timestamps.clear()

cache = SimpleCache()

app = FastAPI()
api_router = APIRouter(prefix="/api")
frontend_url = os.getenv("FRONTEND_URL")
custom_domain = os.getenv("CUSTOM_DOMAIN", "https://emmanuelsupermarket.in")

origins = [o for o in [frontend_url, "http://localhost:3000", custom_domain] if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check server logs."}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        err_dict = {
            'type': error.get('type'),
            'loc': error.get('loc'),
            'msg': error.get('msg'),
            'input': str(error.get('input', ''))[:200]
        }
        errors.append(err_dict)
    
    logger.error(f"Validation error on {request.url.path}: {errors}")
    return JSONResponse(
        status_code=422,
        content={"detail": errors, "body": str(exc.body)[:500]}
    )

MAX_STRING_LENGTH = 500
MAX_ADDRESS_LENGTH = 1000
MAX_ITEMS_PER_ORDER = 100
MAX_ITEMS_PER_CART = 100
MAX_QUANTITY = 10000
MAX_RATE = 1000000
MIN_RATE = 0.01
PHONE_REGEX = re.compile(r'^[\d\s\-\+\(\)]{7,20}$')
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

def sanitize_string(value: str, max_length: int = MAX_STRING_LENGTH) -> str:
    if value is None:
        return None
    return html.escape(str(value).strip())[:max_length]

def validate_phone(phone: str) -> bool:
    if not phone:
        return True
    return bool(PHONE_REGEX.match(phone))

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    phone_number: Optional[str] = None
    home_address: Optional[str] = None
    geolocation: Optional[str] = None
    is_admin: bool = False
    created_at: datetime

class UserProfileUpdate(BaseModel):
    phone_number: str = Field(..., min_length=7, max_length=20)
    home_address: str = Field(..., min_length=5, max_length=MAX_ADDRESS_LENGTH)
    geolocation: Optional[str] = None
    
    @field_validator('phone_number')
    @classmethod
    def validate_phone_number(cls, v):
        v = sanitize_string(v, 20)
        if not validate_phone(v):
            raise ValueError('Invalid phone number format')
        return v
    
    @field_validator('home_address')
    @classmethod
    def validate_address(cls, v):
        return sanitize_string(v, MAX_ADDRESS_LENGTH)

class AdminRoleCreate(BaseModel):
    email: str = Field(..., pattern=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

class Item(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    name: str
    rate: float
    image_url: str
    category: str
    created_at: datetime

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    rate: float = Field(..., gt=0, le=MAX_RATE)
    image_url: str = Field(..., min_length=1, max_length=5000000)
    category: str = Field(..., min_length=1, max_length=100)
    
    @field_validator('name', 'category')
    @classmethod
    def sanitize_text(cls, v):
        return sanitize_string(v, 200)
    
    @field_validator('image_url')
    @classmethod
    def validate_image_url(cls, v):
        v = str(v).strip()
        if not (v.startswith('http://') or v.startswith('https://') or v.startswith('data:image/')):
            raise ValueError('Invalid image URL format')
        return v

class OrderItem(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=50)
    item_name: str = Field(..., min_length=1, max_length=200)
    rate: float = Field(..., ge=0, le=MAX_RATE)
    quantity: float = Field(..., gt=0, le=MAX_QUANTITY)
    total: float = Field(..., ge=0)
    
    @field_validator('item_name')
    @classmethod
    def sanitize_item_name(cls, v):
        return sanitize_string(v, 200)
    
    @model_validator(mode='after')
    def validate_total(self):
        expected_total = round(self.rate * self.quantity, 2)
        if abs(self.total - expected_total) > 0.01:
            self.total = expected_total
        return self

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
    items: List[OrderItem] = Field(..., min_length=1, max_length=MAX_ITEMS_PER_ORDER)
    grand_total: float = Field(..., ge=0)
    
    @model_validator(mode='after')
    def validate_grand_total(self):
        expected_total = round(sum(item.total for item in self.items), 2)
        if abs(self.grand_total - expected_total) > 0.01:
            self.grand_total = expected_total
        return self

class CartItem(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=50)
    item_name: str = Field(..., min_length=1, max_length=200)
    rate: float = Field(..., ge=0, le=MAX_RATE)
    quantity: float = Field(..., gt=0, le=MAX_QUANTITY)
    total: float = Field(..., ge=0)
    
    @field_validator('item_name')
    @classmethod
    def sanitize_item_name(cls, v):
        return sanitize_string(v, 200)

class Cart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cart_id: str
    user_id: str
    items: List[CartItem]
    updated_at: datetime

class CartUpdate(BaseModel):
    items: List[CartItem] = Field(..., max_length=MAX_ITEMS_PER_CART)

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

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
SUPER_ADMIN_EMAILS = ["isaac.babu.personal@gmail.com"]

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    id_token_str = body.get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=400, detail="id_token required")

    try:
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10
        )
        user_email = idinfo["email"]
        user_name = idinfo.get("name", "")
        user_picture = idinfo.get("picture", "")
        
    except ValueError as ve:
        logger.error(f"Google Token Verification ValueError: {str(ve)}")
        raise HTTPException(status_code=400, detail=f"Invalid ID token: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication error: {str(e)}")

    try:
        existing_user = await db.users.find_one({"email": user_email}, {"_id": 0})
        if existing_user:
            user_id = existing_user["user_id"]
            is_admin = existing_user.get("is_admin", False) or (user_email in SUPER_ADMIN_EMAILS)
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": user_name, "picture": user_picture, "is_admin": is_admin}}
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            is_admin = user_email in SUPER_ADMIN_EMAILS
            await db.users.insert_one({
                "user_id": user_id,
                "email": user_email,
                "name": user_name,
                "picture": user_picture,
                "phone_number": None,
                "home_address": None,
                "geolocation": None,
                "is_admin": is_admin,
                "created_at": datetime.now(timezone.utc)
            })

        session_token = f"session_{uuid.uuid4().hex}"
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
        if isinstance(user_doc["created_at"], str):
            user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

        return {"user": User(**user_doc).model_dump(), "session_token": session_token}
    except Exception as e:
        logger.error(f"Database error during session creation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during user creation")

@api_router.get("/auth/me")
async def get_me(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        try:
            await db.user_sessions.delete_one({"session_token": session_token})
        except Exception as e:
            pass
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

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
            "home_address": profile.home_address,
            "geolocation": profile.geolocation
        }}
    )
    
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if isinstance(updated_user['created_at'], str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    
    return User(**updated_user)

@api_router.get("/items", response_model=List[Item])
async def get_items(page: int = 1, limit: int = 100):
    if page < 1: page = 1
    if limit < 1: limit = 10
    if limit > 500: limit = 500
    
    cache_key = f"items_page_{page}_limit_{limit}"
    cached_items = cache.get(cache_key, ttl_seconds=300)
    if cached_items is not None:
        return cached_items
    
    skip = (page - 1) * limit
    try:
        items = await db.items.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
        for item in items:
            if isinstance(item['created_at'], str):
                item['created_at'] = datetime.fromisoformat(item['created_at'])
        cache.set(cache_key, items)
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch items")

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
    cache.clear()
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
    
    cache.clear()
    return Item(**updated_item)

@api_router.delete("/admin/items/{item_id}")
async def delete_item(item_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.items.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    cache.clear()
    return {"message": "Item deleted"}

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
    
    response = {
        "cart_id": cart_doc["cart_id"],
        "user_id": cart_doc["user_id"],
        "items": cart_doc["items"],
        "updated_at": cart_doc["updated_at"]
    }
    return response

@api_router.delete("/cart")
async def clear_cart(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    await db.carts.delete_one({"user_id": user.user_id})
    return {"message": "Cart cleared"}

@api_router.post("/seed-items")
async def seed_sample_items():
    try:
        existing_count = await db.items.count_documents({})
        if existing_count > 0:
            return {"message": f"Items already exist ({existing_count} items). Skipping seed."}
        
        sample_items = [
            {"name": "Toor Dal (1kg)", "rate": 150.00, "category": "Pulses", "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400"},
            {"name": "Basmati Rice (5kg)", "rate": 450.00, "category": "Rice", "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400"},
            {"name": "Turmeric Powder (200g)", "rate": 80.00, "category": "Spices", "image_url": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400"},
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
        
        default_categories = ["Pulses", "Rice", "Spices"]
        for cat in default_categories:
            existing = await db.categories.find_one({"name": cat})
            if not existing:
                await db.categories.insert_one({
                    "category_id": f"cat_{uuid.uuid4().hex[:12]}",
                    "name": cat,
                    "is_default": True,
                    "created_at": datetime.now(timezone.utc)
                })
        
        return {"message": f"Successfully seeded {len(sample_items)} items and {len(default_categories)} categories"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to seed items")

@api_router.get("/categories")
async def get_categories():
    cache_key = "categories_list"
    cached_categories = cache.get(cache_key, ttl_seconds=300)
    if cached_categories is not None:
        return cached_categories
    
    try:
        categories_cursor = db.categories.find({}, {"_id": 0, "name": 1}).sort("name", 1)
        categories_list = await categories_cursor.to_list(1000)
        categories = [cat["name"] for cat in categories_list]
        
        if not categories:
            categories = await db.items.distinct("category")
        
        result = ["All"] + sorted(categories)
        cache.set(cache_key, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch categories")

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    
    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v):
        sanitized = sanitize_string(v, 100)
        if not re.match(r'^[\w\s\-&]+$', sanitized):
            raise ValueError('Category name contains invalid characters')
        return sanitized

class Category(BaseModel):
    category_id: str
    name: str
    is_default: bool = False
    created_at: datetime

@api_router.get("/admin/categories")
async def get_admin_categories(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    categories = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return categories

@api_router.post("/admin/categories")
async def create_category(category: CategoryCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    escaped_name = re.escape(category.name)
    existing = await db.categories.find_one({"name": {"$regex": f"^{escaped_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    category_doc = {
        "category_id": f"cat_{uuid.uuid4().hex[:12]}",
        "name": category.name,
        "is_default": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.categories.insert_one(category_doc)
    cache.clear()
    return {"category_id": category_doc["category_id"], "name": category.name, "is_default": False, "created_at": category_doc["created_at"]}

@api_router.delete("/admin/categories/{category_id}")
async def delete_category(category_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    category = await db.categories.find_one({"category_id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if category.get("is_default", False):
        raise HTTPException(status_code=400, detail="Cannot delete default categories")
    
    items_count = await db.items.count_documents({"category": category["name"]})
    if items_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category. {items_count} items are using this category.")
    
    await db.categories.delete_one({"category_id": category_id})
    cache.clear()
    return {"message": "Category deleted successfully"}

# --- ROLES MANAGEMENT ENDPOINTS ---

@api_router.get("/admin/roles")
async def get_admins(request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admins = await db.users.find({"is_admin": True}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(100)
    return admins

@api_router.post("/admin/roles")
async def add_admin(role_data: AdminRoleCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.users.find_one({"email": role_data.email})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found. They must log in to the app at least once before they can be made an admin.")
    
    if target_user.get("is_admin"):
        raise HTTPException(status_code=400, detail="User is already an admin.")
        
    await db.users.update_one({"email": role_data.email}, {"$set": {"is_admin": True}})
    return {"message": "Admin added successfully"}

@api_router.delete("/admin/roles/{user_id}")
async def remove_admin(user_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.users.find_one({"user_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user["email"] in SUPER_ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Cannot revoke permissions from the Super Admin.")
        
    if target_user["user_id"] == user.user_id:
        raise HTTPException(status_code=400, detail="You cannot revoke your own admin permissions.")
        
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_admin": False}})
    return {"message": "Admin revoked successfully"}


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

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, order_update: OrderCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    existing_order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not existing_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if existing_order['user_id'] != user.user_id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "items": [item.model_dump() for item in order_update.items],
        "grand_total": order_update.grand_total,
        "status": "Pending",
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": update_data}
    )
    
    updated_order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if isinstance(updated_order['created_at'], str):
        updated_order['created_at'] = datetime.fromisoformat(updated_order['created_at'])
    return Order(**updated_order)

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

@app.on_event("startup")
async def startup_db_client():
    try:
        await client.admin.command('ping')
        
        await db.items.create_index("item_id", unique=True)
        await db.items.create_index("category")
        await db.items.create_index("name")
        
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", unique=True)
        
        await db.orders.create_index("order_id", unique=True)
        await db.orders.create_index("user_id")
        await db.orders.create_index([("user_id", 1), ("created_at", -1)])
        
        await db.carts.create_index("user_id", unique=True)
        
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        
    except Exception as e:
        logger.error(f"Error during startup or creating indexes: {e}", exc_info=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
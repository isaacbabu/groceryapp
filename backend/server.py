from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, maxPoolSize=50, minPoolSize=10)
db = client[os.environ['DB_NAME']]

# Simple in-memory cache with TTL
class SimpleCache:
    def __init__(self):
        self.cache = {}
        self.timestamps = {}
    
    def get(self, key: str, ttl_seconds: int = 300):
        """Get cached value if it exists and hasn't expired"""
        if key in self.cache:
            # Check if cache is still valid
            if datetime.now().timestamp() - self.timestamps[key] < ttl_seconds:
                return self.cache[key]
            else:
                # Cache expired, remove it
                del self.cache[key]
                del self.timestamps[key]
        return None
    
    def set(self, key: str, value):
        """Set cache value with current timestamp"""
        self.cache[key] = value
        self.timestamps[key] = datetime.now().timestamp()
    
    def invalidate(self, key: str):
        """Invalidate specific cache key"""
        if key in self.cache:
            del self.cache[key]
            del self.timestamps[key]
    
    def clear(self):
        """Clear all cache"""
        self.cache.clear()
        self.timestamps.clear()

# Initialize cache
cache = SimpleCache()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Add validation error handler for detailed logging
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Convert errors to serializable format
    errors = []
    for error in exc.errors():
        err_dict = {
            'type': error.get('type'),
            'loc': error.get('loc'),
            'msg': error.get('msg'),
            'input': str(error.get('input', ''))[:200]
        }
        errors.append(err_dict)
    
    logger.error(f"Validation error: {errors}")
    logger.error(f"Request body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": errors, "body": str(exc.body)[:500]}
    )

# Constants for validation
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
    """Sanitize string input - escape HTML and limit length"""
    if value is None:
        return None
    # Strip whitespace, escape HTML entities, limit length
    sanitized = html.escape(str(value).strip())[:max_length]
    return sanitized

def validate_phone(phone: str) -> bool:
    """Validate phone number format"""
    if not phone:
        return True
    return bool(PHONE_REGEX.match(phone))

# Models with validation
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
    phone_number: str = Field(..., min_length=7, max_length=20)
    home_address: str = Field(..., min_length=5, max_length=MAX_ADDRESS_LENGTH)
    
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
    image_url: str = Field(..., min_length=1, max_length=5000000)  # Allow large base64 images (up to ~3.5MB)
    category: str = Field(..., min_length=1, max_length=100)
    
    @field_validator('name', 'category')
    @classmethod
    def sanitize_text(cls, v):
        return sanitize_string(v, 200)
    
    @field_validator('image_url')
    @classmethod
    def validate_image_url(cls, v):
        v = str(v).strip()
        # Allow data URLs (base64) and http/https URLs
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
            # Auto-correct the total instead of rejecting
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
            # Auto-correct the grand total
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
    
    # Admin emails list
    ADMIN_EMAILS = ["isaac.babu.personal@gmail.com"]
    
    if existing_user:
        user_id = existing_user['user_id']
        # Check if user should be admin
        is_admin = user_email in ADMIN_EMAILS
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": user_name, "picture": user_picture, "is_admin": is_admin}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        is_admin = user_email in ADMIN_EMAILS
        await db.users.insert_one({
            "user_id": user_id,
            "email": user_email,
            "name": user_name,
            "picture": user_picture,
            "phone_number": None,
            "home_address": None,
            "is_admin": is_admin,
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
async def get_items(page: int = 1, limit: int = 100):
    """
    Get items with pagination and caching
    - page: page number (default: 1)
    - limit: items per page (default: 100, max: 500)
    - Cache TTL: 5 minutes
    """
    # Validate pagination parameters
    if page < 1:
        page = 1
    if limit < 1:
        limit = 10
    if limit > 500:
        limit = 500
    
    # Create cache key
    cache_key = f"items_page_{page}_limit_{limit}"
    
    # Check cache first
    cached_items = cache.get(cache_key, ttl_seconds=300)  # 5 minutes TTL
    if cached_items is not None:
        logger.info(f"Cache hit for {cache_key}")
        return cached_items
    
    # Calculate skip value
    skip = (page - 1) * limit
    
    # Fetch items from database
    logger.info(f"Cache miss for {cache_key}, fetching from database")
    items = await db.items.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    
    # Store in cache
    cache.set(cache_key, items)
    
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
    
    # Invalidate items and categories cache
    cache.clear()
    logger.info("Cache cleared after adding new item")
    
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
    
    # Return a clean response without any MongoDB ObjectIds
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

# Seed sample items endpoint
@api_router.post("/seed-items")
async def seed_sample_items():
    # Check if items already exist
    existing_count = await db.items.count_documents({})
    if existing_count > 0:
        return {"message": f"Items already exist ({existing_count} items). Skipping seed."}
    
    sample_items = [
        # Pulses
        {"name": "Toor Dal (1kg)", "rate": 150.00, "category": "Pulses", "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400"},
        {"name": "Moong Dal (1kg)", "rate": 140.00, "category": "Pulses", "image_url": "https://images.unsplash.com/photo-1612257416648-ee7a6c533bc4?w=400"},
        {"name": "Chana Dal (1kg)", "rate": 120.00, "category": "Pulses", "image_url": "https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?w=400"},
        {"name": "Urad Dal (1kg)", "rate": 160.00, "category": "Pulses", "image_url": "https://images.unsplash.com/photo-1558818498-28c1e002674f?w=400"},
        {"name": "Masoor Dal (1kg)", "rate": 130.00, "category": "Pulses", "image_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"},
        # Rice
        {"name": "Basmati Rice (5kg)", "rate": 450.00, "category": "Rice", "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400"},
        {"name": "Brown Rice (2kg)", "rate": 180.00, "category": "Rice", "image_url": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400"},
        {"name": "Sona Masoori Rice (5kg)", "rate": 380.00, "category": "Rice", "image_url": "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400"},
        {"name": "Jeera Rice (1kg)", "rate": 120.00, "category": "Rice", "image_url": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400"},
        # Spices
        {"name": "Turmeric Powder (200g)", "rate": 80.00, "category": "Spices", "image_url": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400"},
        {"name": "Red Chilli Powder (200g)", "rate": 90.00, "category": "Spices", "image_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"},
        {"name": "Coriander Powder (200g)", "rate": 60.00, "category": "Spices", "image_url": "https://images.unsplash.com/photo-1599909533681-74f257a5096d?w=400"},
        {"name": "Cumin Seeds (100g)", "rate": 70.00, "category": "Spices", "image_url": "https://images.unsplash.com/photo-1599909533702-a30f5c7c1b3d?w=400"},
        {"name": "Garam Masala (100g)", "rate": 95.00, "category": "Spices", "image_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400"},
        {"name": "Black Pepper (100g)", "rate": 120.00, "category": "Spices", "image_url": "https://images.unsplash.com/photo-1599909533701-236f4c33a640?w=400"},
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
    
    # Seed default categories
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

# Get categories endpoint
@api_router.get("/categories")
async def get_categories():
    # Get categories from the categories collection (both default and custom)
    categories_cursor = db.categories.find({}, {"_id": 0, "name": 1}).sort("name", 1)
    categories_list = await categories_cursor.to_list(1000)
    categories = [cat["name"] for cat in categories_list]
    
    # If no categories in collection, get from items (fallback)
    if not categories:
        categories = await db.items.distinct("category")
    
    # Always include "All" at the beginning
    return ["All"] + sorted(categories)

# Category model for admin
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    
    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v):
        sanitized = sanitize_string(v, 100)
        # Only allow alphanumeric, spaces, and common punctuation
        if not re.match(r'^[\w\s\-&]+$', sanitized):
            raise ValueError('Category name contains invalid characters')
        return sanitized

class Category(BaseModel):
    category_id: str
    name: str
    is_default: bool = False
    created_at: datetime

# Admin category management endpoints
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
    
    # Check if category already exists (case-insensitive, escape regex special chars)
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
    return {"category_id": category_doc["category_id"], "name": category.name, "is_default": False, "created_at": category_doc["created_at"]}

@api_router.delete("/admin/categories/{category_id}")
async def delete_category(category_id: str, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find the category
    category = await db.categories.find_one({"category_id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Don't allow deletion of default categories
    if category.get("is_default", False):
        raise HTTPException(status_code=400, detail="Cannot delete default categories")
    
    # Check if any items use this category
    items_count = await db.items.count_documents({"category": category["name"]})
    if items_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category. {items_count} items are using this category.")
    
    await db.categories.delete_one({"category_id": category_id})
    return {"message": "Category deleted successfully"}

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

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, order_update: OrderCreate, request: Request, session_token: Optional[str] = Cookie(None)):
    user = await get_current_user(request, session_token)
    
    existing_order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not existing_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if existing_order['user_id'] != user.user_id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update the order with new items and grand total
    update_data = {
        "items": [item.model_dump() for item in order_update.items],
        "grand_total": order_update.grand_total,
        "status": "Pending",  # Reset status to pending when edited
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

@app.on_event("startup")
async def startup_db_client():
    """Create database indexes on startup for better performance"""
    try:
        # Items collection indexes
        await db.items.create_index("item_id", unique=True)
        await db.items.create_index("category")
        await db.items.create_index("name")
        
        # Users collection indexes
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", unique=True)
        
        # Orders collection indexes
        await db.orders.create_index("order_id", unique=True)
        await db.orders.create_index("user_id")
        await db.orders.create_index([("user_id", 1), ("created_at", -1)])
        
        # Cart collection indexes
        await db.cart.create_index("user_id", unique=True)
        
        # Sessions collection indexes
        await db.sessions.create_index("session_token", unique=True)
        await db.sessions.create_index("expires_at", expireAfterSeconds=0)
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
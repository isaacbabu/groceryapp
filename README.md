# Grocery Shopping App

A full-stack grocery shopping application built with React, FastAPI, and MongoDB. Features include product browsing, category filtering, cart management with persistence, and user authentication.

## 🍴 How to Fork This Repository

### Using GitHub Web Interface

1. **Navigate to the Repository**
   - Go to the original repository on GitHub

2. **Click the Fork Button**
   - Click the "Fork" button in the top-right corner of the repository page
   - Select your GitHub account as the destination

3. **Clone Your Forked Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
   cd REPO_NAME
   ```

4. **Add Upstream Remote (Optional but Recommended)**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/REPO_NAME.git
   ```
   This allows you to sync your fork with the original repository:
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

---

## 🛠️ Development Environment Setup

### Prerequisites

Ensure you have the following installed on your system:

- **Node.js** (v18+ recommended)
- **Yarn** package manager (v1.22+)
- **Python** (v3.10+)
- **MongoDB** (local instance or MongoDB Atlas)
- **Git**

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/REPO_NAME.git
cd REPO_NAME
```

### Step 2: Backend Setup

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**
   
   - **Linux/macOS:**
     ```bash
     source venv/bin/activate
     ```
   - **Windows:**
     ```bash
     .\venv\Scripts\activate
     ```

4. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables**
   
   Create a `.env` file in the `backend` directory:
   ```bash
   touch .env
   ```
   
   Add the following environment variables:
   ```env
   MONGO_URL=mongodb://localhost:27017/grocery_app
   JWT_SECRET=your_super_secret_jwt_key_here
   ```
   
   > **Note:** Replace `mongodb://localhost:27017/grocery_app` with your MongoDB connection string if using MongoDB Atlas or a different configuration.

### Step 3: Frontend Setup

1. **Navigate to the frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install Node.js dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the `frontend` directory:
   ```bash
   touch .env
   ```
   
   Add the following environment variables:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8001
   ```

---

## 🚀 Running the Application

### Option 1: Run Backend and Frontend Separately

#### Start the Backend Server

1. Navigate to the backend directory and activate virtual environment:
   ```bash
   cd backend
   source venv/bin/activate  # Linux/macOS
   # or
   .\venv\Scripts\activate   # Windows
   ```

2. Start the FastAPI server:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8001 --reload
   ```
   
   The backend will be running at `http://localhost:8001`

#### Start the Frontend Development Server

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Start the React development server:
   ```bash
   yarn start
   ```
   
   The frontend will be running at `http://localhost:3000`

### Option 2: Using Docker (if available)

```bash
docker-compose up --build
```

---

## 🧪 Testing the Application

### Seed Sample Data

Before testing, seed the database with sample grocery items:

```bash
# Using curl
curl -X POST http://localhost:8001/api/seed-items

# Or using httpie
http POST http://localhost:8001/api/seed-items
```

This will populate the database with 22 sample items across 6 categories:
- Vegetables
- Fruits
- Dairy
- Beverages
- Snacks
- Essentials

### API Endpoints Testing

#### Test Items Endpoint
```bash
# Get all items
curl http://localhost:8001/api/items

# Get categories
curl http://localhost:8001/api/categories
```

#### Test Authentication
```bash
# Register a new user
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "full_name": "Test User"}'

# Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

#### Test Cart Operations (requires authentication)
```bash
# Replace YOUR_JWT_TOKEN with the token received from login

# Get cart
curl http://localhost:8001/api/cart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Save cart
curl -X PUT http://localhost:8001/api/cart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"item_id": "item-uuid", "item_name": "Apple", "rate": 150, "quantity": 2, "total": 300}]}'

# Clear cart
curl -X DELETE http://localhost:8001/api/cart \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Frontend Testing

1. **Open the application** at `http://localhost:3000`

2. **Test user registration/login**
   - Click on the login/signup button
   - Create a new account or login with existing credentials

3. **Test product browsing**
   - Browse products in the main page
   - Use category filters to filter products

4. **Test cart functionality**
   - Add items to cart
   - Update quantities
   - Remove items
   - Verify cart persists after page refresh (when logged in)

5. **Test checkout flow**
   - Add items to cart
   - Proceed to checkout
   - Fill in delivery address (required for first-time users)

### Running Automated Tests

#### Backend Tests
```bash
cd backend
python -m pytest tests/ -v
```

#### Frontend Tests
```bash
cd frontend
yarn test
```

---

## 📁 Project Structure

```
/app
├── backend/
│   ├── server.py           # FastAPI main application
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Backend environment variables
├── frontend/
│   ├── src/
│   │   ├── pages/         # React page components
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # Utility functions
│   ├── package.json       # Node.js dependencies
│   └── .env              # Frontend environment variables
├── tests/                 # Test files
└── README.md             # This file
```

---

## 🔧 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running locally or your connection string is correct
   - Check if the `MONGO_URL` in `.env` is properly configured

2. **CORS Errors**
   - Verify `REACT_APP_BACKEND_URL` matches your backend server address
   - Check that the backend CORS configuration includes your frontend origin

3. **Port Already in Use**
   - Backend: Change port in uvicorn command or kill the process using port 8001
   - Frontend: React will automatically suggest using a different port

4. **Dependencies Installation Failed**
   - Clear node_modules and reinstall: `rm -rf node_modules && yarn install`
   - For Python, try: `pip install --upgrade pip && pip install -r requirements.txt`

---

## 📝 Environment Variables Reference

### Backend (.env)
| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB connection string | `mongodb://localhost:27017/grocery_app` |
| `JWT_SECRET` | Secret key for JWT tokens | `your_secret_key_here` |

### Frontend (.env)
| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `http://localhost:8001` |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

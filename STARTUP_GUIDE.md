# Emergent Quick Startup Guide

## Quick Start Command
```bash
bash /app/scripts/startup.sh
```

## Manual Steps (if needed)

### 1. Check Service Status
```bash
sudo supervisorctl status
```

### 2. Install Dependencies (if node_modules missing)
```bash
cd /app/frontend && yarn install
```

### 3. Start Services
```bash
sudo supervisorctl start backend frontend
# or restart all:
sudo supervisorctl restart all
```

### 4. Seed Database (if empty)
```bash
curl -X POST http://localhost:8001/api/seed-items
```

### 5. Check Logs (for debugging)
```bash
# Frontend logs
tail -50 /var/log/supervisor/frontend.out.log
tail -50 /var/log/supervisor/frontend.err.log

# Backend logs
tail -50 /var/log/supervisor/backend.out.log
tail -50 /var/log/supervisor/backend.err.log
```

## Common Issues

| Issue | Solution |
|-------|----------|
| `craco: not found` | Run `cd /app/frontend && yarn install` |
| Frontend won't start | Check if node_modules exists, reinstall if needed |
| Empty items list | Run `curl -X POST http://localhost:8001/api/seed-items` |
| Backend errors | Check `tail /var/log/supervisor/backend.err.log` |

## Service Ports
- **Frontend**: 3000
- **Backend**: 8001
- **MongoDB**: 27017

## API Endpoints
- `GET /api/items` - List all grocery items
- `GET /api/categories` - List all categories
- `POST /api/seed-items` - Seed sample data
- `GET/PUT/DELETE /api/cart` - Cart operations (requires auth)

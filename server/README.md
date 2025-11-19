# RepoPulse Server

Backend API server for RepoPulse PR Intelligence Dashboard.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the server directory with the following variables:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/repopulse

# JWT Secret (change this in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# JWT Expiration
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Bcrypt
BCRYPT_SALT_ROUNDS=10

# Server
PORT=3000
NODE_ENV=development
```

### 3. Start MongoDB

Make sure MongoDB is running on `localhost:27017` (or update `MONGODB_URI` in `.env`).

### 4. Run the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `POST /auth/signup` - Create a new user account
- `POST /auth/login` - Login and get access/refresh tokens
- `POST /auth/refresh` - Refresh access token using refresh token
- `GET /auth/me` - Get current user profile (requires authentication)

### Health Check

- `GET /health` - Server health check

## Example Requests

### Signup
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "John Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### Refresh Token
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refreshToken>"
  }'
```

## Project Structure

```
server/
├── models/
│   ├── User.ts              # User Mongoose model
│   └── pullRequest.model.ts # Pull Request model
├── config/
│   └── auth.ts              # JWT utilities
├── middleware/
│   └── authMiddleware.ts    # Authentication middleware
├── routes/
│   └── auth.ts              # Auth routes
├── handlers/
│   └── authHandler.ts       # Auth business logic handlers
├── utils/
│   └── password.ts          # Password hashing utilities
├── app.ts                   # Express app setup
├── server.ts                # Server entry point
└── package.json
```


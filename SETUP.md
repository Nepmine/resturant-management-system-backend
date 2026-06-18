# 🚀 MaHaVi Restaurant SaaS Backend — Setup Guide

Complete setup instructions for macOS, Linux, and Windows users.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **Git** — [Download](https://git-scm.com)
- **Docker & Docker Compose** (optional, for PostgreSQL/Redis) — [Download](https://www.docker.com/products/docker-desktop)

## Quick Start

### For macOS & Linux

```bash
chmod +x setup.sh
./setup.sh
```

### For Windows (PowerShell / Command Prompt)

```cmd
setup.cmd
```

Or using PowerShell:
```powershell
.\setup.cmd
```

## What the Setup Scripts Do

1. ✓ **Check prerequisites** — Verifies Node.js and npm are installed
2. ✓ **Install dependencies** — Runs `npm install`
3. ✓ **Setup `.env` file** — Copies `.env.example` to `.env` (if not exists)
4. ✓ **Generate Prisma client** — Runs `npx prisma generate`
5. ✓ **Configure git hooks** — Sets up pre-push hooks for development
6. ✓ **Start Docker services** (optional) — Asks to start PostgreSQL & Redis

## Manual Setup (If Scripts Don't Work)

If the automated scripts fail, follow these steps:

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
```

Then edit `.env` and fill in your values:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_*_SECRET` — Generate with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` — From Google Cloud Console
- `ESEWA_*` — Payment gateway credentials
- `FRONTEND_URL` & `CUSTOMER_APP_URL` — Your app URLs

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Setup Database

**Option A: Using Docker (Recommended)**
```bash
docker-compose up -d
```

**Option B: Existing PostgreSQL**
- Update `DATABASE_URL` in `.env` with your connection string
- Ensure PostgreSQL is running

### 5. Run Migrations
```bash
npm run db:migrate:dev
```

### 6. (Optional) Seed Database
```bash
npm run db:seed
```

## Development Commands

```bash
npm run dev              # Start dev server with hot reload (port 3000)
npm run build            # Build for production
npm run db:migrate:dev   # Run migrations in dev mode
npm run db:seed          # Seed initial data
npm run db:studio        # Open Prisma Studio (visualize DB)
npm run lint             # Run ESLint
npm run typecheck        # Check TypeScript types
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | No | `development`, `test`, or `production` (default: development) |
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | **Yes** | 32+ char random string for staff tokens |
| `JWT_REFRESH_SECRET` | **Yes** | 32+ char random string for staff refresh tokens |
| `JWT_MEMBER_SECRET` | **Yes** | 32+ char random string for customer tokens |
| `GOOGLE_CLIENT_ID` | **Yes** | From [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | **Yes** | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | **Yes** | e.g., `http://localhost:3000/api/v1/auth/google/callback` |
| `ESEWA_MERCHANT_CODE` | **Yes** | Payment gateway merchant code |
| `ESEWA_SECRET_KEY` | **Yes** | Payment gateway secret key |
| `ESEWA_VERIFY_URL` | **Yes** | Payment gateway verification endpoint |
| `FRONTEND_URL` | **Yes** | Admin dashboard URL (e.g., `http://localhost:5173`) |
| `CUSTOMER_APP_URL` | **Yes** | Customer app URL (e.g., `http://localhost:5174`) |
| `SUBSCRIPTION_GRACE_DAYS` | No | Days before subscription access is cut (default: 3) |

### Generate Secure JWT Secrets

```bash
# Generate a secure random string for JWT secrets (run 3 times for 3 secrets)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Database Setup

### Using Docker (Recommended)

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
  - Username: `user`
  - Password: `password`
  - Database: `mahavi`

### Using Existing PostgreSQL

Update `.env`:
```
DATABASE_URL=postgresql://username:password@localhost:5432/mahavi_dev?schema=public
```

## Common Issues

### ❌ `chmod: command not found` on Windows
**Fixed!** Update your `package.json` to use the fixed postinstall script. No more `chmod`.

### ❌ `DATABASE_URL` error
- Check `.env` exists and has valid `DATABASE_URL`
- Ensure PostgreSQL is running (`docker-compose up -d`)
- Verify connection string format

### ❌ `PRISMA_DATABASE_URL` not set
- Copy `.env.example` to `.env`
- Update all required values in `.env`

### ❌ Port 3000 already in use
Change in `.env`:
```
PORT=3001
```

### ❌ Docker compose not found
Install [Docker Desktop](https://www.docker.com/products/docker-desktop)

## Project Structure

```
src/
├── app.ts                 # Express app setup
├── server.ts              # Server entry point
├── config/                # Configuration files
│   ├── database.ts        # Database connection
│   ├── env.ts             # Environment validation
│   └── passport.ts        # OAuth config
├── modules/               # Feature modules
│   ├── auth/              # Authentication
│   ├── restaurants/       # Restaurant management
│   ├── orders/            # Order management
│   ├── payments/          # Payment processing
│   └── ...
├── middleware/            # Express middleware
├── utils/                 # Utilities
└── types/                 # TypeScript types
```

## Next Steps

1. ✅ Run setup script
2. ✅ Update `.env` with real credentials
3. ✅ Run migrations: `npm run db:migrate:dev`
4. ✅ (Optional) Seed data: `npm run db:seed`
5. ✅ Start dev server: `npm run dev`
6. ✅ Open [http://localhost:3000](http://localhost:3000)

## Need Help?

- Check `.env.example` for all available options
- View Prisma schema: `prisma/schema.prisma`
- Open Prisma Studio: `npm run db:studio`
- Check logs in terminal for detailed errors

---

**Happy coding! 🎉**

#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# MaHaVi Restaurant SaaS Backend — Setup Script
# Works on macOS, Linux, and Windows (Git Bash / WSL)
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 Setting up MaHaVi Restaurant SaaS Backend..."
echo ""

# ── Colors for output ─────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Step 1: Check prerequisites ───────────────────────────────────────────────
echo -e "${BLUE}► Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org${NC}"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo -e "${YELLOW}✗ npm not found. Please install npm${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
echo -e "${GREEN}✓ npm $(npm --version)${NC}"
echo ""

# ── Step 2: Install dependencies ──────────────────────────────────────────────
echo -e "${BLUE}► Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# ── Step 3: Setup environment file ────────────────────────────────────────────
echo -e "${BLUE}► Setting up environment...${NC}"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env from .env.example${NC}"
    echo -e "${YELLOW}⚠ Please update .env with your actual values (database, JWT secrets, OAuth, etc.)${NC}"
  else
    echo -e "${YELLOW}✗ .env.example not found${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ .env already exists${NC}"
fi
echo ""

# ── Step 4: Generate Prisma client ────────────────────────────────────────────
echo -e "${BLUE}► Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""

# ── Step 5: Setup git hooks (cross-platform) ─────────────────────────────────
echo -e "${BLUE}► Setting up git hooks...${NC}"

git config core.hooksPath .git-hooks

# Make hooks executable on Unix-like systems (Mac, Linux, WSL)
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
  if [ -f .git-hooks/pre-push ]; then
    chmod +x .git-hooks/pre-push
  fi
fi

echo -e "${GREEN}✓ Git hooks configured${NC}"
echo ""

# ── Step 6: Offer to start Docker containers ──────────────────────────────────
if command -v docker-compose &> /dev/null || command -v docker &> /dev/null; then
  echo -e "${BLUE}► Docker detected. Start services?${NC}"
  read -p "Start PostgreSQL and Redis? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose up -d
    echo -e "${GREEN}✓ PostgreSQL and Redis started${NC}"
    echo ""
  fi
fi

# ── Final summary ─────────────────────────────────────────────────────────────
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Update .env with your configuration (database URL, JWT secrets, OAuth, etc.)"
echo "  2. Run migrations: npm run db:migrate:dev"
echo "  3. Seed database (optional): npm run db:seed"
echo "  4. Start development: npm run dev"
echo ""
echo "Useful commands:"
echo "  npm run dev              — Start development server with hot reload"
echo "  npm run build            — Build for production"
echo "  npm run db:migrate:dev   — Run database migrations"
echo "  npm run db:seed          — Seed database with initial data"
echo "  npm run db:studio        — Open Prisma Studio"
echo "  npm run lint             — Run ESLint"
echo "  npm run typecheck        — Check TypeScript types"
echo ""

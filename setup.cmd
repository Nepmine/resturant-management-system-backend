@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM MaHaVi Restaurant SaaS Backend — Setup Script (Windows)
REM Works on Windows PowerShell / Command Prompt
REM ─────────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

echo.
echo 🚀 Setting up MaHaVi Restaurant SaaS Backend...
echo.

REM ── Step 1: Check prerequisites ───────────────────────────────────────────────
echo ► Checking prerequisites...

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org
  exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✓ Node.js %NODE_VERSION%
echo ✓ npm %NPM_VERSION%
echo.

REM ── Step 2: Install dependencies ──────────────────────────────────────────────
echo ► Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo ✗ Failed to install dependencies
  exit /b 1
)
echo ✓ Dependencies installed
echo.

REM ── Step 3: Setup environment file ────────────────────────────────────────────
echo ► Setting up environment...

if not exist .env (
  if exist .env.example (
    copy .env.example .env
    echo ✓ Created .env from .env.example
    echo ⚠ Please update .env with your actual values
  ) else (
    echo ✗ .env.example not found
    exit /b 1
  )
) else (
  echo ✓ .env already exists
)
echo.

REM ── Step 4: Generate Prisma client ────────────────────────────────────────────
echo ► Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
  echo ✗ Failed to generate Prisma client
  exit /b 1
)
echo ✓ Prisma client generated
echo.

REM ── Step 5: Setup git hooks ──────────────────────────────────────────────────
echo ► Setting up git hooks...
call git config core.hooksPath .git-hooks
echo ✓ Git hooks configured
echo.

REM ── Step 6: Offer to start Docker containers ──────────────────────────────────
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
  echo ► Docker detected. Start services?
  set /p REPLY="Start PostgreSQL and Redis? (y/n): "
  if /i "!REPLY!"=="y" (
    call docker-compose up -d
    echo ✓ PostgreSQL and Redis started
    echo.
  )
)

REM ── Final summary ─────────────────────────────────────────────────────────────
echo ═══════════════════════════════════════════════════════════════
echo ✓ Setup complete!
echo ═══════════════════════════════════════════════════════════════
echo.
echo Next steps:
echo   1. Update .env with your configuration
echo   2. Run migrations: npm run db:migrate:dev
echo   3. Seed database (optional): npm run db:seed
echo   4. Start development: npm run dev
echo.
echo Useful commands:
echo   npm run dev              - Start development server
echo   npm run build            - Build for production
echo   npm run db:migrate:dev   - Run database migrations
echo   npm run db:seed          - Seed database with initial data
echo   npm run db:studio        - Open Prisma Studio
echo   npm run lint             - Run ESLint
echo   npm run typecheck        - Check TypeScript types
echo.

endlocal

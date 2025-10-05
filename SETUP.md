# HGV Compliance Platform - Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Git** ([Download](https://git-scm.com/))
- **PostgreSQL** 14+ (for local development)
- **Redis** 6+ (for caching)

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repository-url>
cd hgv-compliance-platform

# Install dependencies
npm install

# Copy environment template
cp env.example .env.local
```

### 2. Supabase Setup

#### Option A: Use Supabase Cloud (Recommended)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Update Environment Variables**
   ```bash
   # Edit .env.local
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

3. **Run Database Schema**
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `supabase-schema.sql`
   - Execute the SQL script

#### Option B: Local Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase
supabase init

# Start local Supabase
supabase start

# Run migrations
supabase db reset
```

### 3. Environment Configuration

Edit `.env.local` with your configuration:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# DVLA API (Optional - for production)
DVLA_API_KEY=your_dvla_api_key

# External APIs (Optional)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
TOMTOM_API_KEY=your_tomtom_api_key

# Security
JWT_SECRET=your_jwt_secret_key
NEXTAUTH_SECRET=your_nextauth_secret

# Development
NODE_ENV=development
```

### 4. Start Development Server

```bash
# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

## Project Structure

```
hgv-compliance-platform/
├── app/                    # Next.js 14 app directory
│   ├── (auth)/            # Authentication pages
│   ├── dashboard/         # Main dashboard
│   ├── orders/           # Order management
│   ├── vehicles/         # Vehicle management
│   ├── drivers/          # Driver management
│   ├── compliance/       # DVSA compliance
│   └── api/              # API routes
├── components/            # Reusable UI components
├── lib/                  # Utility functions and configurations
│   ├── supabase.ts       # Supabase client
│   ├── schemas.ts        # Zod validation schemas
│   ├── storage.ts        # Supabase storage functions
│   ├── dvla.ts          # DVLA API integration
│   ├── dvsa.ts          # DVSA compliance functions
│   └── routing.ts       # Route optimization
├── types/                # TypeScript type definitions
├── public/               # Static assets
└── docs/                 # Documentation
```

## Database Setup

### 1. Run Schema Script

Execute the `supabase-schema.sql` file in your Supabase SQL Editor or local PostgreSQL:

```sql
-- This will create all tables, indexes, and RLS policies
-- See supabase-schema.sql for complete schema
```

### 2. Verify Tables Created

Check that these tables were created:
- `tenants`
- `users`
- `vehicles`
- `drivers`
- `orders`
- `jobs`
- `walkaround_checks`
- `defects`
- `safety_inspections`
- `inspection_documents`
- And more...

### 3. Test Database Connection

```bash
# Test Supabase connection
npm run test:db
```

## Authentication Setup

### 1. Configure Supabase Auth

In your Supabase dashboard:
- Go to Authentication → Settings
- Configure email templates
- Set up OAuth providers if needed
- Configure redirect URLs

### 2. Create First Admin User

```bash
# Run the setup script
npm run setup:admin
```

Or manually create via Supabase dashboard:
1. Go to Authentication → Users
2. Click "Add User"
3. Set role to "admin"
4. Create tenant record

## Development Workflow

### 1. Start Development

```bash
# Start all services
npm run dev

# Or start individual services
npm run dev:web      # Next.js frontend
npm run dev:api      # FastAPI backend (if using)
```

### 2. Database Changes

```bash
# Generate migration
npm run db:migrate

# Reset database
npm run db:reset
```

### 3. Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration
```

## Common Issues & Solutions

### Issue: Supabase Connection Failed
**Solution**: Check your environment variables and ensure Supabase project is active.

### Issue: Database Schema Errors
**Solution**: Ensure PostgreSQL extensions (uuid-ossp, postgis) are enabled.

### Issue: Authentication Not Working
**Solution**: Verify Supabase Auth settings and redirect URLs.

### Issue: File Upload Fails
**Solution**: Check Supabase Storage bucket configuration and RLS policies.

## Next Steps

1. **Create Your First Tenant**
   - Register a new account
   - Set up your organization

2. **Add Vehicles**
   - Register your fleet vehicles
   - Configure vehicle specifications

3. **Add Drivers**
   - Register driver accounts
   - Upload licence information

4. **Create Orders**
   - Import or manually create orders
   - Test route optimization

5. **Test DVSA Compliance**
   - Perform walkaround checks
   - Test defect reporting
   - Verify document storage

## Production Deployment

### 1. Environment Setup

```bash
# Production environment variables
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
# ... other production configs
```

### 2. Build and Deploy

```bash
# Build for production
npm run build

# Start production server
npm start
```

### 3. Database Migration

```bash
# Run production migrations
npm run db:migrate:prod
```

## Support

- **Documentation**: Check the `docs/` folder
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub discussions for questions

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [DVLA API Documentation](https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
- [DVSA Compliance Guide](https://www.gov.uk/government/publications/dvsa-guide-to-maintaining-roadworthiness)


# Supabase Setup Guide

## Step-by-Step Database Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `hgv-compliance-platform`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project to be ready (2-3 minutes)

### 2. Get Your Project Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xyz.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### 3. Update Environment Variables

Edit your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run Database Schema

#### Option A: Using Supabase Dashboard (Recommended)

**Step 1: Run Main Schema**
1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New Query"
3. Copy the entire contents of `supabase-schema-simple.sql`
4. Paste into the SQL editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for execution to complete

**Step 2: Run RLS Policies**
1. In the same SQL Editor, create a new query
2. Copy the entire contents of `supabase-rls-policies.sql`
3. Paste into the SQL editor
4. Click **Run**
5. Wait for execution to complete

#### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Run migrations
supabase db push
```

### 5. Set Up Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New Bucket**
3. Enter bucket details:
   - **Name**: `inspections`
   - **Public bucket**: ❌ (unchecked)
4. Click **Create bucket**

### 6. Set Up Storage Policies

1. Go to **Storage** → **Policies**
2. Click **New Policy** for the `inspections` bucket
3. Run the contents of `supabase-storage-setup.sql` in the SQL Editor

Or manually create these policies:

#### Upload Policy
```sql
CREATE POLICY "Users can upload inspection files" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

#### View Policy
```sql
CREATE POLICY "Users can view own inspection files" ON storage.objects FOR SELECT USING (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

#### Delete Policy
```sql
CREATE POLICY "Users can delete own inspection files" ON storage.objects FOR DELETE USING (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 7. Configure Authentication

1. Go to **Authentication** → **Settings**
2. Configure these settings:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Redirect URLs**: Add `http://localhost:3000/auth/callback`
   - **Email Templates**: Customize if needed

### 8. Test Your Setup

Run the test script:

```bash
npm run test:db
```

You should see:
```
✅ Database connection successful
📊 Connected to: https://your-project-id.supabase.co
```

### 9. Create Admin User

```bash
npm run setup:admin
```

This will create:
- A default tenant
- An admin user with email: `admin@example.com`
- Password: `admin123!`

### 10. Verify Tables Created

Go to **Table Editor** in Supabase dashboard and verify these tables exist:

- ✅ `tenants`
- ✅ `users`
- ✅ `vehicles`
- ✅ `drivers`
- ✅ `orders`
- ✅ `jobs`
- ✅ `walkaround_checks`
- ✅ `defects`
- ✅ `safety_inspections`
- ✅ `inspection_documents`
- ✅ `driver_licence_checks`
- ✅ `vehicle_status_checks`
- ✅ `examiner_packs`
- ✅ `tachograph_records`
- ✅ `work_orders`
- ✅ `parts`
- ✅ `work_order_parts`
- ✅ `vehicle_types`

## Common Issues & Solutions

### Issue: "Extension not found"
**Solution**: Extensions are already enabled in Supabase. The schema now handles this properly.

### Issue: "Type already exists"
**Solution**: The schema now uses `DO $$ BEGIN ... EXCEPTION` blocks to handle existing types.

### Issue: "Storage bucket already exists"
**Solution**: Check if the bucket exists in Storage dashboard, or use a different name.

### Issue: "RLS policy conflicts"
**Solution**: Drop existing policies first:
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

### Issue: "Permission denied"
**Solution**: Make sure you're using the service role key for admin operations.

## Next Steps

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Test Login**: Go to `http://localhost:3000/auth/login`

3. **Create Your First Data**:
   - Add vehicles
   - Add drivers
   - Create orders
   - Test walkaround checks

## Production Setup

For production deployment:

1. **Update Site URL**: Change to your production domain
2. **Configure Redirect URLs**: Add your production callback URL
3. **Set Up Custom Domain**: Configure custom domain in Supabase
4. **Enable SSL**: Ensure HTTPS is enabled
5. **Set Up Monitoring**: Configure alerts and monitoring

## Security Checklist

- ✅ RLS policies enabled on all tables
- ✅ Storage policies configured
- ✅ Service role key kept secret
- ✅ Authentication configured
- ✅ HTTPS enabled (production)
- ✅ Environment variables secured

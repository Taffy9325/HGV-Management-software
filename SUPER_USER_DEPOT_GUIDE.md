# Super User and Depot Management

This document describes the super user role and depot management functionality added to the HGV Management Platform.

## Super User Role

The `super_user` role is the highest privilege level in the system, providing system-wide administrative access across all tenants.

### Capabilities

Super users can:
- Access all tenants and their data
- Create, edit, and delete depots across all tenants
- Manage users across all tenants
- Access all vehicles, drivers, and maintenance providers
- Override tenant-level restrictions
- Create other super users (only super users can create super users)

### Database Changes

The following changes were made to support super users:

1. **User Role Enum**: Added `super_user` to the `user_role` enum
2. **Row Level Security (RLS)**: Updated all RLS policies to allow super users access to all data
3. **Depots Table**: Created new `depots` table with proper relationships
4. **Depot Vehicles**: Created junction table for tracking vehicles at depots

### Migration

Run the migration script to add super user support:

```sql
-- Run this in your Supabase SQL Editor
\i migration-add-super-user-and-depots.sql
```

## Depot Management

Depots are physical locations where vehicles are stored and maintained. They can be managed by both super users and tenant admins.

### Depot Features

- **Location Management**: Full address with coordinates
- **Capacity Tracking**: Maximum vehicles and current count
- **Facilities**: Various facility types (fuel station, maintenance bay, etc.)
- **Operating Hours**: Configurable hours for each day
- **Contact Information**: Person, phone, and email
- **Status Management**: Active/inactive depots

### Depot Schema

```sql
CREATE TABLE depots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address JSONB NOT NULL, -- {street, city, postcode, country, lat, lng}
    contact_person VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    operating_hours JSONB, -- {monday: {open: "08:00", close: "18:00"}, ...}
    facilities TEXT[], -- ['fuel_station', 'maintenance_bay', 'loading_dock', 'storage']
    capacity INTEGER, -- Maximum number of vehicles
    current_vehicles INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Creating a Super User

### Method 1: Using the Script

```bash
node scripts/create-super-user.js admin@example.com password123
```

### Method 2: Manual Database Creation

1. Create auth user in Supabase Auth
2. Insert user record with `role = 'super_user'`
3. Ensure the user has a tenant_id (can be any tenant)

### Method 3: Through the UI

1. Log in as an existing super user
2. Go to User Management (`/admin/users`)
3. Create a new user and select "Super User" role
4. Only super users can create other super users

## Access Control

### Super User Access
- Can access all routes and data
- Bypasses tenant-level restrictions
- Can manage all tenants

### Admin Access
- Can access admin routes within their tenant
- Can manage depot management within their tenant
- Cannot access other tenants' data

### Regular Users
- Limited to their role-specific functionality
- Cannot access admin or depot management features

## UI Changes

### Navigation
- Added "Depots" link for super users and admins
- Updated role badges to show super user status

### User Management
- Added super user role option (only visible to super users)
- Updated role color coding (purple for super users)

### Depot Management
- New page at `/admin/depots`
- Full CRUD operations for depots
- Tenant filtering for super users
- Facility and operating hours management

## Security Considerations

1. **Super User Creation**: Only existing super users can create new super users
2. **RLS Policies**: All policies include super user bypass
3. **UI Restrictions**: Super user options only visible to super users
4. **Audit Trail**: All depot and user changes are logged with timestamps

## API Endpoints

The depot management uses the following Supabase tables:
- `depots` - Main depot information
- `depot_vehicles` - Vehicle assignments to depots
- `vehicles` - Updated with depot_id reference

## Future Enhancements

Potential future features:
- Depot-specific maintenance schedules
- Vehicle routing optimization based on depot locations
- Depot capacity alerts and notifications
- Multi-depot vehicle transfers
- Depot performance analytics


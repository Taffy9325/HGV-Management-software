# Tenant Isolation System Guide

## Overview

This system ensures complete data isolation between organizations (tenants) while allowing super users to manage all organizations. Each organization can only see and modify their own data.

## How It Works

### 1. Organization Creation (Super Users Only)

**Super users can create organizations:**
- Navigate to `/admin/organizations`
- Click "Create New Organization"
- Fill in organization details (name, industry, size, location, contact info)
- Organization gets a unique `tenant_id` (UUID)

### 2. Depot Creation

**After creating an organization, super users can create depots:**
- Navigate to `/admin/depots`
- Click "Create New Depot"
- Select the organization from the dropdown
- Depot gets assigned the same `tenant_id` as the organization

**Admin users can create depots:**
- Admin users can only create depots for their own organization
- The `tenant_id` is automatically set to their organization's ID

### 3. User Creation

**Super users can create users for any organization:**
- Navigate to `/admin/users`
- Click "Create New User"
- Select the target organization from dropdown
- User gets assigned the organization's `tenant_id`

**Admin users can create users:**
- Admin users can only create users for their own organization
- The `tenant_id` is automatically set to their organization's ID

### 4. Vehicle, Driver, and Other Entity Creation

**All entities created by admin users:**
- Automatically get assigned the admin's organization `tenant_id`
- Cannot be assigned to other organizations
- Are only visible to users within the same organization

**Super users can create entities for any organization:**
- Can select target organization when creating entities
- Entities get assigned the selected organization's `tenant_id`

## Database Schema

### Key Tables with Tenant Isolation

All major tables have a `tenant_id` column that links them to an organization:

- `tenants` - Organizations
- `users` - User accounts
- `depots` - Depot locations
- `vehicles` - Fleet vehicles
- `drivers` - Driver profiles
- `inspection_schedules` - Inspection schedules
- `orders` - Work orders
- `jobs` - Job assignments
- `defects` - Defect reports
- `safety_inspections` - Safety inspections
- `walkaround_checks` - Walkaround checks
- And many more...

### Row Level Security (RLS) Policies

Each table has two RLS policies:

1. **Super User Policy:**
   ```sql
   "Super users can access all [table_name]"
   USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_user'))
   ```

2. **Tenant-Specific Policy:**
   ```sql
   "Users can access their tenant [table_name]"
   USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
   ```

## User Roles

### Super User (`super_user`)
- Can see and manage ALL organizations
- Can create organizations, depots, users for any organization
- Can assign entities to any organization
- Bypasses tenant isolation restrictions

### Admin (`admin`)
- Can only see and manage their own organization's data
- Can create depots, users, vehicles, drivers within their organization
- Cannot see other organizations' data
- Automatically assigned `tenant_id` from their user profile

### Driver (`driver`)
- Can only see their own data and assigned vehicles/inspections
- Cannot create or modify organizational data
- Restricted to their organization's `tenant_id`

### Maintenance Provider (`maintenance_provider`)
- Can only see assigned work orders and vehicles
- Cannot create or modify organizational data
- Restricted to their organization's `tenant_id`

## Data Flow Examples

### Example 1: Super User Creates Organization
1. Super user creates "ABC Transport Ltd" → Gets `tenant_id: abc-123`
2. Super user creates depot "Main Depot" → Gets `tenant_id: abc-123`
3. Super user creates admin user "John" → Gets `tenant_id: abc-123`
4. John logs in and can only see ABC Transport's data

### Example 2: Admin User Creates Vehicle
1. Admin user "John" (tenant_id: abc-123) creates vehicle
2. Vehicle automatically gets `tenant_id: abc-123`
3. Only users with `tenant_id: abc-123` can see this vehicle
4. Users from other organizations cannot see this vehicle

### Example 3: Cross-Organization Access Attempt
1. Admin user "Jane" from "XYZ Logistics" (tenant_id: xyz-456) tries to access vehicle
2. Vehicle has `tenant_id: abc-123`
3. RLS policy blocks access: `tenant_id: abc-123 ≠ tenant_id: xyz-456`
4. Jane cannot see or modify the vehicle

## Security Features

### Complete Data Isolation
- Organizations cannot see each other's data
- RLS policies enforce isolation at database level
- No data leakage between organizations

### Super User Oversight
- Super users can manage all organizations
- Useful for system administration and support
- Can create cross-organization reports if needed

### Automatic Tenant Assignment
- New entities automatically get correct `tenant_id`
- No manual tenant assignment required for admin users
- Reduces human error in tenant assignment

## Testing Tenant Isolation

### Test 1: Create Two Organizations
1. Super user creates "Organization A"
2. Super user creates "Organization B"
3. Verify each has different `tenant_id`

### Test 2: Create Users for Each Organization
1. Super user creates admin user for Organization A
2. Super user creates admin user for Organization B
3. Verify each admin can only see their organization's data

### Test 3: Create Entities in Each Organization
1. Admin A creates vehicles, drivers, depots
2. Admin B creates vehicles, drivers, depots
3. Verify Admin A cannot see Admin B's data and vice versa

### Test 4: Super User Access
1. Super user logs in
2. Verify super user can see all organizations' data
3. Verify super user can create entities for any organization

## Troubleshooting

### Common Issues

1. **User can see other organizations' data:**
   - Check RLS policies are enabled
   - Verify user's `tenant_id` is correct
   - Check if user has `super_user` role

2. **Super user cannot create entities for organization:**
   - Verify organization exists in `tenants` table
   - Check if `tenant_id` is being passed correctly
   - Verify super user role is set correctly

3. **Admin user cannot create entities:**
   - Check admin user has `tenant_id` set
   - Verify RLS policies allow creation
   - Check if `tenant_id` is being assigned to new entities

### Debugging Queries

```sql
-- Check user's tenant_id
SELECT id, email, role, tenant_id FROM users WHERE id = auth.uid();

-- Check RLS policies
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'vehicles';

-- Test tenant isolation
SELECT * FROM vehicles WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid());
```

## Best Practices

1. **Always use tenant_id in queries** - Don't rely on application-level filtering
2. **Test tenant isolation regularly** - Create test organizations and verify isolation
3. **Monitor RLS policies** - Ensure policies are not accidentally set to `true`
4. **Use super user role sparingly** - Only assign to system administrators
5. **Document tenant assignments** - Keep track of which entities belong to which organization

## Conclusion

This tenant isolation system provides:
- Complete data separation between organizations
- Secure multi-tenant architecture
- Flexible super user management capabilities
- Automatic tenant assignment for admin users
- Database-level security enforcement

The system ensures that organizations can safely use the platform without worrying about data leakage or unauthorized access to their information.

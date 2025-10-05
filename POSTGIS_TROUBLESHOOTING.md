# Supabase PostGIS Troubleshooting Guide

## The Problem

You're getting this error:
```
ERROR: 42704: type "geometry" does not exist
LINE 96: current_location GEOMETRY(POINT, 4326),
```

This means PostGIS is not enabled in your Supabase project.

## Solutions

### Option 1: Enable PostGIS in Supabase (Recommended)

1. **Check if PostGIS is available**:
   Go to your Supabase Dashboard → SQL Editor and run:
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'postgis';
   ```

2. **Enable PostGIS**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

3. **Verify PostGIS is working**:
   ```sql
   SELECT PostGIS_Version();
   ```

4. **Run the main schema**:
   Use `supabase-schema.sql` (the original with PostGIS)

### Option 2: Use Alternative Schema (No PostGIS)

If PostGIS is not available in your Supabase project:

1. **Use the alternative schema**:
   Copy and paste `supabase-schema-no-postgis.sql` into Supabase SQL Editor

2. **Key differences**:
   - Uses `JSONB` instead of `GEOMETRY(POINT, 4326)`
   - Location data stored as `{lat: number, lng: number}`
   - Uses GIN indexes instead of spatial indexes

### Option 3: Check Supabase Plan

PostGIS might not be available on all Supabase plans:

- **Free Plan**: PostGIS should be available
- **Pro Plan**: PostGIS is definitely available
- **Enterprise Plan**: PostGIS is available

## Location Data Format Comparison

### With PostGIS (supabase-schema.sql)
```sql
current_location GEOMETRY(POINT, 4326)
```
- **Pros**: Spatial queries, distance calculations, proper GIS support
- **Cons**: Requires PostGIS extension

### Without PostGIS (supabase-schema-no-postgis.sql)
```sql
current_location JSONB -- {lat: 51.5074, lng: -0.1278}
```
- **Pros**: Works without PostGIS, simpler queries
- **Cons**: No spatial functions, manual distance calculations

## Code Changes Required

If you use the no-PostGIS version, update your TypeScript code:

### Before (PostGIS)
```typescript
// Spatial query
const { data } = await supabase
  .from('vehicles')
  .select('*')
  .within('current_location', bounds)
```

### After (JSONB)
```typescript
// Manual coordinate filtering
const { data } = await supabase
  .from('vehicles')
  .select('*')
  .gte('current_location->lat', minLat)
  .lte('current_location->lat', maxLat)
  .gte('current_location->lng', minLng)
  .lte('current_location->lng', maxLng)
```

## Distance Calculations

### With PostGIS
```sql
SELECT ST_Distance(
  current_location,
  ST_Point(-0.1278, 51.5074)::geography
) as distance
FROM vehicles;
```

### Without PostGIS (JavaScript)
```typescript
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

## Quick Fix Steps

1. **Try enabling PostGIS first**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

2. **If that fails, use the no-PostGIS schema**:
   - Copy `supabase-schema-no-postgis.sql`
   - Paste into Supabase SQL Editor
   - Run the script

3. **Update your application code**:
   - Use JSONB coordinate format: `{lat: number, lng: number}`
   - Implement manual distance calculations
   - Use GIN indexes for location queries

## Testing Your Setup

After choosing a solution, test with:

```bash
npm run test:db
```

You should see:
```
✅ Database connection successful
📊 Connected to: https://your-project-id.supabase.co
```

## Migration Between Formats

If you need to switch between PostGIS and JSONB later:

### PostGIS to JSONB
```sql
-- Add new JSONB column
ALTER TABLE vehicles ADD COLUMN current_location_jsonb JSONB;

-- Migrate data
UPDATE vehicles SET current_location_jsonb = 
  json_build_object(
    'lat', ST_Y(current_location::geometry),
    'lng', ST_X(current_location::geometry)
  );

-- Drop old column and rename
ALTER TABLE vehicles DROP COLUMN current_location;
ALTER TABLE vehicles RENAME COLUMN current_location_jsonb TO current_location;
```

### JSONB to PostGIS
```sql
-- Add new GEOMETRY column
ALTER TABLE vehicles ADD COLUMN current_location_geom GEOMETRY(POINT, 4326);

-- Migrate data
UPDATE vehicles SET current_location_geom = 
  ST_SetSRID(ST_MakePoint(
    (current_location->>'lng')::float,
    (current_location->>'lat')::float
  ), 4326);

-- Drop old column and rename
ALTER TABLE vehicles DROP COLUMN current_location;
ALTER TABLE vehicles RENAME COLUMN current_location_geom TO current_location;
```

## Recommendation

**Start with the no-PostGIS version** (`supabase-schema-no-postgis.sql`) because:
- It works immediately without extension issues
- JSONB coordinates are sufficient for most HGV applications
- You can always migrate to PostGIS later if needed
- Simpler to debug and maintain

The HGV compliance platform will work perfectly fine with JSONB coordinates for all route planning and tracking features.

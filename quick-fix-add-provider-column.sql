-- Quick fix: Add missing maintenance_provider_id column
-- Run this in your Supabase SQL Editor if you only need to add the missing column

-- Check if inspection_schedules table exists and add the missing column
DO $$ 
BEGIN
    -- Check if inspection_schedules table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_schedules') THEN
        
        -- Add maintenance_provider_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'inspection_schedules' 
            AND column_name = 'maintenance_provider_id'
        ) THEN
            ALTER TABLE inspection_schedules 
            ADD COLUMN maintenance_provider_id UUID;
            
            -- Add index for better performance
            CREATE INDEX IF NOT EXISTS idx_inspection_schedules_provider_id 
            ON inspection_schedules(maintenance_provider_id);
            
            RAISE NOTICE 'Added maintenance_provider_id column to inspection_schedules table';
        ELSE
            RAISE NOTICE 'maintenance_provider_id column already exists in inspection_schedules table';
        END IF;
        
    ELSE
        RAISE NOTICE 'inspection_schedules table does not exist. Please run the full schema first.';
    END IF;
END $$;


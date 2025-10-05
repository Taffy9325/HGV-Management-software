# HGV Compliance Platform - Complete Specification

## 1. System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Web Platform │    │   Admin Panel   │
│   (Next.js)     │    │   (Next.js)     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────────────────┘
                    │
        ┌─────────────┴─────────────┐
        │     API Gateway          │
        │   (Authentication)       │
        └─────────────┬─────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼────────┐    ┌───▼──────────┐    ┌─▼────────┐
│  Core      │    │   Supabase   │    │ External │
│ Services   │    │   Storage    │    │ APIs     │
│(FastAPI)   │    │(Postgres +   │    │(DVLA,    │
│            │    │ Storage)     │    │ Maps)    │
└────────────┘    └──────────────┘    └──────────┘
```

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), PostgreSQL + PostGIS
- **Storage**: Supabase (Postgres + Storage)
- **Cache**: Redis
- **Message Queue**: NATS
- **Authentication**: Supabase Auth (OIDC)

## 2. Data Model (ERD)

### Core Entities
```sql
-- Tenants & Users
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    settings JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL, -- admin, planner, driver, mechanic
    profile JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vehicles & Drivers
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    registration VARCHAR(20) UNIQUE NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    vehicle_type_id UUID REFERENCES vehicle_types(id),
    dimensions JSONB, -- {length, width, height, weight}
    adr_classifications TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    licence_number VARCHAR(20) UNIQUE NOT NULL,
    licence_expiry DATE,
    cpc_expiry DATE,
    tacho_card_expiry DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Orders & Jobs
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    consignor JSONB NOT NULL,
    consignee JSONB NOT NULL,
    pickup_location GEOMETRY(POINT, 4326),
    delivery_location GEOMETRY(POINT, 4326),
    pickup_window_start TIMESTAMP,
    pickup_window_end TIMESTAMP,
    delivery_window_start TIMESTAMP,
    delivery_window_end TIMESTAMP,
    load_details JSONB,
    adr_flags TEXT[],
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    order_id UUID REFERENCES orders(id),
    driver_id UUID REFERENCES drivers(id),
    vehicle_id UUID REFERENCES vehicles(id),
    status VARCHAR(50) DEFAULT 'planned',
    planned_start TIMESTAMP,
    planned_end TIMESTAMP,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    route_plan JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- DVSA Compliance
CREATE TABLE walkaround_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    driver_id UUID REFERENCES drivers(id),
    vehicle_id UUID REFERENCES vehicles(id),
    check_data JSONB NOT NULL, -- DVSA checklist
    defects_found BOOLEAN DEFAULT FALSE,
    vor_required BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    walkaround_id UUID REFERENCES walkaround_checks(id),
    vehicle_id UUID REFERENCES vehicles(id),
    defect_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- minor, major, dangerous
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    reported_at TIMESTAMP DEFAULT NOW()
);

-- Supabase Storage Integration
CREATE TABLE inspection_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    inspection_id UUID NOT NULL,
    inspection_type VARCHAR(50) NOT NULL, -- walkaround, defect, pmi
    supabase_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT NOW()
);
```

## 3. API Design

### Authentication
```typescript
// JWT Token Structure
interface JWTPayload {
  sub: string; // user_id
  tenant_id: string;
  role: string;
  permissions: string[];
  exp: number;
}
```

### Core Endpoints

#### Orders Management
```typescript
// POST /api/v1/orders
interface CreateOrderRequest {
  order_number: string;
  consignor: {
    name: string;
    address: Address;
    contact: ContactInfo;
  };
  consignee: {
    name: string;
    address: Address;
    contact: ContactInfo;
  };
  pickup_window: TimeWindow;
  delivery_window: TimeWindow;
  load_details: LoadDetails;
  adr_flags?: string[];
}

// POST /api/v1/plans/optimize
interface OptimizeRequest {
  orders: string[]; // order IDs
  vehicles: string[]; // vehicle IDs
  constraints: {
    max_driving_hours: number;
    break_requirements: BreakRule[];
    vehicle_restrictions: VehicleRestriction[];
  };
}
```

#### DVSA Compliance
```typescript
// POST /api/v1/dvir/walkaround
interface WalkaroundCheckRequest {
  vehicle_id: string;
  driver_id: string;
  check_data: DVSAWalkaroundData;
  defects?: DefectReport[];
}

// POST /api/v1/inspections/upload
interface UploadRequest {
  inspection_id: string;
  inspection_type: 'walkaround' | 'defect' | 'pmi';
  file: File;
  metadata?: Record<string, any>;
}
```

### Webhooks
```typescript
// Webhook Events
interface WebhookEvent {
  event_type: 'defect.raised' | 'vehicle.vor' | 'inspection.uploaded' | 'mot.expiry_warning';
  tenant_id: string;
  data: any;
  timestamp: string;
}
```

## 4. DVSA JSON Schemas

### Walkaround Check Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "vehicle_id": {"type": "string"},
    "driver_id": {"type": "string"},
    "check_date": {"type": "string", "format": "date-time"},
    "mileage": {"type": "integer"},
    "checks": {
      "type": "object",
      "properties": {
        "lights": {
          "type": "object",
          "properties": {
            "headlights": {"type": "string", "enum": ["pass", "fail", "not_applicable"]},
            "indicators": {"type": "string", "enum": ["pass", "fail", "not_applicable"]},
            "brake_lights": {"type": "string", "enum": ["pass", "fail", "not_applicable"]}
          }
        },
        "tyres": {
          "type": "object",
          "properties": {
            "front_left": {"type": "string", "enum": ["pass", "fail", "not_applicable"]},
            "front_right": {"type": "string", "enum": ["pass", "fail", "not_applicable"]},
            "rear_left": {"type": "string", "enum": ["pass", "fail", "not_applicable"]},
            "rear_right": {"type": "string", "enum": ["pass", "fail", "not_applicable"]}
          }
        },
        "brakes": {
          "type": "object",
          "properties": {
            "handbrake": {"type": "string", "enum": ["pass", "fail", "not_applicable"]},
            "footbrake": {"type": "string", "enum": ["pass", "fail", "not_applicable"]},
            "air_pressure": {"type": "string", "enum": ["pass", "fail", "not_applicable"]}
          }
        }
      }
    },
    "defects": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": {"type": "string"},
          "description": {"type": "string"},
          "severity": {"type": "string", "enum": ["minor", "major", "dangerous"]},
          "location": {"type": "string"}
        }
      }
    },
    "nil_defect": {"type": "boolean"},
    "vor_required": {"type": "boolean"}
  },
  "required": ["vehicle_id", "driver_id", "check_date", "checks"]
}
```

### Defect Report Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "defect_id": {"type": "string"},
    "vehicle_id": {"type": "string"},
    "driver_id": {"type": "string"},
    "defect_type": {"type": "string"},
    "severity": {"type": "string", "enum": ["minor", "major", "dangerous"]},
    "description": {"type": "string"},
    "location": {"type": "string"},
    "reported_at": {"type": "string", "format": "date-time"},
    "photos": {
      "type": "array",
      "items": {"type": "string"} // Supabase storage paths
    },
    "repair_required": {"type": "boolean"},
    "vor_immediate": {"type": "boolean"}
  },
  "required": ["vehicle_id", "driver_id", "defect_type", "severity", "description"]
}
```

## 5. Supabase Storage Integration

### Storage Configuration
```typescript
// Supabase Storage Setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Storage bucket configuration
const INSPECTION_BUCKET = 'inspections';

// RLS Policy for inspections bucket
CREATE POLICY "Users can upload inspection files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own inspection files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'inspections' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Upload Workflow
```typescript
// Frontend upload function
async function uploadInspectionFile(
  file: File,
  inspectionId: string,
  inspectionType: string,
  userId: string,
  vehicleId: string
): Promise<string> {
  const timestamp = new Date().toISOString();
  const fileExt = file.name.split('.').pop();
  const fileName = `${timestamp}.${fileExt}`;
  
  const path = `${userId}/${vehicleId}/${inspectionId}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    
  if (error) throw error;
  
  // Store metadata in database
  await supabase
    .from('inspection_documents')
    .insert({
      inspection_id: inspectionId,
      inspection_type: inspectionType,
      supabase_path: data.path,
      file_type: file.type,
      file_size: file.size
    });
    
  return data.path;
}

// Generate signed URL for viewing
async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .createSignedUrl(path, expiresIn);
    
  if (error) throw error;
  return data.signedUrl;
}
```

## 6. Algorithms

### VRPTW Optimization
```python
# Vehicle Routing Problem with Time Windows
class VRPTWSolver:
    def __init__(self):
        self.solver = pywraplp.Solver.CreateSolver('SCIP')
    
    def solve(self, orders: List[Order], vehicles: List[Vehicle], constraints: Constraints):
        # Create variables
        x = {}  # Binary variable: vehicle v serves order o
        t = {}  # Time variable: arrival time at order o
        
        # Objective: minimize total distance
        objective = self.solver.Objective()
        
        # Constraints
        # 1. Each order served by exactly one vehicle
        for order in orders:
            self.solver.Add(sum(x[v.id, order.id] for v in vehicles) == 1)
        
        # 2. Time windows
        for order in orders:
            for vehicle in vehicles:
                self.solver.Add(
                    t[order.id] >= order.pickup_window_start * x[vehicle.id, order.id]
                )
                self.solver.Add(
                    t[order.id] <= order.pickup_window_end * x[vehicle.id, order.id]
                )
        
        # 3. HGV constraints
        for vehicle in vehicles:
            # Weight capacity
            self.solver.Add(
                sum(order.weight * x[vehicle.id, order.id] for order in orders) 
                <= vehicle.max_weight
            )
            
            # Height restrictions
            for order in orders:
                if order.height > vehicle.max_height:
                    self.solver.Add(x[vehicle.id, order.id] == 0)
        
        # 4. EU Regulation 561/2006 (driving time limits)
        self.add_driving_time_constraints(vehicles, orders, x, t)
        
        return self.solver.Solve()
    
    def add_driving_time_constraints(self, vehicles, orders, x, t):
        # Daily driving limit: 9 hours
        # Weekly driving limit: 56 hours
        # Break requirements: 45 min every 4.5 hours
        pass
```

### Maintenance Forecasting
```python
# Survival Analysis for Component Failures
from lifelines import KaplanMeierFitter, WeibullFitter

class MaintenanceForecaster:
    def __init__(self):
        self.models = {}
    
    def train_model(self, component_type: str, historical_data: List[MaintenanceRecord]):
        # Prepare data for survival analysis
        durations = [record.miles_since_last_service for record in historical_data]
        events = [record.failure_occurred for record in historical_data]
        
        # Fit Weibull distribution
        wf = WeibullFitter()
        wf.fit(durations, events)
        
        self.models[component_type] = wf
        return wf
    
    def predict_failure_probability(self, component_type: str, current_mileage: int) -> float:
        model = self.models.get(component_type)
        if not model:
            return 0.0
        
        # Calculate probability of failure in next 1000 miles
        return model.predict(current_mileage + 1000) - model.predict(current_mileage)
```

## 7. DVLA Integration

### Licence Check Service
```typescript
// DVLA Driver Check API Integration
interface DVLARequest {
  licenceNumber: string;
  surname: string;
  dateOfBirth: string;
}

interface DVLAResponse {
  licenceNumber: string;
  surname: string;
  forenames: string[];
  dateOfBirth: string;
  entitlements: {
    category: string;
    validFrom: string;
    validTo: string;
    restrictions: string[];
  }[];
  endorsements: {
    offenceDate: string;
    offenceCode: string;
    convictionDate: string;
    penaltyPoints: number;
  }[];
}

async function checkDriverLicence(licenceNumber: string, surname: string, dob: string): Promise<DVLAResponse> {
  const response = await fetch('https://driver-vehicle-licensing.api.gov.uk/driver-check/v1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DVLA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      licenceNumber,
      surname,
      dateOfBirth: dob
    })
  });
  
  return response.json();
}
```

### MOT/Tax Check Service
```typescript
// DVLA Vehicle Check API
interface MOTResponse {
  registrationNumber: string;
  make: string;
  model: string;
  firstUsedDate: string;
  fuelType: string;
  motTestExpiryDate: string;
  motTestNumber: string;
  rfrAndComments: {
    text: string;
    type: string;
  }[];
}

async function checkMOTStatus(registration: string): Promise<MOTResponse> {
  const response = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles/${registration}`, {
    headers: {
      'x-api-key': process.env.DVLA_API_KEY
    }
  });
  
  return response.json();
}
```

## 8. Acceptance Tests

### Route Optimization Tests
```typescript
describe('Route Optimization', () => {
  test('should respect HGV height restrictions', async () => {
    const orders = [
      { id: '1', height: 4.2, pickup_location: { lat: 51.5074, lng: -0.1278 } },
      { id: '2', height: 3.8, pickup_location: { lat: 51.5074, lng: -0.1278 } }
    ];
    
    const vehicles = [
      { id: 'v1', max_height: 4.0 },
      { id: 'v2', max_height: 4.5 }
    ];
    
    const result = await optimizeRoutes(orders, vehicles);
    
    expect(result.assignments['1']).toBe('v2'); // Only v2 can handle 4.2m height
    expect(result.assignments['2']).toBe('v1'); // v1 can handle 3.8m height
  });
  
  test('should enforce EU driving time regulations', async () => {
    const longRoute = generateLongRoute(); // >9 hours driving
    const result = await optimizeRoutes(longRoute.orders, longRoute.vehicles);
    
    expect(result.breaks).toHaveLength(2); // At least 2 breaks required
    expect(result.totalDrivingTime).toBeLessThanOrEqual(9 * 60); // Max 9 hours
  });
});
```

### DVSA Compliance Tests
```typescript
describe('DVSA Compliance', () => {
  test('should force VOR for dangerous defects', async () => {
    const walkaround = {
      vehicle_id: 'v1',
      driver_id: 'd1',
      defects: [{
        category: 'brakes',
        severity: 'dangerous',
        description: 'Brake failure'
      }]
    };
    
    const result = await processWalkaroundCheck(walkaround);
    
    expect(result.vor_required).toBe(true);
    expect(result.vehicle_status).toBe('out_of_service');
  });
  
  test('should store NIL defect reports', async () => {
    const walkaround = {
      vehicle_id: 'v1',
      driver_id: 'd1',
      defects: [],
      nil_defect: true
    };
    
    const result = await processWalkaroundCheck(walkaround);
    
    expect(result.nil_defect).toBe(true);
    expect(result.defects).toHaveLength(0);
  });
});
```

### Supabase Integration Tests
```typescript
describe('Supabase Storage', () => {
  test('should upload inspection documents with correct path structure', async () => {
    const file = new File(['test'], 'inspection.pdf', { type: 'application/pdf' });
    const path = await uploadInspectionFile(
      file,
      'inspection-123',
      'walkaround',
      'user-456',
      'vehicle-789'
    );
    
    expect(path).toBe('user-456/vehicle-789/inspection-123/2024-01-15T10:30:00.000Z.pdf');
  });
  
  test('should generate signed URLs for document access', async () => {
    const path = 'user-456/vehicle-789/inspection-123/inspection.pdf';
    const signedUrl = await getSignedUrl(path, 3600);
    
    expect(signedUrl).toMatch(/^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/sign/);
  });
});
```

## 9. Implementation Roadmap

### Phase 1: Core Platform (8 weeks)
- [ ] Next.js web application setup
- [ ] Supabase project configuration
- [ ] User authentication & RBAC
- [ ] Basic order management
- [ ] Vehicle & driver management

### Phase 2: Route Optimization (6 weeks)
- [ ] VRPTW solver implementation
- [ ] HGV constraint handling
- [ ] EU Regulation 561/2006 compliance
- [ ] Real-time traffic integration

### Phase 3: Compliance & Integration (6 weeks)
- [ ] DVLA API integration
- [ ] MOT/tax checking
- [ ] Maintenance scheduling
- [ ] Reporting & analytics

### Phase 4: Advanced Features (4 weeks)
- [ ] Advanced analytics
- [ ] Third-party integrations
- [ ] Performance optimization
- [ ] Security hardening

## 10. Security & Compliance

### Data Protection
- GDPR compliance with data retention policies
- Encryption at rest and in transit
- Regular security audits
- Access logging and monitoring

### DVSA Compliance
- 15-month data retention for inspections
- Examiner pack generation
- Audit trail maintenance
- VOR workflow enforcement

### Performance Requirements
- 99.9% uptime SLA
- <10 second ETA calculation
- <1 minute inspection document generation
- Support for 1000+ concurrent users

This specification provides a comprehensive foundation for building a production-ready HGV compliance platform with full DVSA compliance, efficient route optimization, and robust mobile capabilities.

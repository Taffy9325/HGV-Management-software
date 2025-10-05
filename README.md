# HGV Compliance Platform

A comprehensive SaaS platform for Heavy Goods Vehicle (HGV) route planning, dispatch, maintenance, and DVSA compliance management.

## 🚛 Features

### Core Platform (Web)
- **Order Management**: Import orders, manage consignor/consignee data, time windows, load details, ADR flags
- **HGV Route Optimization**: VRPTW solver with HGV constraints (height/weight/axle, ADR restrictions, LEZ/ULEZ)
- **Live Operations**: Real-time GPS tracking, exception alerts, driver messaging
- **Maintenance Management**: Digital walkaround checks, defect reporting, VOR workflows
- **DVSA Compliance**: MOT reminders, tachograph scheduling, safety inspections
- **Licence & Vehicle Checks**: DVLA API integration for licence validation and MOT/tax status

### Compliance & Integration
- **DVSA Templates**: Walkaround checks, defect reports, PMI, tachograph schedules
- **Supabase Storage**: Secure document upload with RLS policies
- **DVLA APIs**: Driver licence validation, vehicle MOT/tax checking
- **Analytics**: KPIs, reporting, billing integration

## 🏗️ Architecture

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

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), PostgreSQL + PostGIS
- **Storage**: Supabase (Postgres + Storage)
- **Cache**: Redis
- **Message Queue**: NATS
- **Authentication**: Supabase Auth (OIDC)

## 📊 Data Model

### Core Entities
- **Tenants**: Multi-tenant architecture
- **Users**: RBAC with roles (admin, planner, driver, mechanic)
- **Vehicles**: HGV specifications, dimensions, ADR classifications
- **Drivers**: Licence details, CPC expiry, tachograph cards
- **Orders**: Consignor/consignee, time windows, load details
- **Jobs**: Route plans, status tracking, ePOD data
- **Walkaround Checks**: DVSA-compliant inspection data
- **Defects**: Severity classification, VOR workflows
- **Inspection Documents**: Supabase storage integration

## 🔧 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Supabase account
- DVLA API access

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hgv-compliance-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   ```bash
   cp env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Database setup**
   ```bash
   # Run the Supabase schema
   psql -h localhost -U postgres -d hgv_compliance -f supabase-schema.sql
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🔐 Authentication & Security

### Supabase Auth Configuration
- OIDC JWT tokens
- Row Level Security (RLS) policies
- Multi-tenant data isolation
- Role-based access control

### API Security
- JWT token validation
- Rate limiting
- Input validation with Zod schemas
- SQL injection prevention

## 📋 DVSA Compliance

### Required Templates
- **Walkaround Check**: Daily vehicle inspection checklist
- **Defect Report**: NIL reporting and severity classification
- **Safety Inspection (PMI)**: Annual/interim inspections
- **Tachograph Schedule**: Driver card (≤28 days), VU (≤90 days)
- **MOT Reminder**: Due dates and advisories
- **Examiner Pack**: 15-month data retention export

### Compliance Rules
- DANGEROUS defects force VOR (Vehicle Off Road)
- NIL defect reports must be stored
- 15-month data retention for DVSA
- Daily walkaround checks for commercial vehicles
- EU Regulation 561/2006 driving time limits

## 🚀 API Endpoints

### Core Endpoints
```typescript
POST /api/v1/orders              // Create order
POST /api/v1/plans/optimize      // Optimize routes
POST /api/v1/dispatch            // Dispatch jobs
POST /api/v1/dvir/walkaround     // Submit walkaround check
POST /api/v1/defects             // Report defect
POST /api/v1/inspections/upload   // Upload inspection document
GET  /api/v1/vehicles/{id}/mot-tax    // Check MOT/tax status
GET  /api/v1/drivers/{id}/licence-status // Check licence status
```

### Webhooks
- `defect.raised`: Dangerous defect reported
- `vehicle.vor`: Vehicle placed out of service
- `inspection.uploaded`: Document uploaded to Supabase
- `mot.expiry_warning`: MOT expires within 30 days
- `licence.invalid`: Driver licence invalid/suspended

## 📊 Supabase Storage Integration

### Storage Structure
```
inspections/
├── {user_id}/
│   ├── {vehicle_id}/
│   │   ├── {inspection_id}/
│   │   │   ├── {timestamp}.pdf
│   │   │   ├── {timestamp}.jpg
│   │   │   └── {timestamp}.png
```

### RLS Policies
- Users can only access their own files
- Tenant-scoped access control
- Signed URLs for time-limited access

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Acceptance Test Scenarios
- Route optimization with HGV constraints
- DVSA compliance workflows
- VOR (Vehicle Off Road) processes
- Supabase file upload/retrieval
- Licence/MOT/tax validation blocking

## 📈 Performance Requirements

- **Uptime**: 99.9% SLA
- **Route Optimization**: <10 seconds for 1,000 orders
- **Document Generation**: <1 minute for inspection PDFs
- **Concurrent Users**: 1,000+ supported
- **Offline Tolerance**: 48 hours for mobile app

## 🔄 Deployment

### Production Environment
- Docker containerization
- Kubernetes orchestration
- Load balancing with NGINX
- Redis clustering
- PostgreSQL replication
- CDN for static assets

### CI/CD Pipeline
- GitHub Actions
- Automated testing
- Security scanning
- Database migrations
- Blue-green deployments

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Mobile App Guide](./docs/mobile.md)
- [DVSA Compliance](./docs/dvsa-compliance.md)
- [Deployment Guide](./docs/deployment.md)
- [Troubleshooting](./docs/troubleshooting.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/hgv-compliance-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/hgv-compliance-platform/discussions)

## 🗺️ Roadmap

### Phase 1: Core Platform (8 weeks)
- [x] Next.js web application
- [x] Supabase integration
- [x] User authentication & RBAC
- [x] Basic order management
- [x] Vehicle & driver management

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

---

**Built with ❤️ for the HGV industry**

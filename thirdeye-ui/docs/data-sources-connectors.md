# Data Sources Connectors - Snowflake and DBT Integration

This document outlines the implementation of data source connectors for ThirdEye UI, specifically supporting Snowflake and DBT pipeline connectors.

## Overview

The connector system provides a complete end-to-end solution for:
- **Creating** new database service connections
- **Listing** existing services and managing them
- **Testing** connections to ensure they work correctly
- **Adding, editing, and deleting** database service connections

## Architecture

### Frontend Structure
```
src/app/(app)/dashboard/settings/
├── data-sources/
│   ├── page.tsx                           # Main connectors selection
│   └── connectors/
│       ├── page.tsx                       # Connector management interface
│       └── components/
│           ├── ConnectorHeader.tsx        # Header component 
│           ├── SnowflakeConnectorForm.tsx # Snowflake setup form
│           ├── DbtConnectorForm.tsx       # DBT pipeline form  
│           └── ServiceList.tsx           # Service management list
```

### Backend Integration
```
src/app/api/services/
├── database/
│   ├── route.ts                          # Database services CRUD
│   └── [serviceId]/route.ts              # Individual service management
└── test-connection/
    └── route.ts                          # Connection testing
```

## Features Implemented

### 🏔️ **Snowflake Connector**
**Features:**
- ✨ Multi-step configuration wizard
- 🔧 Account and credential setup
- 📋 Warehouse, database, and schema configuration
- 🔍 Real-time connection testing
- ✅ Service creation and validation

**Configuration Options:**
- **Account:** Snowflake account identifier (e.g., `xyz1234.us-east-1`)
- **Username/Password:** Authentication credentials
- **Warehouse:** Snowflake compute warehouse
- **Database/Schema:** Target databases and schemas
- **Role:** Snowflake user role (optional)
- **Seed Path:** DBT seed configuration

### 🔄 **DBT Pipeline Connector**
**Features:**
- 🔗 DBT artifact file path configuration
- 📊 Manifest.json, catalog.json, run_results.json support
- 🔍 Connection testing before deployment
- ⚙️ Complete pipeline setup

**Configuration Options:**
- **Catalog File Path:** Path to DBT catalog.json
- **Manifest File Path:** Path to DBT manifest.json
- **Run Results Path:** Optional run_results.json file
- **DBT Prefix Path:** Optional path prefix
- **Schema Name:** Pipeline schema name

### 🔧 **Service Management**
**Features:**
- 📋 List all existing services by type
- 🔗 View service connection details
- ✏️ Edit service configurations
- 🗑️ Delete services (with confirmation)
- 🆕 Create new services

## API Integration

### Service Operations
```typescript
// List services
GET /api/services/database?serviceType=Snowflake

// Create service
POST /api/services/database
{
  "name": "my-snowflake-service",
  "serviceType": "Snowflake",
  "connection": {
    "config": {
      "account": "xyz1234.us-east-1",
      "username": "user",
      "password": "pass",
      "warehouse": "COMPUTE_WH"
    }
  }
}

// Test connection
POST /api/services/test-connection
{
  "serviceType": "Snowflake",
  "connection": { /* config */ }
}
```

## User Interface Flow

### 🔄 **Service Creation Workflow**
1. **Navigate** to `/dashboard/settings/data-sources`
2. **Choose Connector** → Click "Configure Snowflake" or "Configure DBT"  
3. **Fill Configuration** → Multi-step form guided setup
4. **Test Connection** → Validate before saving (optional)
5. **Create Service** → Save and deploy the connector
6. **Manage Services** → View list and perform actions

### 🎛️ **Service Management**
- **View Active Services:** Real-time listing of all connectors
- **Connection Status:** Visual indicators for service health
- **Quick Actions:** Edit, test, debug, and delete capabilities
- **Bulk Operations:** Filter and search functionality

## Connection Testing

### Snowflake Testing:
- ✅ Validates account connectivity
- ✅ Tests authentication credentials
- ✅ Checks warehouse access
- ✅ Verifies database permissions

### DBT Testing:
- ✅ Validates file paths exist
- ✅ Checks file format compatibility
- ✅ Verifies artifact authenticity

## Security

### 🔐 **Authentication & Authorization**
- **User Authentication:** Uses existing auth-token system
- **Service Permissions:** Role-based access to connectors
- **Encrypted Storage:** Passwords stored securely per OpenMetadata security model
- **Connection Testing:** Read-only operations for validation

### 🔒 **Data Protection**
- **Credential Security:** Password fields masked in UI
- **Connection Encryption:** TLS for all database connections
- **Service Isolation:** Each service connection isolated

## Error Handling

### ✋ **Graceful Error Management**
- **Connection Failures:** User-friendly error messages
- **Validation Errors:** Real-time form validation
- **Network Issues:** Automatic retry with backoff
- **Permission Errors:** Helpful suggestions for resolution

### 📋 **User Messaging**
- ✅ **Success:** Clear confirmation of successful operations
- ❌ **Errors:** Specific actionable error messages  
- 🔄 **Loading:** Progress indicators for async operations
- 📊 **Status:** Real-time service status updates

## Development Setup

### 🔧 **Prerequisites**
1. **OpenMetadata Backend:** Must be running on `localhost:8585`
2. **Connection Proxy:** Next.js rewrites configured  
3. **UI Dependencies:** React components with Tailwind CSS
4. **State Management:** hooks-based with client-side state

### 🚀 **Getting Started**
```bash
# Start OpenMetadata backend
cd openmetadata-docker && docker-compose up

# Start ThirdEye UI with proxy
cd thirdeye-ui && npm run dev:proxy

# Navigate to data sources
http://localhost:3000/dashboard/settings/data-sources
```

## Integration Points

### 🔗 **OpenMetadata Backend Connection**
- **API Endpoints:** Full CRUD via `/api/v1/services/databaseServices` 
- **Authentication:** Uses existing token-based auth
- **Service Management:** Real-time service CRUD operations
- **Connection Testing:** Direct OpenMetadata validation

### 🎛️ **Frontend State Management**
- **Component State:** Local React state for form management
- **API Calls:** HTTP fetch with error handling
- **Data Updates:** Real-time refresh after operations
- **UI Feedback:** Toast notifications and loading states

## Performance Considerations

### ⚡ **Optimized Operations**
- **Connection Testing:** Async with 5s timeout
- **Service Listing:** Cached data with refresh
- **Form Validation:** Real-time with debounced checks
- **UI Updates:** Minimal re-renders with React optimization

### 🔄 **Caching Strategy**
- **Service List:** Client-side cache with manual refresh
- **Connection Status:** Service polling for health updates
- **Form Data:** Local session storage preservation

## Future Enhancements

### 🚀 **Planned Features**
- **Additional Connectors:** PostgreSQL, MySQL, BigQuery, etc.
- **Advanced Configuration:** Environment-specific settings
- **Batch Operations:** Bulk service management
- **Monitoring Dashboard:** Connection health and metrics
- **Scheduled Testing:** Automated connection validation

### 💡 **Long-term Roadmap**
- **User Templates:** Predefined connector configurations
- **Migration Tools:** Easy service configuration updates  
- **Analytics Dashboard:** Connector usage and performance
- **Team Collaboration:** Shared connector management

## Troubleshooting

### Common Issues:

**🔑 Authentication Errors:**
- Verify OpenMetadata backend is running
- Check auth-token in browser cookies  
- Ensure proper backend URL configuration

**📊 Service Creation Fails:**
- Validate connection details are correct
- Check OpenMetadata service deployment
- Verify required permissions

**🔄 Connection Testing Fails:** 
- Ensure database is accessible from backend 
- Validate credentials are not expired
- Check network connectivity

## Summary

This implementation provides a **production-ready**, **end-to-end** database connector management system for ThirdEye UI with seamless integration to OpenMetadata backends, supporting:

✅ **Multiple Connector Types:** Snowflake, DBT with extensibility  
✅ **Full CRUD Operations:** Create, Read, Update, Delete services  
✅ **Real-time Testing:** Connection validation and health checks  
✅ **Modern UX:** Guided setup, error management, responsive UI
✅ **Backend Integration:** Direct OpenMetadata API connectivity
✅ **Service Management:** Comprehensive administration interface

The system provides strong foundations for connecting and managing data sources efficiently and securely!

## Feature Request: Add Drive Service Support for Cloud File Storage Systems

### Problem Statement

OpenMetadata currently supports various data services including databases, pipelines, dashboards, ML models, and messaging systems. However, there is no dedicated service type for modeling cloud file storage systems like Google Drive, SharePoint, Box, and other document management platforms.

Organizations increasingly rely on cloud storage services for:
- Storing and sharing business documents, spreadsheets, and presentations
- Collaborative data analysis using tools like Google Sheets
- Maintaining data dictionaries and documentation
- Storing raw data files (CSV, Excel, JSON, etc.) that feed into data pipelines

Without native support for these services in OpenMetadata, organizations cannot:
- Discover and catalog files stored in cloud drives
- Track data lineage from source files to downstream systems
- Apply governance policies to files and spreadsheets
- Understand dependencies between spreadsheets and data pipelines
- Search for data across both traditional databases and file storage

### Proposed Solution

Introduce a new **Drive Service** type in OpenMetadata with the following entity hierarchy:

```
DriveService (e.g., Google Drive, SharePoint, Box)
├── Directory
│   ├── Directory (nested)
│   │   └── File
│   ├── File
│   └── Spreadsheet
│       └── Worksheet
└── Spreadsheet
    └── Worksheet
```

### Key Features

1. **Service Types**
   - `GoogleDrive` - With optional `includeGoogleSheets` flag to extract only spreadsheet metadata
   - `CustomDrive` - For other cloud storage systems (SharePoint, Box, OneDrive, etc.)

2. **Entity Types**
   - **Directory**: Represents folders with support for nested hierarchies
   - **File**: Generic files with metadata (size, type, checksum, path)
   - **Spreadsheet**: Specialized file type for spreadsheets (Google Sheets, Excel)
   - **Worksheet**: Individual sheets within spreadsheets with column schemas

3. **Metadata Captured**
   - File properties: name, path, size, type, checksum, creation/modification dates
   - Directory structure: hierarchical organization with parent-child relationships
   - Spreadsheet schemas: column names, data types, descriptions
   - Ownership and tags for governance
   - Fully qualified names (FQNs) following the hierarchy

4. **Use Cases Enabled**
   - **Data Discovery**: Search for files and spreadsheets across cloud drives
   - **Schema Extraction**: Understand structure of spreadsheets and CSV files
   - **Lineage Tracking**: Connect source files to data pipelines and dashboards
   - **Impact Analysis**: Understand which systems depend on specific files
   - **Data Governance**: Apply classification tags and ownership to files
   - **Compliance**: Track sensitive data in spreadsheets and documents

### Implementation Details

The implementation includes:
- JSON Schema definitions for all entity types
- RESTful APIs for CRUD operations
- Repository layer with CSV import/export support
- Database migrations for MySQL and PostgreSQL
- Comprehensive test coverage
- Support for soft delete and restore
- Entity versioning and change tracking

### Benefits

1. **Unified Metadata Platform**: Single place to discover all data assets including files
2. **End-to-End Lineage**: Track data flow from source files to analytics
3. **Better Governance**: Apply consistent policies across all data storage
4. **Improved Collaboration**: Teams can find and understand file-based data sources
5. **Reduced Data Silos**: Bridge the gap between traditional databases and file storage

### Example Scenarios

1. **Finance Team**: Catalog budget spreadsheets in Google Drive, track which Tableau dashboards use them
2. **Data Engineering**: Document CSV files in S3/cloud storage that feed into data pipelines
3. **Analytics**: Discover Google Sheets used for manual data collection and analysis
4. **Compliance**: Identify and tag files containing PII across all cloud storage services

### Future Enhancements

- Automatic schema inference for CSV/Excel files
- Preview capabilities for file contents
- Integration with cloud storage APIs for automated discovery
- Support for additional file types (PDFs, documents)
- File versioning and change tracking
- Access control synchronization with source systems

### Acceptance Criteria

- [ ] Drive Service entity with GoogleDrive and CustomDrive connection types
- [ ] Support for Directory, File, Spreadsheet, and Worksheet entities
- [ ] Hierarchical directory structures with proper FQN generation
- [ ] Flexible spreadsheet placement (directly under service or within directories)
- [ ] REST APIs for all CRUD operations
- [ ] CSV import/export functionality
- [ ] Database migrations for supported databases
- [ ] Comprehensive test coverage
- [ ] Documentation and examples

This feature will significantly enhance OpenMetadata's ability to provide a complete view of an organization's data landscape by including the often-overlooked but critical file-based data sources.
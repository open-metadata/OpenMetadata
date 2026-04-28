# Managing IA Chatbot Documentation Sources in OpenMetadata

## Overview

This guide demonstrates how to use OpenMetadata to store and manage documentation sources for Intelligent Agent (IA) applications, such as chatbots that rely on external documentation, website pages, PDFs, and other file-based resources.

## Problem Statement

IA/chatbot applications often depend on multiple documentation sources:
- Website pages (https://www.mywebsite/doc/x/...)
- PDF documents
- SharePoint documents
- Wiki pages
- Custom document repositories

**Goal**: Centrally manage these documentation sources with metadata (name, type, source, URL, owner) and track lineage between the chatbot application and its data sources.

## Solution: File Entity + Drive Service

OpenMetadata provides the **File** entity and **Drive Service** to model this use case perfectly.

### File Entity

The **File** entity represents a document or resource with comprehensive metadata:

| Property | Purpose | Example |
|----------|---------|---------|
| `name` | File identifier | `FAQ-Homepage-2024` |
| `fileType` | Content type enum | `PDF`, `Document`, `Text` |
| `sourceUrl` | Link to source system | `https://www.mywebsite/doc/faq/homepage` |
| `path` | Full path to file | `/docs/faq/homepage.pdf` |
| `description` | Detailed documentation | `Homepage FAQ document for chatbot training` |
| `owners` | Responsible parties | `[documentation-team]` |
| `mimeType` | MIME type | `application/pdf`, `text/html` |
| `downloadLink` | Direct download URL | `https://www.mywebsite/download/faq` |
| `webViewLink` | View in browser | `https://www.mywebsite/viewer/faq` |
| `service` | Parent Drive Service | Reference to `Documentation-Drive` |
| `isShared` | Sharing status | `true/false` |
| `tags` | Categorization | `chatbot`, `training-data`, `faq` |
| `extension` | Custom properties | `{"source": "SharePoint", "department": "Support"}` |

### Drive Service

The **Drive Service** is the container for organizing files. It supports multiple types:

- **GoogleDrive**: Google Drive integration
- **SharePoint**: Microsoft SharePoint repositories  
- **Sftp**: SFTP file servers
- **CustomDrive**: Flexible wrapper for any custom source

For most IA documentation use cases, use **CustomDrive** which allows flexible configuration.

## Implementation Approach

### Option 1: Using CustomDrive Service (Recommended)

**Best for**: Centralized documentation databases with custom metadata tracking

```yaml
Drive Service Configuration:
├── Service Name: "IA-Documentation-Repository"
├── Service Type: CustomDrive
├── Description: "Central repository of documentation for IA/chatbot applications"
├── Owners: [documentation-team, ia-platform-team]
└── Connection Configuration:
    └── Connection Options:
        - documentation_db_host: "your-docs.example.com"
        - documentation_db_api_key: "***"
        - documentation_db_type: "custom"
```

Then create **File** entities for each documentation source:

```json
{
  "name": "chatbot-training-data-homepage-faq",
  "displayName": "Homepage FAQ",
  "fileType": "PDF",
  "mimeType": "application/pdf",
  "service": "IA-Documentation-Repository",
  "sourceUrl": "https://www.mywebsite/doc/faq/homepage",
  "downloadLink": "https://www.mywebsite/download/faq",
  "path": "/docs/faq/homepage.pdf",
  "description": "FAQ documentation used for chatbot training. Updated quarterly.",
  "owners": ["documentation-team", "ia-chatbot-team"],
  "tags": [
    {"name": "chatbot", "source": "User"},
    {"name": "training-data", "source": "User"},
    {"name": "faq", "source": "User"}
  ],
  "extension": {
    "documentation_source": "SharePoint",
    "department": "Customer Support",
    "last_reviewed": "2024-04-15",
    "review_frequency": "quarterly",
    "confidentiality": "internal",
    "version": "2.1"
  }
}
```

### Option 2: Using Multiple Typed Drive Services

If documentation is spread across different platforms:

```
Drive Services:
├── SharePoint-Documentation
│   ├── Type: SharePoint
│   └── Files: SharePoint-hosted docs
├── Website-Documentation  
│   ├── Type: CustomDrive
│   └── Files: Web-accessible PDFs/pages
├── Wiki-Documentation
│   ├── Type: CustomDrive
│   └── Files: Wiki pages
└── Local-Repository
    ├── Type: Sftp
    └── Files: NAS/SFTP-hosted files
```

## Ingestion Methods

### Method 1: REST API (Direct)

Create files programmatically via OpenMetadata REST API:

```bash
# 1. Create the Drive Service first
curl -X POST "https://your-om-instance/api/v1/services/driveServices" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IA-Documentation-Repository",
    "serviceType": "CustomDrive",
    "description": "Central documentation for IA applications",
    "owners": [{"id": "<user-uuid>", "type": "user"}],
    "connection": {
      "config": {
        "type": "CustomDrive",
        "connectionOptions": {
          "__root__": {
            "api_endpoint": "https://your-docs.example.com",
            "doc_type": "centralized"
          }
        }
      }
    }
  }'

# 2. Create File entities
curl -X POST "https://your-om-instance/api/v1/entities/files" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "homepage-faq-chatbot",
    "displayName": "Homepage FAQ for Chatbot",
    "fileType": "PDF",
    "mimeType": "application/pdf",
    "service": {"id": "<drive-service-uuid>", "type": "driveService"},
    "sourceUrl": "https://www.mywebsite/doc/faq/homepage",
    "downloadLink": "https://www.mywebsite/download/faq",
    "description": "FAQ documentation for chatbot training",
    "owners": [{"id": "<user-uuid>", "type": "user"}],
    "tags": [
      {"name": "chatbot", "source": "User"},
      {"name": "training-data", "source": "User"}
    ],
    "extension": {
      "documentation_source": "SharePoint",
      "department": "Support",
      "review_frequency": "quarterly"
    }
  }'
```

### Method 2: Python Custom Connector

Build a custom connector for automated ingestion:

```python
from metadata.ingestion.source.database.database_service import DatabaseService
from metadata.ingestion.models.custom_entities import File, DriveService

class IAChatbotDocumentationConnector(DatabaseService):
    """
    Custom connector to ingest documentation from centralized database
    """
    
    def __init__(self, config):
        self.config = config
        self.client = self._init_client()
    
    def _init_client(self):
        """Initialize connection to documentation database"""
        return DocumentationClient(
            host=self.config.host,
            api_key=self.config.api_key
        )
    
    def fetch_all_files(self):
        """Fetch all documentation from central database"""
        documents = self.client.list_documents()
        return [self._transform_to_file(doc) for doc in documents]
    
    def _transform_to_file(self, doc_record):
        """Transform documentation record to OpenMetadata File entity"""
        return File(
            name=doc_record['doc_id'],
            displayName=doc_record['title'],
            fileType=self._map_file_type(doc_record['type']),
            mimeType=doc_record.get('mime_type', 'application/octet-stream'),
            sourceUrl=doc_record['url'],
            downloadLink=doc_record.get('download_url'),
            path=doc_record.get('path'),
            description=doc_record.get('description'),
            owners=[Owner(name=doc_record['owner_email'])],
            tags=[Tag(name=tag) for tag in doc_record.get('tags', [])],
            extension={
                'documentation_source': doc_record['source'],
                'department': doc_record['department'],
                'last_reviewed': doc_record['last_reviewed'],
                'review_frequency': doc_record.get('review_frequency'),
                'version': doc_record.get('version')
            }
        )
    
    @staticmethod
    def _map_file_type(source_type):
        """Map documentation types to FileType enum"""
        type_mapping = {
            'pdf': 'PDF',
            'doc': 'Document',
            'docx': 'Document',
            'xlsx': 'Spreadsheet',
            'page': 'Text',
            'web': 'Text'
        }
        return type_mapping.get(source_type, 'Other')
```

### Method 3: Batch CSV Import

For one-time or periodic bulk imports:

```csv
name,displayName,fileType,mimeType,sourceUrl,downloadLink,path,description,owners,tags,service
homepage-faq,Homepage FAQ,PDF,application/pdf,https://www.mywebsite/doc/faq/homepage,https://www.mywebsite/download/faq,/docs/faq/homepage.pdf,FAQ for homepage,team-support,chatbot;training-data,IA-Documentation-Repository
api-reference,API Reference,Document,text/markdown,https://www.mywebsite/doc/api/reference,https://www.mywebsite/download/api-ref,/docs/api/reference.md,API endpoint documentation,team-engineering,chatbot;api-docs,IA-Documentation-Repository
product-guide,Product Guide,PDF,application/pdf,https://sharepoint.company.com/sites/docs/product-guide,https://sharepoint.company.com/sites/docs/product-guide/download,/sharepoint/product-guide.pdf,Complete product guide,team-product,training-data;documentation,IA-Documentation-Repository
```

## Tracking Lineage Between Chatbots and Documentation

### Using Lineage (Advanced)

Create connections between your IA/chatbot applications and their documentation sources:

```json
{
  "entity_type": "bot_documentation_link",
  "bot_name": "customer-support-chatbot",
  "documentation_files": [
    "homepage-faq",
    "api-reference",
    "product-guide"
  ],
  "created_date": "2024-04-15",
  "lineage_description": "Documentation sources used for chatbot training"
}
```

Alternatively, use **Custom Properties** on the chatbot entity to reference documentation:

```json
{
  "name": "customer-support-chatbot",
  "type": "Application",
  "customProperties": {
    "documentation_sources": [
      "homepage-faq",
      "api-reference",
      "product-guide"
    ],
    "documentation_version": "2024-Q1",
    "last_training_date": "2024-04-10"
  }
}
```

## Best Practices

### 1. Metadata Organization

- **Naming Convention**: `{purpose}-{source}-{identifier}` 
  - Example: `chatbot-training-faq-homepage`, `chatbot-training-api-docs`
- **Description**: Explain purpose and usage in the chatbot context
- **Tags**: Use consistent tags for filtering
  - `chatbot` - Used by IA/chatbot system
  - `training-data` - Used for model training
  - `source-type` - `website`, `sharepoint`, `pdf`, etc.

### 2. Custom Properties

Store metadata not captured by core File properties in the `extension` field:

```json
{
  "extension": {
    "documentation_source": "SharePoint|Website|NAS|Wiki",
    "department": "Customer Support",
    "topic_area": "FAQ|API|Product Guide",
    "last_reviewed": "ISO-8601 date",
    "review_frequency": "daily|weekly|monthly|quarterly|yearly",
    "version": "semantic version",
    "confidentiality_level": "public|internal|restricted",
    "sla_update_days": 30,
    "language": "en|fr|de|etc"
  }
}
```

### 3. Ownership and Governance

- Assign clear owners for each documentation source
- Set review schedules for currency tracking
- Use tags to identify sensitive/restricted content
- Implement data contracts for critical documentation

### 4. Search and Discovery

Files are fully searchable in OpenMetadata. Users can find documentation via:
- **Full-text search**: Search documentation content/descriptions
- **Filters**: Filter by fileType, tags, owner, service
- **Tags**: Identify chatbot-related documents: `query: tag:chatbot`
- **Advanced search**: Combine filters for granular discovery

### 5. API Access

Query files via the OpenMetadata API:

```bash
# Get all chatbot documentation files
curl "https://your-om/api/v1/search/query?q=tag:chatbot&size=100" \
  -H "Authorization: Bearer <token>"

# Get files from specific Drive Service
curl "https://your-om/api/v1/entities/files?service=IA-Documentation-Repository" \
  -H "Authorization: Bearer <token>"

# Filter by owner
curl "https://your-om/api/v1/entities/files?owner=documentation-team" \
  -H "Authorization: Bearer <token>"
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              OpenMetadata Catalog                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Drive Service: IA-Documentation-Repository               │
│  ├── Type: CustomDrive                                    │
│  ├── Owners: [doc-team, ia-team]                         │
│  └─ Contains Files:                                       │
│     │                                                     │
│     ├─ File: homepage-faq                               │
│     │   ├── fileType: PDF                               │
│     │   ├── sourceUrl: https://mywebsite/doc/faq      │
│     │   ├── owner: support-team                       │
│     │   └── tags: [chatbot, training-data, faq]       │
│     │                                                 │
│     ├─ File: api-reference                            │
│     │   ├── fileType: Document                        │
│     │   ├── sourceUrl: https://mywebsite/doc/api    │
│     │   ├── owner: engineering-team                 │
│     │   └── tags: [chatbot, api-docs]               │
│     │                                                │
│     └─ File: product-guide                           │
│         ├── fileType: PDF                            │
│         ├── sourceUrl: https://sharepoint/.../guide│
│         ├── owner: product-team                      │
│         └── tags: [chatbot, training-data]          │
│                                                     │
│  Application: Customer-Support-Chatbot             │
│  ├── Type: Application                             │
│  ├── Uses Documentation:                           │
│  │   ├── homepage-faq                              │
│  │   ├── api-reference                             │
│  │   └── product-guide                             │
│  └── Owner: ia-platform-team                       │
│                                                     │
└─────────────────────────────────────────────────────────────┘
```

## Example Scenarios

### Scenario 1: Website-Based Documentation

**Company**: SaaS provider with comprehensive online documentation

```json
{
  "drive_service": {
    "name": "Website-Documentation-Drive",
    "serviceType": "CustomDrive"
  },
  "files": [
    {
      "name": "quickstart-guide",
      "sourceUrl": "https://docs.example.com/guides/quickstart",
      "fileType": "Text",
      "tags": ["chatbot", "getting-started"],
      "extension": {"documentation_source": "website", "format": "markdown"}
    },
    {
      "name": "api-endpoints-reference",
      "sourceUrl": "https://docs.example.com/api/reference",
      "fileType": "Text",
      "tags": ["chatbot", "api-docs"],
      "extension": {"documentation_source": "website", "format": "markdown"}
    }
  ]
}
```

### Scenario 2: Multi-Source Documentation

**Company**: Enterprise with documents in SharePoint, Wiki, and NAS

```
Scenario: Customer Support Chatbot
├── Uses SharePoint Documents (3 files)
│   ├── Knowledge-Base-Articles
│   ├── Support-Procedures
│   └── FAQ-Database
├── Uses Wiki Pages (2 files)
│   ├── Internal-Guidelines
│   └── Troubleshooting-Guide
└── Uses NAS Files (5 files)
    ├── Product-Specifications
    ├── Release-Notes
    ├── Terms-and-Conditions
    ├── Privacy-Policy
    └── Service-Level-Agreement

Total: 10 files managed in OpenMetadata
```

### Scenario 3: Regulated Industry

**Company**: Financial services with compliance requirements

```json
{
  "extension": {
    "documentation_source": "Compliance-System",
    "compliance_frameworks": ["SOC2", "PCI-DSS", "GDPR"],
    "approval_status": "approved",
    "last_audit_date": "2024-03-15",
    "next_audit_date": "2024-09-15",
    "retention_period_days": 2555,
    "confidentiality_level": "restricted",
    "certifications": ["audit-approved", "security-reviewed"]
  }
}
```

## Advantages of This Approach

✅ **Centralized Management**: All documentation sources in one place
✅ **Rich Metadata**: Store unlimited custom metadata via extensions
✅ **Search & Discovery**: Full-text search across all documentation
✅ **Governance**: Track ownership, review status, and compliance
✅ **Lineage**: Connect documentation to chatbot/application that uses it
✅ **API-Driven**: Automate ingestion from any source
✅ **Scalable**: Manage hundreds or thousands of documentation sources
✅ **Flexible**: Supports any documentation type and source
✅ **Access Control**: Role-based permissions on who can view/edit
✅ **Audit Trail**: Full version history and change tracking

## Next Steps

1. **Create Drive Service**: Set up your documentation repository in OpenMetadata
2. **Ingest Files**: Start with a small batch of critical documentation
3. **Define Tags**: Establish consistent tagging strategy
4. **Build Custom Properties**: Define extension fields for your metadata
5. **Create Lineage**: Link files to chatbot/application entities
6. **Monitor Usage**: Track how often documentation is accessed
7. **Scale Up**: Gradually add all documentation sources

## References

- [OpenMetadata File Entity Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/data/file.json)
- [OpenMetadata Drive Service](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/driveService.json)
- [REST API Documentation](https://docs.open-metadata.org/deploy/docker/OpenMetadata)
- [Custom Connectors Guide](https://docs.open-metadata.org/developers/develop-custom-connectors)

## FAQ

**Q: Can I store actual file content in OpenMetadata?**  
A: OpenMetadata stores metadata about files, not the file content itself. Use `sourceUrl`, `downloadLink`, and `webViewLink` to reference actual content.

**Q: What if my documentation source changes?**  
A: Update the File entity's `sourceUrl` and `downloadLink` properties. The change history is automatically tracked.

**Q: Can I version documentation in OpenMetadata?**  
A: Yes, use the `fileVersion` field and store version information in custom properties. Create new File entities for major versions if needed.

**Q: How do I handle large volumes of documentation?**  
A: Use batch ingestion via API or custom connectors. OpenMetadata can handle thousands of File entities efficiently.

**Q: Can users access the actual documentation from OpenMetadata UI?**  
A: Yes, the File entity displays `webViewLink` and `downloadLink` buttons in the UI for direct access to source documentation.

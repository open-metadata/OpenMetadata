# Adding Auto-Classification Support for New Entity Types

This guide documents the standardized process for adding auto-classification (PII detection) support to new entity types in OpenMetadata, based on the pattern established when adding Container entity support in [PR #26495](https://github.com/open-metadata/OpenMetadata/pull/26495).

## Overview

Auto-classification extends OpenMetadata's ability to automatically detect and tag sensitive data (PII) in different entity types. Originally built for Table entities, the system uses a schema-first, type-safe approach with parallel implementations across:

- JSON Schema specifications
- Java backend (REST API, persistence, authorization)
- Python ingestion framework (sampling, classification, data fetching)
- TypeScript frontend (UI configuration)

## Prerequisites

Before adding support for a new entity type (e.g., Topic, Dashboard, SearchIndex):

1. The entity must have a column-like structure (fields that can be classified)
2. The entity schema must support storing sample data
3. You must be able to sample/read data from the underlying source system

## Step-by-Step Implementation

### 1. Schema Changes (JSON Schema)

#### 1.1 Update Entity Schema to Support Sample Data

**Location:** `openmetadata-spec/src/main/resources/json/schema/entity/data/<entity>.json`

**Example (Container):**
```json
{
  "sampleData": {
    "description": "Sample data for the container.",
    "$ref": "../data/table.json#/definitions/tableData",
    "default": null
  }
}
```

**Action:** Add a `sampleData` field to your entity schema that references the standard `tableData` definition.

#### 1.2 Create Service-Specific Auto-Classification Pipeline Schema

**Location:** `openmetadata-spec/src/main/resources/json/schema/metadataIngestion/<serviceType>ServiceAutoClassificationPipeline.json`

**Example:** `storageServiceAutoClassificationPipeline.json`

```json
{
  "$id": "https://open-metadata.org/schema/metadataIngestion/storageServiceAutoClassificationPipeline.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "StorageServiceAutoClassificationPipeline",
  "description": "StorageService AutoClassification Pipeline Configuration.",
  "type": "object",
  "definitions": {
    "autoClassificationConfigType": {
      "description": "Storage Service Auto Classification Pipeline type",
      "type": "string",
      "enum": ["AutoClassification"],
      "default": "AutoClassification"
    }
  },
  "properties": {
    "type": {
      "description": "Pipeline type",
      "$ref": "#/definitions/autoClassificationConfigType",
      "default": "AutoClassification"
    },
    "classificationFilterPattern": {
      "description": "Regex to only compute metrics for entities that match the pattern",
      "$ref": "../type/filterPattern.json#/definitions/filterPattern"
    },
    "entityFilterPattern": {
      "description": "Entity-specific filter patterns (e.g., bucketFilterPattern, topicFilterPattern)",
      "$ref": "../type/filterPattern.json#/definitions/filterPattern"
    },
    "useFqnForFiltering": {
      "type": "boolean",
      "default": false
    },
    "storeSampleData": {
      "description": "Option to turn on/off storing sample data. If enabled, we will ingest sample data for each entity.",
      "type": "boolean",
      "default": false,
      "title": "Store Sample Data"
    },
    "enableAutoClassification": {
      "type": "boolean",
      "default": true
    },
    "confidence": {
      "type": "number",
      "default": 80
    },
    "sampleDataCount": {
      "type": "integer",
      "default": 50
    },
    "classificationLanguage": {
      "$ref": "../type/classificationLanguages.json",
      "default": "en"
    }
  }
}
```

**Key patterns:**
- Include entity-specific filter patterns (e.g., `bucketFilterPattern` for storage, `topicFilterPattern` for messaging)
- Keep consistent property names: `storeSampleData`, `enableAutoClassification`, `confidence`, `sampleDataCount`
- Reference standard filter patterns and classification languages
- **Important:** `storeSampleData` defaults to `false` to avoid storing large datasets by default. Users must explicitly enable it.

#### 1.3 Register Pipeline in Workflow Schema

**Location:** `openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json`

**Change:**
```json
{
  "sourceConfig": {
    "config": {
      "oneOf": [
        { "$ref": "databaseServiceAutoClassificationPipeline.json" },
        { "$ref": "storageServiceAutoClassificationPipeline.json" },
        { "$ref": "messagingServiceAutoClassificationPipeline.json" }  // Your new schema
      ]
    }
  }
}
```

#### 1.4 Add `supportsProfiler` to Connection Schemas

**Location:** `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/<serviceType>/<connector>Connection.json`

**Example:** All storage connection schemas (S3, GCS, ADLS, Custom Storage)

```json
{
  "properties": {
    "supportsProfiler": {
      "title": "Supports Profiler",
      "$ref": "../connectionBasicType.json#/definitions/supportsProfiler"
    }
  }
}
```

**Action:** Add this field to **all** connector connection schemas for your service type.

#### 1.5 Rebuild Schemas

After making schema changes:

```bash
cd openmetadata-spec
mvn clean install
```

This regenerates Java and TypeScript models.

---

### 2. Backend Changes (Java)

#### 2.1 Extend Entity Repository

**Location:** `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/<Entity>Repository.java`

**Required methods:**

```java
public static final String ENTITY_SAMPLE_DATA_EXTENSION = "entity.sampleData";

public Entity addSampleData(UUID entityId, TableData tableData) {
    Entity entity = find(entityId, NON_DELETED);

    // Validate columns exist in the entity
    if (entity.getColumns() != null) {
        for (String columnName : tableData.getColumns()) {
            validateColumn(entity.getColumns(), columnName);
        }
    }

    // Validate row structure
    for (List<Object> row : tableData.getRows()) {
        if (row.size() != tableData.getColumns().size()) {
            throw new IllegalArgumentException(
                String.format(
                    "Number of columns is %d but row has %d sample values",
                    tableData.getColumns().size(), row.size()));
        }
    }

    // Store in entity_extension table
    daoCollection
        .entityExtensionDAO()
        .insert(
            entityId,
            ENTITY_SAMPLE_DATA_EXTENSION,
            "tableData",
            JsonUtils.pojoToJson(tableData));

    setFieldsInternal(entity, Fields.EMPTY_FIELDS);
    return entity.withSampleData(tableData);
}

public Entity getSampleData(UUID entityId, boolean authorizePII) {
    Entity entity = find(entityId, NON_DELETED);
    TableData sampleData = JsonUtils.readValue(
        daoCollection
            .entityExtensionDAO()
            .getExtension(entity.getId(), ENTITY_SAMPLE_DATA_EXTENSION),
        TableData.class);
    entity.setSampleData(sampleData);
    setFieldsInternal(entity, Fields.EMPTY_FIELDS);

    // Apply PII masking if user doesn't have authorization
    if (!authorizePII && entity.getColumns() != null) {
        populateEntityFieldTags(
            entityType,
            entity.getColumns(),
            entity.getFullyQualifiedName(),
            true);
        entity.setTags(getTags(entity));
        return PIIMasker.getSampleData(entity);
    }

    return entity;
}

@Transaction
public Entity deleteSampleData(UUID entityId) {
    Entity entity = find(entityId, NON_DELETED);
    daoCollection.entityExtensionDAO().delete(entityId, ENTITY_SAMPLE_DATA_EXTENSION);
    setFieldsInternal(entity, Fields.EMPTY_FIELDS);
    return entity;
}
```

**Key points:**
- Sample data stored as extension (not in main entity table)
- Column validation ensures data integrity
- PII masking applied during retrieval based on authorization

#### 2.2 Update EntityRepository Base Class (if needed)

**Location:** `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java`

If `validateColumn` is entity-specific, refactor to accept `List<Column>`:

```java
public static void validateColumn(List<Column> columns, String columnName) {
    validateColumn(columns, columnName, Boolean.TRUE);
}

public static void validateColumn(
    List<Column> columns, String columnName, Boolean caseSensitive) {
    if (columns == null) {
        throw new IllegalArgumentException("Columns list cannot be null");
    }
    // ... validation logic
}
```

#### 2.3 Add REST API Endpoints

**Location:** `openmetadata-service/src/main/java/org/openmetadata/service/resources/<domain>/<Entity>Resource.java`

**Required endpoints:**

```java
@PUT
@Path("/{id}/sampleData")
@Operation(operationId = "addSampleData", summary = "Add sample data")
public Entity addSampleData(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @PathParam("id") UUID id,
    @Valid TableData tableData) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Entity entity = repository.addSampleData(id, tableData);
    return addHref(uriInfo, entity);
}

@GET
@Path("/{id}/sampleData")
@Operation(operationId = "getSampleData", summary = "Get sample data")
public Entity getSampleData(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @PathParam("id") UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_SAMPLE_DATA);
    ResourceContext<?> resourceContext = getResourceContextById(id);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    boolean authorizePII = authorizer.authorizePII(securityContext, resourceContext.getOwners());

    Entity entity = repository.getSampleData(id, authorizePII);
    return addHref(uriInfo, entity);
}

@DELETE
@Path("/{id}/sampleData")
@Operation(operationId = "deleteSampleData", summary = "Delete sample data")
public Entity deleteSampleData(
    @Context UriInfo uriInfo,
    @Context SecurityContext securityContext,
    @PathParam("id") UUID id) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_SAMPLE_DATA);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    Entity entity = repository.deleteSampleData(id);
    return addHref(uriInfo, entity);
}
```

**Update resource fields:**

```java
public static final String FIELDS =
    "...,sampleData";  // Add sampleData to fields list

@Override
public List<MetadataOperation> getOperations() {
    addViewOperation("sampleData", MetadataOperation.VIEW_SAMPLE_DATA);
    return listOf(MetadataOperation.VIEW_SAMPLE_DATA, MetadataOperation.EDIT_SAMPLE_DATA);
}
```

#### 2.4 Extend PII Masker

**Location:** `openmetadata-service/src/main/java/org/openmetadata/service/security/mask/PIIMasker.java`

**Add entity-specific masking:**

```java
public static Entity getSampleData(Entity entity) {
    if (entity.getColumns() != null) {
        TableData sampleData = maskSampleData(
            entity.getSampleData(),
            entity,
            entity.getColumns()
        );
        entity.setSampleData(sampleData);
    }
    return entity;
}

private static boolean hasPiiSensitiveTag(Entity entity) {
    return entity.getTags().stream()
        .map(TagLabel::getTagFQN)
        .anyMatch(SENSITIVE_PII_TAG::equals);
}
```

**Update `maskSampleData` method:**

```java
public static TableData maskSampleData(
    TableData sampleData, Object entity, List<Column> columns) {
    if (sampleData == null) {
        return null;
    }

    // Check if entity itself is marked as PII
    boolean entityHasPiiTag = false;
    if (entity instanceof Table) {
        entityHasPiiTag = hasPiiSensitiveTag((Table) entity);
    } else if (entity instanceof Container) {
        entityHasPiiTag = hasPiiSensitiveTag((Container) entity);
    } else if (entity instanceof Topic) {  // Your new entity
        entityHasPiiTag = hasPiiSensitiveTag((Topic) entity);
    }

    // ... rest of masking logic
}
```

#### 2.5 Update AutoClassificationBotPolicy

**Location:** `openmetadata-service/src/main/resources/json/data/policy/AutoClassificationBotPolicy.json`

**Add rule for new entity:**

```json
{
  "rules": [
    {
      "name": "AutoClassificationBotRule-Allow-Entity",
      "description": "Allow adding tags and sample data to entities",
      "resources": ["YourEntityType"],
      "operations": ["EditAll", "ViewAll"],
      "effect": "allow"
    }
  ]
}
```

#### 2.6 Create Database Migration

**Location:** `bootstrap/sql/migrations/native/<version>/mysql/postDataMigrationSQLScript.sql`

**Update bot policy in database:**

```sql
UPDATE policy_entity
SET json = JSON_INSERT(
    json,
    '$.rules[2]',
    JSON_OBJECT(
        'name', 'AutoClassificationBotRule-Allow-YourEntity',
        'description', 'Allow adding tags and sample data to your entities',
        'resources', JSON_ARRAY('YourEntityType'),
        'operations', JSON_ARRAY('EditAll', 'ViewAll'),
        'effect', 'allow'
    )
)
WHERE name = 'AutoClassificationBotPolicy';
```

**Repeat for PostgreSQL:** `bootstrap/sql/migrations/native/<version>/postgres/postDataMigrationSQLScript.sql`

---

### 3. Python Ingestion Changes

#### 3.1 Extend ClassifiableEntityType Union

**Location:** `ingestion/src/metadata/pii/types.py`

```python
from typing import Union
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic  # Your new entity

ClassifiableEntityType = Union[Table, Container, Topic]
```

#### 3.2 Update PII Processor

**Location:** `ingestion/src/metadata/pii/base_processor.py`

**Update `_get_entity_columns` method:**

```python
@staticmethod
def _get_entity_columns(entity) -> Optional[List[Column]]:
    """Get columns from a classifiable entity"""
    if isinstance(entity, Table):
        return entity.columns
    if isinstance(entity, Container):
        return entity.dataModel.columns if entity.dataModel else None
    if isinstance(entity, Topic):  # Your new entity
        return entity.messageSchema.schemaFields if entity.messageSchema else None
    return None
```

#### 3.3 Create Fetcher Strategy

**Location:** `ingestion/src/metadata/profiler/source/fetcher/fetcher_strategy.py`

**Add new strategy class:**

```python
class YourEntityFetcherStrategy(FetcherStrategy):
    """Fetcher strategy for YourEntity entities"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        global_profiler_config: Optional[Settings],
        status: Status,
    ) -> None:
        super().__init__(config, metadata, global_profiler_config, status)

    def _filter_entities(self, entities: Iterable[YourEntity]) -> Iterable[YourEntity]:
        """Filter entities based on configured patterns"""
        entity_filter_pattern = getattr(
            self.source_config, "entityFilterPattern", None
        )

        entities = [
            entity
            for entity in entities
            if (
                not entity_filter_pattern
                or not self._filter_by_pattern(entity)
            )
            and (
                not self.source_config.classificationFilterPattern
                or not self.filter_classifications(entity)
            )
            and entity.columns is not None  # Only entities with columns
        ]
        return entities

    def _get_entity_entities(self) -> Iterable[YourEntity]:
        """Get all entities from the service"""
        entities = self.metadata.list_all_entities(
            entity=YourEntity,
            fields=["columns", "tags"],  # Entity-specific fields
            params={
                "service": self.config.source.serviceName,
            },
        )
        return self._filter_entities(entities)

    def fetch(self) -> Iterator[Either[ProfilerSourceAndEntity]]:
        """Fetch entities from service"""
        try:
            profiler_source = profiler_source_factory.create(
                self.config.source.type.lower(),
                self.config,
                None,
                self.metadata,
                self.global_profiler_config,
            )

            for entity in self._get_entity_entities():
                yield Either(
                    left=None,
                    right=ProfilerSourceAndEntity(
                        profiler_source=profiler_source,
                        entity=entity,
                    ),
                )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=self.config.source.serviceName,
                    error=f"Error listing entities: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )
```

#### 3.4 Create Sampler Implementation

**Location:** `ingestion/src/metadata/sampler/<serviceType>/<connector>/sampler.py`

**Example structure (based on S3Sampler):**

```python
from metadata.sampler.<serviceType>.sampler import <ServiceType>Sampler

class YourConnectorSampler(<ServiceType>Sampler):
    """Sampler for YourConnector entities"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Initialize connector-specific clients

    def _read_sample_data_from_source(self, entity: YourEntity) -> pd.DataFrame:
        """Read sample data from the actual source system

        Returns:
            pd.DataFrame: Sample data with columns matching entity schema
        """
        # Connector-specific logic to:
        # 1. Connect to source system
        # 2. Read sample rows (up to self.sample_limit)
        # 3. Return as pandas DataFrame
        pass
```

**Base sampler (if needed):**

**Location:** `ingestion/src/metadata/sampler/<serviceType>/sampler.py`

```python
from abc import abstractmethod
from metadata.generated.schema.entity.data.yourEntity import YourEntity
from metadata.sampler.sampler_interface import SamplerInterface

class YourServiceSampler(SamplerInterface):
    """Base sampler for YourService entities"""

    @abstractmethod
    def _read_sample_data_from_source(self, entity: YourEntity) -> pd.DataFrame:
        """Read sample data from source - implemented by connectors"""
        pass

    def generate_sample_data(self) -> TableData:
        """Generate sample data using connector implementation"""
        if not isinstance(self.entity, YourEntity):
            raise ValueError(f"Expected YourEntity, got {type(self.entity)}")

        df = self._read_sample_data_from_source(self.entity)

        return TableData(
            columns=list(df.columns),
            rows=df.values.tolist()
        )
```

#### 3.5 Update Sampler Processor

**Location:** `ingestion/src/metadata/sampler/processor.py`

**Add entity type detection with fallback:**

```python
def __init__(self, config, metadata, profiler_config_class):
    # ... existing init code

    self._interface_type: str = config.source.type.lower()

    # Determine service type based on configuration
    # First try to detect based on pipeline config type
    if isinstance(self.source_config, StorageServiceAutoClassificationPipeline):
        self.service_type = ServiceType.Storage
    elif isinstance(self.source_config, MessagingServiceAutoClassificationPipeline):
        self.service_type = ServiceType.Messaging
    else:
        # Fallback: detect based on source type for non-database services
        # This handles cases where the package might not be fully updated
        storage_sources = ["s3", "gcs", "azuredatalake", "customstorage"]
        messaging_sources = ["kafka", "pulsar", "redpanda"]  # Example

        if self._interface_type in storage_sources:
            self.service_type = ServiceType.Storage
        elif self._interface_type in messaging_sources:
            self.service_type = ServiceType.Messaging
        else:
            self.service_type = ServiceType.Database

    # Add logging to help debug service type detection issues
    profiler_logger.info(
        f"Sampler processor initialized with service_type={self.service_type}, "
        f"source_config_type={type(self.source_config).__name__}, "
        f"interface_type={self._interface_type}"
    )
```

**Why the fallback is important:** In environments like Airflow where the ingestion package might be cached or not fully updated, the isinstance check for the new pipeline config type can fail. The fallback ensures the correct service type is detected based on the source connector name.

**Add entity processing method:**

```python
def _run(self, record: ProfilerSourceAndEntity) -> Either[SamplerResponse]:
    """Fetch the sample data and pass it down the pipeline"""
    entity = record.entity

    if isinstance(entity, Table):
        if not entity.columns:
            logger.warning("Skipping sampler: no columns found")
            return Either()
        return self._run_for_table(entity, record)

    if isinstance(entity, Container):
        if not entity.dataModel or not entity.dataModel.columns:
            logger.warning("Skipping sampler: no columns found")
            return Either()
        return self._run_for_container(entity, record)

    if isinstance(entity, YourEntity):  # Your new entity
        if not entity.columns:  # Adjust based on your entity structure
            logger.warning("Skipping sampler: no columns found")
            return Either()
        return self._run_for_your_entity(entity, record)

    return Either(
        left=StackTraceError(
            name=record.entity.fullyQualifiedName.root,
            error=f"Unsupported entity type {type(entity).__name__}",
            stackTrace=traceback.format_exc(),
        )
    )

def _run_for_your_entity(
    self, entity: YourEntity, record: ProfilerSourceAndEntity
) -> Either[SamplerResponse]:
    """Process YourEntity for sampling"""
    service_conn_config = self._copy_service_config(self.config, None)

    sampler_interface: SamplerInterface = self.sampler_class.create(
        service_connection_config=service_conn_config,
        ometa_client=self.metadata,
        entity=entity,
        schema_entity=None,
        database_entity=None,
        table_config=None,
        default_sample_config=SampleConfig(),
        default_sample_data_count=self.source_config.sampleDataCount,
    )

    sample_data = SampleData(
        data=sampler_interface.generate_sample_data(),
        store=self.source_config.storeSampleData,
    )
    sampler_interface.close()

    return Either(
        right=SamplerResponse(
            entity=entity,
            sample_data=sample_data,
        )
    )
```

#### 3.6 Add OpenMetadata API Mixin

**Location:** `ingestion/src/metadata/ingestion/ometa/mixins/<entity>_mixin.py`

```python
from metadata.generated.schema.api.data.createYourEntity import CreateYourEntityRequest
from metadata.generated.schema.entity.data.yourEntity import YourEntity
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

class OMetaYourEntityMixin:
    """Mixin for YourEntity-specific OpenMetadata API operations"""

    client: REST

    def ingest_entity_sample_data(
        self,
        entity: YourEntity,
        sample_data: TableData,
    ) -> YourEntity:
        """Ingest sample data for an entity

        Args:
            entity: The entity to add sample data to
            sample_data: The sample data to ingest

        Returns:
            Updated entity with sample data
        """
        try:
            resp = self.client.put(
                f"{self.get_suffix(YourEntity)}/{entity.id}/sampleData",
                data=sample_data.model_dump_json(),
            )
            return YourEntity(**resp)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to ingest sample data for [{entity.fullyQualifiedName.root}]: {exc}"
            )
            return entity
```

**Register mixin in OMetaAPI:**

**Location:** `ingestion/src/metadata/ingestion/ometa/ometa_api.py`

```python
from metadata.ingestion.ometa.mixins.entity_mixin import OMetaYourEntityMixin

class OpenMetadata(
    ...,
    OMetaYourEntityMixin,
):
    pass
```

#### 3.7 Update Metadata Sink

**Location:** `ingestion/src/metadata/ingestion/sink/metadata_rest.py`

**Add sink handling for new entity:**

```python
def write_record(self, record: SamplerResponse) -> None:
    entity = record.entity

    if isinstance(entity, YourEntity):
        self._write_entity_sample_data(entity, record)
    elif isinstance(entity, Table):
        self._write_table_sample_data(entity, record)
    # ... other entity types

def _write_entity_sample_data(
    self, entity: YourEntity, record: SamplerResponse
) -> None:
    """Write sample data and tags for YourEntity"""
    if record.sample_data and record.sample_data.store:
        self.metadata.ingest_entity_sample_data(
            entity=entity,
            sample_data=record.sample_data.data,
        )

    if record.column_tags:
        self.metadata.patch_tags(
            entity=entity,
            tag_labels=record.column_tags,
        )
```

#### 3.8 Register Sampler in Service Spec

**Location:** `ingestion/src/metadata/ingestion/source/<serviceType>/<connector>/service_spec.py`

```python
from metadata.ingestion.source.<serviceType>.<connector>.metadata import YourSource
from metadata.sampler.<serviceType>.<connector>.sampler import YourSampler
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=YourSource,
    sampler_class=YourSampler
)
```

---

### 4. Frontend Changes (TypeScript/React)

#### 4.1 Add Sample Data API Methods

**Location:** `openmetadata-ui/src/main/resources/ui/src/rest/<entity>API.ts`

Add API methods for sample data operations:

```typescript
export const getSampleDataByEntityId = async (id: string) => {
  const response = await APIClient.get<YourEntity>(`${BASE_URL}/${id}/sampleData`);
  return response.data;
};

export const deleteSampleDataByEntityId = async (id: string) => {
  return await APIClient.delete<YourEntity>(`${BASE_URL}/${id}/sampleData`);
};
```

**Example (Container):**
```typescript
// openmetadata-ui/src/main/resources/ui/src/rest/storageAPI.ts
export const getSampleDataByContainerId = async (id: string) => {
  const response = await APIClient.get<Container>(`${BASE_URL}/${id}/sampleData`);
  return response.data;
};

export const deleteSampleDataByContainerId = async (id: string) => {
  return await APIClient.delete<Container>(`${BASE_URL}/${id}/sampleData`);
};
```

#### 4.2 Update SampleDataTable Component to Support Multiple Entity Types

**Location:** `openmetadata-ui/src/main/resources/ui/src/components/Database/SampleDataTable/SampleData.interface.ts`

Add `entityType` parameter to the props interface:

```typescript
export interface SampleDataProps {
  isTableDeleted?: boolean;
  tableId: string;
  owners: EntityReference[];
  permissions: OperationPermission;
  entityType?: EntityType.TABLE | EntityType.YOUR_ENTITY;
}
```

**Location:** `openmetadata-ui/src/main/resources/ui/src/components/Database/SampleDataTable/SampleDataTable.component.tsx`

Update the component to handle multiple entity types:

```typescript
import { EntityType } from '../../../enums/entity.enum';
import { YourEntity } from '../../../generated/entity/data/yourEntity';
import { Table } from '../../../generated/entity/data/table';
import {
  deleteSampleDataByEntityId,
  getSampleDataByEntityId,
} from '../../../rest/yourEntityAPI';
import {
  deleteSampleDataByTableId,
  getSampleDataByTableId,
} from '../../../rest/tableAPI';

const SampleDataTable: FC<SampleDataProps> = ({
  isTableDeleted,
  tableId,
  owners,
  permissions,
  entityType = EntityType.TABLE,
}) => {
  // Update getSampleDataWithType to handle multiple entity types
  const getSampleDataWithType = (entity: Table | YourEntity) => {
    const { sampleData } = entity;
    // Get columns based on entity type
    const columns =
      'columns' in entity
        ? entity.columns  // Table
        : entity.yourFieldWithColumns?.columns ?? [];  // YourEntity

    // ... rest of the logic remains the same
  };

  // Update fetchSampleData to use correct API based on entity type
  const fetchSampleData = async () => {
    try {
      const entityData =
        entityType === EntityType.YOUR_ENTITY
          ? await getSampleDataByEntityId(tableId)
          : await getSampleDataByTableId(tableId);
      setSampleData(getSampleDataWithType(entityData));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  // Update handleDeleteSampleData similarly
  const handleDeleteSampleData = async () => {
    try {
      if (entityType === EntityType.YOUR_ENTITY) {
        await deleteSampleDataByEntityId(tableId);
      } else {
        await deleteSampleDataByTableId(tableId);
      }
      handleDeleteModal();
      fetchSampleData();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
};
```

#### 4.3 Add SAMPLE_DATA Tab to Entity Detail Page

**Location:** `openmetadata-ui/src/main/resources/ui/src/utils/<Entity>DetailsClassBase.ts`

Add `viewSampleDataPermission` and `entityPermissions` to the interface:

```typescript
export interface EntityDetailPageTabProps {
  // ... existing props
  viewSampleDataPermission: boolean;
  entityPermissions: OperationPermission;
  entityData?: YourEntity;
  // ... rest of props
}
```

Add SAMPLE_DATA to the tab IDs list:

```typescript
public getEntityDetailPageTabsIds(): Tab[] {
  return [
    EntityTabs.SCHEMA,
    EntityTabs.SAMPLE_DATA,  // Add this
    EntityTabs.ACTIVITY_FEED,
    // ... other tabs
  ].map((tab: EntityTabs) => ({
    id: tab,
    name: tab,
    displayName: getTabLabelFromId(tab),
    layout: this.getDefaultLayout(tab),
    editable: tab === EntityTabs.SCHEMA,
  }));
}
```

**Location:** `openmetadata-ui/src/main/resources/ui/src/utils/<Entity>DetailUtils.tsx`

Import required components:

```typescript
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import SampleDataTableComponent from '../components/Database/SampleDataTable/SampleDataTable.component';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
```

Add SAMPLE_DATA tab in the tabs array (only if entity has schema/columns):

```typescript
export const getEntityDetailPageTabs = ({
  // ... props destructured
  viewSampleDataPermission,
  entityPermissions,
  entityData,
}: EntityDetailPageTabProps) => {
  return [
    // ... existing tabs (SCHEMA, etc.)

    // Add SAMPLE_DATA tab conditionally
    ...(!isSchemaEmpty  // Only show if entity has columns
      ? [
          {
            label: (
              <TabsLabel
                id={EntityTabs.SAMPLE_DATA}
                name={get(
                  labelMap,
                  EntityTabs.SAMPLE_DATA,
                  t('label.sample-data')
                )}
              />
            ),
            key: EntityTabs.SAMPLE_DATA,
            children: !viewSampleDataPermission ? (
              <ErrorPlaceHolder
                className="border-none"
                permissionValue={t('label.view-entity', {
                  entity: t('label.sample-data'),
                })}
                type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
              />
            ) : (
              <SampleDataTableComponent
                entityType={EntityType.YOUR_ENTITY}
                isTableDeleted={deleted}
                owners={entityData?.owners ?? []}
                permissions={entityPermissions}
                tableId={entityData?.id ?? ''}
              />
            ),
          },
        ]
      : []),

    // ... rest of tabs (ACTIVITY_FEED, LINEAGE, etc.)
  ];
};
```

#### 4.4 Update Entity Page to Pass Sample Data Permission

**Location:** `openmetadata-ui/src/main/resources/ui/src/pages/<Entity>Page/<Entity>Page.tsx`

Add `viewSampleDataPermission` to permissions useMemo:

```typescript
const {
  editCustomAttributePermission,
  editLineagePermission,
  viewBasicPermission,
  viewAllPermission,
  viewCustomPropertiesPermission,
  viewSampleDataPermission,  // Add this
} = useMemo(
  () => ({
    // ... existing permissions
    viewSampleDataPermission: getPrioritizedViewPermission(
      entityPermissions,
      Operation.ViewSampleData
    ),
  }),
  [entityPermissions, deleted]
);
```

Pass the permission to tabs:

```typescript
const tabs = useMemo(() => {
  const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

  const tabs = entityDetailsClassBase.getEntityDetailPageTabs({
    // ... existing props
    viewSampleDataPermission,
    entityPermissions,
    entityData,
    // ... rest
  });

  return getDetailsTabWithNewLabel(tabs, customizedPage?.tabs, EntityTabs.SCHEMA);
}, [
  // ... existing dependencies
  viewSampleDataPermission,
  entityPermissions,
  entityData,
]);
```

#### 4.5 Import Generated Schema for Ingestion Pipeline

**Location:** `openmetadata-ui/src/main/resources/ui/src/utils/IngestionWorkflowUtils.ts`

```typescript
import yourServiceAutoClassificationPipeline from '../jsons/ingestionSchemas/yourServiceAutoClassificationPipeline.json';
```

#### 4.6 Add Schema Routing Logic

**Location:** `openmetadata-ui/src/main/resources/ui/src/utils/IngestionWorkflowUtils.ts`

Find the function that maps service categories to schemas (e.g., `getAutoClassificationSchemaByServiceCategory`):

```typescript
export const getAutoClassificationSchemaByServiceCategory = (
  serviceCategory: ServiceCategory
): RJSFSchema => {
  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES:
      return databaseAutoClassificationPipeline as RJSFSchema;
    case ServiceCategory.STORAGE_SERVICES:
      return storageAutoClassificationPipeline as RJSFSchema;
    case ServiceCategory.MESSAGING_SERVICES:  // Your new service
      return messagingAutoClassificationPipeline as RJSFSchema;
    default:
      return databaseAutoClassificationPipeline as RJSFSchema;
  }
};
```

#### 4.7 Verify Pipeline Type Filtering

**Location:** `openmetadata-ui/src/main/resources/ui/src/utils/IngestionUtils.ts`

Ensure your service category supports the AutoClassification pipeline type:

```typescript
export const getSupportedPipelineTypes = (
  serviceDetails: ServiceData,
  serviceCategory: ServiceCategory
): PipelineType[] => {
  const connectionConfig = serviceDetails.connection?.config;

  const pipelineTypes: PipelineType[] = [];

  // Metadata ingestion
  if (connectionConfig?.supportsMetadataExtraction) {
    pipelineTypes.push(PipelineType.Metadata);
  }

  // Auto-classification (profiler support)
  if (connectionConfig?.supportsProfiler) {
    pipelineTypes.push(PipelineType.AutoClassification);
  }

  return pipelineTypes;
};
```

---

### 5. Testing

#### 5.1 Python Unit Tests

**Location:** `ingestion/tests/unit/<domain>/test_<entity>_fetcher.py`

**Test fetcher strategy:**

```python
from metadata.profiler.source.fetcher.fetcher_strategy import YourEntityFetcherStrategy

class TestYourEntityFetcher:
    def test_filter_entities_with_pattern(self):
        """Test entity filtering with inclusion/exclusion patterns"""
        # Setup config with filter pattern
        # Create mock entities
        # Assert filtered results match expectations

    def test_filter_entities_without_columns(self):
        """Test that entities without columns are filtered out"""
        # Create entity without columns
        # Assert it's filtered out
```

**Location:** `ingestion/tests/unit/sampler/test_<entity>_sampler_processor.py`

**Test sampler processor:**

```python
class TestYourEntitySamplerProcessor:
    def test_process_entity_with_columns(self):
        """Test processing entity with valid column schema"""
        # Create entity with columns
        # Mock sampler to return sample data
        # Assert SamplerResponse contains expected data

    def test_skip_entity_without_columns(self):
        """Test that entities without columns are skipped"""
        # Create entity without columns
        # Assert processor returns Empty Either
```

#### 5.2 Python Integration Tests

**Location:** `ingestion/tests/integration/auto_classification/<entities>/test_<entity>_classification.py`

**Test end-to-end classification:**

```python
class TestYourEntityClassification:
    @pytest.fixture
    def setup_service(self):
        """Setup test service with sample data"""
        # 1. Create test service
        # 2. Create test entities with known PII data
        # 3. Yield for test execution
        # 4. Cleanup

    def test_classification_detects_pii(self, setup_service):
        """Test that PII is correctly detected and tagged"""
        # Run classification workflow
        # Assert PII tags are applied to correct columns

    def test_sample_data_storage(self, setup_service):
        """Test sample data is stored when configured"""
        # Run workflow with storeSampleData=true
        # Retrieve entity via API
        # Assert sampleData field is populated

    def test_pii_masking(self, setup_service):
        """Test PII masking for unauthorized users"""
        # Create entity with PII tags
        # Retrieve as unauthorized user
        # Assert sensitive values are masked
```

**Location:** `ingestion/tests/integration/auto_classification/<entities>/conftest.py`

**Setup test fixtures:**

```python
@pytest.fixture(scope="module")
def create_test_service():
    """Create test service with sample entities"""
    # Setup service
    # Create entities
    yield
    # Cleanup
```

#### 5.3 Java Integration Tests

**Location:** `openmetadata-service/src/test/java/org/openmetadata/service/resources/<domain>/<Entity>ResourceTest.java`

**Test sample data endpoints:**

```java
@Test
void test_addSampleData() {
    Entity entity = createEntity(createRequest("test"), ADMIN_AUTH_HEADERS);

    TableData sampleData = new TableData()
        .withColumns(List.of("col1", "col2"))
        .withRows(List.of(
            List.of("value1", "value2"),
            List.of("value3", "value4")
        ));

    Entity updated = addSampleData(entity.getId(), sampleData, ADMIN_AUTH_HEADERS);
    assertEquals(sampleData, updated.getSampleData());
}

@Test
void test_getSampleData_withPIIMasking() {
    // Create entity with PII tags
    // Add sample data
    // Retrieve as user without PII access
    // Assert data is masked
}

@Test
void test_deleteSampleData() {
    // Create entity
    // Add sample data
    // Delete sample data
    // Assert sample data is null
}
```

---

## Validation Checklist

Before submitting your PR, verify:

### Schema Layer
- [ ] Entity schema includes `sampleData` field
- [ ] Auto-classification pipeline schema created for service type
- [ ] Pipeline schema registered in `workflow.json`
- [ ] All connector connection schemas include `supportsProfiler`
- [ ] Schemas rebuilt with `mvn clean install` in `openmetadata-spec/`

### Backend (Java)
- [ ] Repository implements `addSampleData`, `getSampleData`, `deleteSampleData`
- [ ] Resource exposes REST endpoints for sample data operations
- [ ] Resource includes `sampleData` in fields list
- [ ] Resource declares `VIEW_SAMPLE_DATA` and `EDIT_SAMPLE_DATA` operations
- [ ] PIIMasker extended to support new entity type
- [ ] AutoClassificationBotPolicy includes new entity
- [ ] Database migration updates bot policy
- [ ] Java code formatted with `mvn spotless:apply`

### Ingestion (Python)
- [ ] `ClassifiableEntityType` union includes new entity
- [ ] PII processor's `_get_entity_columns` handles new entity
- [ ] Fetcher strategy created for service type
- [ ] Sampler implementation created for connector(s)
- [ ] Sampler processor updated with entity type detection
- [ ] Sampler processor includes `_run_for_your_entity` method
- [ ] OMetaMixin created for sample data ingestion
- [ ] Mixin registered in `OpenMetadata` class
- [ ] Metadata sink handles new entity type
- [ ] Service spec registers sampler class
- [ ] Code formatted with `make py_format`
- [ ] Type checks pass with `make static-checks`

### Frontend (TypeScript)
- [ ] Sample data API methods added to `<entity>API.ts` (GET and DELETE `/sampleData`)
- [ ] `SampleDataTable.interface.ts` updated with `entityType` prop
- [ ] `SampleDataTable.component.tsx` updated to support multiple entity types
- [ ] `<Entity>DetailsClassBase.ts` includes `viewSampleDataPermission` in interface
- [ ] `<Entity>DetailsClassBase.ts` includes `SAMPLE_DATA` in tab IDs list
- [ ] `<Entity>DetailUtils.tsx` imports `SampleDataTableComponent` and error placeholder
- [ ] `<Entity>DetailUtils.tsx` adds SAMPLE_DATA tab with permission check
- [ ] `<Entity>DetailUtils.tsx` passes `entityType` prop to `SampleDataTableComponent`
- [ ] `<Entity>Page.tsx` computes `viewSampleDataPermission` from `Operation.ViewSampleData`
- [ ] `<Entity>Page.tsx` passes `viewSampleDataPermission` to tabs function
- [ ] `<Entity>Page.tsx` passes entity permissions and data to tabs function
- [ ] Schema imported in `IngestionWorkflowUtils.ts`
- [ ] Schema routing logic added for service category
- [ ] Pipeline type filtering supports AutoClassification
- [ ] Generated TypeScript models committed

### Testing
- [ ] Unit tests for fetcher strategy
- [ ] Unit tests for sampler processor
- [ ] Integration tests for end-to-end classification
- [ ] Java integration tests for REST endpoints
- [ ] Tests verify PII masking behavior
- [ ] All tests pass

---

## Common Pitfalls

1. **Forgetting to rebuild schemas**: After changing JSON schemas, always run `mvn clean install` in `openmetadata-spec/`

2. **Inconsistent column access patterns**: Different entities store columns differently:
   - `Table`: `entity.columns`
   - `Container`: `entity.dataModel.columns`
   - `Topic`: `entity.messageSchema.schemaFields`

   Update ALL places that access columns (PII processor, sampler, fetcher).

3. **Missing service type detection**: Sampler processor must detect the correct `ServiceType` based on pipeline config to load the right sampler class.

4. **Incomplete filter patterns**: Each service type needs entity-specific filters (e.g., `bucketFilterPattern`, `topicFilterPattern`). Don't just copy database patterns.

5. **Authorization gaps**: Always check both operations:
   - `VIEW_SAMPLE_DATA`: Controls visibility of sample data
   - `EDIT_SAMPLE_DATA`: Controls ability to add/delete sample data

6. **Frontend schema resolution**: Connection schemas must use `supportsProfiler` for the UI to show auto-classification option.

7. **PII masking logic**: Ensure `maskSampleData` handles both entity-level and column-level PII tags.

8. **`storeSampleData` defaults to `false`**: Sample data will NOT be ingested unless `storeSampleData: true` is explicitly set in the pipeline configuration. This is by design to avoid storing potentially large sample datasets by default. The sink only ingests sample data when `record.sample_data.store` is true.

9. **Service type detection in cached environments**: If you see errors like `No module named 'metadata.ingestion.source.database.gcs'`, the service type detection failed. The system tried to load a database sampler for a storage service. Ensure the fallback pattern is implemented in the sampler processor (see section 3.5).

---

## Troubleshooting

### Sample Data Not Appearing

**Symptom:** GET `/api/v1/<entities>/{id}/sampleData` returns empty or the entity without `sampleData` field.

**Possible causes:**

1. **`storeSampleData` is disabled**: Check your pipeline configuration. The default is `false`.
   ```bash
   # Check pipeline config
   http GET http://localhost:8585/api/v1/services/ingestionPipelines/{pipeline-id}

   # Look for:
   "sourceConfig": {
     "config": {
       "storeSampleData": false  # <- This must be true!
     }
   }
   ```

2. **Sample data not in database**: Check the `entity_extension` table:
   ```sql
   SELECT id, extension, jsonSchema
   FROM entity_extension
   WHERE extension = '<entity>.sampleData'
   LIMIT 10;
   ```

   If no rows exist, sample data was never ingested. Check workflow logs for errors.

3. **Workflow didn't run or failed**: Check ingestion pipeline execution logs for errors during sampling or PII detection.

4. **Service type detection failed**: Look for import errors in logs like:
   ```
   Cannot import metadata.ingestion.source.database.<connector>
   ```
   This means the sampler processor detected the wrong service type. Verify the fallback logic is present.

### Module Import Errors

**Symptom:** `DynamicImportException: Cannot import metadata.ingestion.source.database.<connector>`

**Cause:** The sampler processor detected `ServiceType.Database` instead of the correct service type (e.g., `ServiceType.Storage`).

**Solution:**
1. Verify the isinstance checks in sampler processor `__init__` include your pipeline config type
2. Add your source type to the fallback list (e.g., add `"myconnector"` to `storage_sources` list)
3. Check logs for "Sampler processor initialized" message showing wrong service_type

### PII Tags Not Applied

**Symptom:** Sample data is ingested but no PII tags appear on columns.

**Possible causes:**

1. **`enableAutoClassification` is disabled**: Check pipeline config has `enableAutoClassification: true`

2. **Confidence threshold too high**: Lower the `confidence` value in pipeline config (default is 80)

3. **Sample data count too low**: Increase `sampleDataCount` for better PII detection accuracy

4. **Column name mismatch**: Verify column names in sample data match entity column definitions exactly

---

## Reference Implementation

For a complete reference, see [PR #26495: Container Auto-Classification Support](https://github.com/open-metadata/OpenMetadata/pull/26495)

Key commits:
1. Schema changes (entity, pipeline config, workflow registration)
2. Backend support (repository, resource, PII masking, policy)
3. Type system extension (ClassifiableEntityType union)
4. Python ingestion (fetcher, sampler, processor, sink)
5. Frontend routing (schema import and service category mapping)
6. Integration tests (end-to-end classification workflow)

---

## Getting Help

If you encounter issues:

1. Review existing implementations: `Table`, `Container`
2. Check type definitions in `ingestion/src/metadata/pii/types.py`
3. Examine sampler interface: `ingestion/src/metadata/sampler/sampler_interface.py`
4. Review fetcher strategies: `ingestion/src/metadata/profiler/source/fetcher/fetcher_strategy.py`

For questions, reach out on the OpenMetadata Slack community.

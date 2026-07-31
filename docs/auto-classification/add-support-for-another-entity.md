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

#### 3.2 Register Entity Adapter

**Location:** `ingestion/src/metadata/sampler/entity_adapters.py`

This is the single source of truth for all per-entity-type knowledge. Adding a new entity means adding one adapter class decorated with `@register_adapter` — no manual dict wiring and no other ingestion files need to change.

```python
from typing import ClassVar

from metadata.generated.schema.entity.data.your_entity import YourEntity
from metadata.generated.schema.metadataIngestion.yourServiceAutoClassificationPipeline import (
    YourServiceAutoClassificationPipeline,
)

@register_adapter(entity=YourEntity, pipeline=YourServiceAutoClassificationPipeline)
class YourEntityAdapter(EntityAdapter):
    pipeline_config_class = YourServiceAutoClassificationPipeline
    service_type = ServiceType.YourServiceType
    patch_fields: ClassVar[list[str]] = ["tags", "<field-that-holds-columns>"]

    def get_columns(self, entity: YourEntity) -> list[Column] | None:
        # Return the list of columns/fields on the entity, or None if unavailable
        return entity.your_column_field

    def set_columns(self, entity: YourEntity, columns) -> None:
        entity.your_column_field = columns

    def build_sampler_kwargs(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        entity: YourEntity,
        profiler_config,
        source_config,
    ) -> dict | None:
        return {
            "service_connection_config": deepcopy(config.source.serviceConnection.root.config),
            "ometa_client": metadata,
            "entity": entity,
            "config": SamplerConfig(
                sample_data_count=source_config.sampleDataCount,
            ),
        }
```

The `@register_adapter` decorator instantiates the adapter once and wires it into both the entity-type and pipeline-config lookup tables automatically.

**What this buys you:** `sampler/processor.py`, `pii/base_processor.py`, `ometa/mixins/patch_mixin.py`, and `ingestion/sink/metadata_rest.py` (column tag path) all pick up the new entity automatically — zero changes required in those files. The only sink change needed is registering a `_ingest_entity_sample_data` handler (step 3.7).

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

**No `create()` override needed:** `SamplerInterface.create()` is now a pure constructor that simply forwards its arguments to `__init__()`. Non-database samplers inherit it as-is — no override required.

#### 3.5 Update Sampler Processor — No Changes Required

`ingestion/src/metadata/sampler/processor.py` does **not** need to change. It resolves the service type and dispatches via the adapter registry:

```python
# __init__ — picks up the new pipeline config class automatically:
_adapter = adapter_for_pipeline(self.source_config)  # finds TopicAdapter
self.service_type = _adapter.service_type             # ServiceType.Messaging

# _run — picks up the new entity class automatically:
adapter = adapter_for(entity)                         # finds TopicAdapter
sampler_kwargs = adapter.build_sampler_kwargs(...)    # returns pre-resolved sampling values
```

Config resolution (partition_details, sample_query, include/exclude columns, sample_config, sample_data_count) now happens inside `build_sampler_kwargs()`, so `SamplerInterface.create()` receives already-resolved values ready to initialize the sampler.

The only file to change is `entity_adapters.py` (step 3.2).

#### 3.6 Add OpenMetadata API Mixin

The mixin covers **sample data ingestion only** — column tag patching is fully adapter-driven and requires no mixin changes.

**Location:** `ingestion/src/metadata/ingestion/ometa/mixins/<entity>_mixin.py`

```python
from metadata.generated.schema.entity.data.yourEntity import YourEntity
from metadata.generated.schema.type.table import TableData
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

class OMetaYourEntityMixin:
    """Mixin for YourEntity sample data API operations"""

    client: REST

    def ingest_your_entity_sample_data(
        self,
        entity: YourEntity,
        sample_data: TableData,
    ) -> YourEntity:
        try:
            resp = self.client.put(
                f"{self.get_suffix(YourEntity)}/{entity.id}/sampleData",
                data=sample_data.model_dump_json(),
            )
            return YourEntity(**resp)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Failed to ingest sample data for [%s]: %s",
                entity.fullyQualifiedName.root,
                exc,
            )
            return entity
```

**Register mixin in OMetaAPI:**

**Location:** `ingestion/src/metadata/ingestion/ometa/ometa_api.py`

```python
from metadata.ingestion.ometa.mixins.your_entity_mixin import OMetaYourEntityMixin

class OpenMetadata(
    ...,
    OMetaYourEntityMixin,
):
    pass
```

#### 3.7 Update Metadata Sink

**Location:** `ingestion/src/metadata/ingestion/sink/metadata_rest.py`

Column tag patching (`patch_column_tags`) is fully adapter-driven — `write_sampler_response` calls it directly for any entity type and no changes are needed there.

For **sample data storage**, the sink uses a `@singledispatchmethod`. Add one `@register` for your entity type:

```python
@_ingest_entity_sample_data.register
def _(self, entity: YourEntity, sample_data: TableData) -> bool:
    result = self.metadata.ingest_your_entity_sample_data(
        entity=entity, sample_data=sample_data
    )
    if result:
        logger.debug(
            "Successfully ingested sample data for %s",
            entity.fullyQualifiedName.root,
        )
        return True
    return False
```

`write_sampler_response` itself needs no changes — it calls `_ingest_entity_sample_data` and `patch_column_tags` generically for all entity types.

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
- [ ] `ClassifiableEntityType` union in `pii/types.py` includes new entity
- [ ] `EntityAdapter` subclass added in `sampler/entity_adapters.py` with correct `pipeline_config_class`, `service_type`, `patch_fields`, `get_columns`, `set_columns`, `build_sampler_kwargs`
- [ ] `build_sampler_kwargs` returns pre-resolved sampling values (`sample_config`, `sample_data_count`, etc.) — do NOT include `schema_entity`, `database_entity`, or `table_config` for non-database entities; those are database-specific and no longer part of `SamplerInterface.create()`
- [ ] New adapter registered in `_BY_ENTITY` and `_BY_PIPELINE` dicts in `entity_adapters.py`
- [ ] Fetcher strategy created for service type
- [ ] Sampler implementation created for connector(s)
- [ ] OMetaMixin created for sample data ingestion (`ingest_your_entity_sample_data`)
- [ ] Mixin registered in `OpenMetadata` class
- [ ] `_ingest_entity_sample_data` `@register` added for new entity type in `metadata_rest.py`
- [ ] Service spec registers sampler class
- [ ] `workflow/classification.py` isinstance tuple extended with new pipeline config class
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

   Define `get_columns` and `set_columns` correctly in your adapter — that is the only place this logic lives. The PII processor, sampler processor, and patch mixin all delegate to the adapter automatically.

3. **Missing service type detection**: The sampler processor looks up the `ServiceType` via `adapter_for_pipeline(source_config)`. If your new `pipeline_config_class` is not registered in `_BY_PIPELINE` in `entity_adapters.py`, the processor will raise a `ValueError` at startup. Register it before testing.

4. **Incomplete filter patterns**: Each service type needs entity-specific filters (e.g., `bucketFilterPattern`, `topicFilterPattern`). Don't just copy database patterns.

5. **Authorization gaps**: Always check both operations:
   - `VIEW_SAMPLE_DATA`: Controls visibility of sample data
   - `EDIT_SAMPLE_DATA`: Controls ability to add/delete sample data

6. **Frontend schema resolution**: Connection schemas must use `supportsProfiler` for the UI to show auto-classification option.

7. **PII masking logic**: Ensure `maskSampleData` handles both entity-level and column-level PII tags.

8. **`storeSampleData` defaults to `false`**: Sample data will NOT be ingested unless `storeSampleData: true` is explicitly set in the pipeline configuration. This is by design to avoid storing potentially large sample datasets by default. The sink only ingests sample data when `record.sample_data.store` is true.

9. **Service type not found at startup**: If you see `ValueError: Could not determine service type from config`, the pipeline config class is not registered in `_BY_PIPELINE` in `entity_adapters.py`. Register it there — the sampler processor does not need any code changes.

10. **Sample data not dispatched in sink**: `_ingest_entity_sample_data` in `metadata_rest.py` uses `@singledispatchmethod`. If you forget to add a `@register` for your entity type, calling it raises `NotImplementedError` and sample data is silently skipped. The column tag path (`patch_column_tags`) is fully adapter-driven and needs no sink changes — but sample data storage does require its own `@register`.

11. **Passing `schema_entity=None` explicitly in non-database adapters:** `SamplerInterface.create()` no longer accepts `schema_entity`, `database_entity`, or `table_config`. These were removed from the interface entirely. Non-database adapters should return already-resolved values (`sample_config`, `sample_data_count`, `partition_details`, etc.) directly in `build_sampler_kwargs()` — not the database hierarchy params.

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
   This means the adapter registry resolved the wrong service type. Verify your pipeline config class is registered in `_BY_PIPELINE` in `sampler/entity_adapters.py` with the correct `service_type`.

### Module Import Errors

**Symptom:** `DynamicImportException: Cannot import metadata.ingestion.source.database.<connector>`

**Cause:** The sampler processor resolved `ServiceType.Database` instead of the correct service type (e.g., `ServiceType.Storage`). This means `adapter_for_pipeline(source_config)` returned `None` or the wrong adapter.

**Solution:**
1. Verify your new `pipeline_config_class` is registered in `_BY_PIPELINE` in `ingestion/src/metadata/sampler/entity_adapters.py`
2. Check that the adapter's `service_type` field is set to the correct `ServiceType`
3. Confirm the pipeline schema is listed in `workflow.json` so it's properly deserialized from config

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

1. Review existing adapter implementations: `TableAdapter`, `ContainerAdapter` in `ingestion/src/metadata/sampler/entity_adapters.py`
2. Check type definitions in `ingestion/src/metadata/pii/types.py`
3. Examine sampler interface: `ingestion/src/metadata/sampler/sampler_interface.py`
4. Review fetcher strategies: `ingestion/src/metadata/profiler/source/fetcher/fetcher_strategy.py`

For questions, reach out on the OpenMetadata Slack community.

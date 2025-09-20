# OpenMetadata SDK

A modern Java SDK for OpenMetadata that provides a fluent API for all operations.

## Installation

Add the OpenMetadata SDK to your project:

```xml
<dependency>
  <groupId>org.open-metadata</groupId>
  <artifactId>openmetadata-sdk</artifactId>
  <version>1.5.0-SNAPSHOT</version>
</dependency>
```

## Quick Start

### Initialize the SDK

```java
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.entities.*;
import org.openmetadata.sdk.api.*;

// Configure the client
OpenMetadataConfig config = OpenMetadataConfig.builder()
    .serverUrl("http://localhost:8585")
    .apiKey("your-api-key")
    .build();

// Initialize the client
OpenMetadataClient.initialize(config);

// Set default client for static APIs
Table.setDefaultClient(OpenMetadataClient.getInstance());
User.setDefaultClient(OpenMetadataClient.getInstance());
Search.setDefaultClient(OpenMetadataClient.getInstance());
Lineage.setDefaultClient(OpenMetadataClient.getInstance());
Bulk.setDefaultClient(OpenMetadataClient.getInstance());
```

## Entity Operations

### Tables

```java
// Create a table
CreateTable request = new CreateTable()
    .withName("my_table")
    .withDatabase("my_database")
    .withColumns(columns);
Table table = Table.create(request);

// Retrieve a table by ID
Table table = Table.retrieve("table-id");

// Retrieve by fully qualified name with specific fields
Table table = Table.retrieveByName(
    "service.database.schema.table", 
    "owners,tags,columns"
);

// List tables with pagination
for (Table table : Table.list().autoPagingIterable()) {
    System.out.println(table.getName());
}

// List with filters
TableListParams params = TableListParams.builder()
    .limit(50)
    .database("my_database")
    .fields("owners,tags")
    .build();
TableCollection tables = Table.list(params);

// Update a table
table.setDescription("Updated description");
Table updated = table.save();

// Delete a table
Table.delete("table-id");

// Delete with options
Table.delete("table-id", true, true); // recursive, hardDelete

// Export/Import CSV
String csv = Table.exportCsv("table-name");
Table.importCsv("table-name", csvData);
```

### Users

```java
// Create a user
CreateUser request = new CreateUser()
    .withName("john.doe")
    .withEmail("john@example.com")
    .withIsAdmin(false);
User user = User.create(request);

// Retrieve a user
User user = User.retrieve("user-id");
User user = User.retrieveByName("john.doe", "teams,roles");

// List users
for (User user : User.list().autoPagingIterable()) {
    System.out.println(user.getEmail());
}

// Update a user
user.setDisplayName("John Doe");
User updated = user.save();

// Delete a user
User.delete("user-id");
```

### All Entity Types Supported

The SDK provides the same fluent API for all 40+ OpenMetadata entity types:

- **Data Assets**: Table, Database, DatabaseSchema, Dashboard, Pipeline, Topic, Container, Query, StoredProcedure, DashboardDataModel, SearchIndex, MlModel, Report
- **Services**: DatabaseService, MessagingService, DashboardService, PipelineService, MlModelService, StorageService, SearchService, MetadataService, ApiService
- **Teams & Users**: User, Team, Role, Policy
- **Governance**: Glossary, GlossaryTerm, Classification, Tag, DataProduct, Domain
- **Quality**: TestCase, TestSuite, TestDefinition, DataQualityDashboard
- **Ingestion**: Ingestion, Workflow, Connection
- **Other**: Type, Webhook, Kpi, Application, Persona, DocStore, Page, SearchQuery

## Search Operations

```java
// Simple search
String results = Search.search("customer");

// Search with index
String results = Search.search("customer", "table_search_index");

// Advanced search with pagination and sorting
String results = Search.search(
    "customer", 
    "table_search_index", 
    0, 100, 
    "name.keyword", "asc"
);

// Suggestions
String suggestions = Search.suggest("cust");
String suggestions = Search.suggest("cust", "table_search_index", 10);

// Aggregations
String aggregations = Search.aggregate("type:Table", "table_search_index", "database");

// Advanced search with custom request
Map<String, Object> searchRequest = Map.of(
    "query", Map.of("match", Map.of("name", "customer")),
    "size", 50
);
String results = Search.searchAdvanced(searchRequest);

// Reindex operations
Search.reindex("table");
Search.reindexAll();

// Using the builder
String results = Search.builder()
    .query("customer")
    .index("table_search_index")
    .from(0)
    .size(100)
    .sortField("name.keyword")
    .sortOrder("asc")
    .execute();
```

## Lineage Operations

```java
// Get lineage for an entity
String lineage = Lineage.getLineage("entity-fqn");

// Get lineage with depth control
String lineage = Lineage.getLineage("entity-fqn", "3", "2");

// Get entity lineage by type and ID
String lineage = Lineage.getEntityLineage("table", "entity-id");
String lineage = Lineage.getEntityLineage("table", "entity-id", "3", "2");

// Add lineage relationship
Lineage.addLineage(
    "source-entity-id", "table",
    "target-entity-id", "dashboard"
);

// Delete lineage
Lineage.deleteLineage("from-entity", "to-entity");

// Export lineage
String export = Lineage.exportLineage("table", "entity-id");

// Using the builder
String lineage = Lineage.builder()
    .entityType("table")
    .entityId("entity-id")
    .upstreamDepth(3)
    .downstreamDepth(2)
    .execute();
```

## Bulk Operations

```java
// Bulk create entities
List<Object> entities = Arrays.asList(entity1, entity2, entity3);
String result = Bulk.create("table", entities);

// Bulk update entities
List<Object> updates = Arrays.asList(updatedEntity1, updatedEntity2);
String result = Bulk.update("table", updates);

// Bulk delete entities
List<String> ids = Arrays.asList("id1", "id2", "id3");
String result = Bulk.delete("table", ids);

// Bulk add tags
List<String> entityIds = Arrays.asList("id1", "id2");
List<String> tags = Arrays.asList("tag1", "tag2");
Bulk.addTags("table", entityIds, tags);

// Bulk remove tags
Bulk.removeTags("table", entityIds, tags);

// Get operation status
String status = Bulk.getOperationStatus("operation-id");

// Using the builder
String result = Bulk.builder()
    .entityType("table")
    .entities(entities)
    .forCreate()
    .execute();

// Builder for bulk delete
String result = Bulk.builder()
    .entityType("table")
    .entityIds(ids)
    .forDelete()
    .execute();
```

## Async Operations

All operations support async execution:

```java
// Async entity operations
CompletableFuture<Table> future = Table.createAsync(request);
CompletableFuture<Table> future = Table.retrieveAsync("id");
CompletableFuture<Void> future = Table.deleteAsync("id", true, true);

// Async search
CompletableFuture<String> future = Search.searchAsync("query");
CompletableFuture<String> future = Search.suggestAsync("query");
CompletableFuture<String> future = Search.reindexAsync("table");

// Async lineage
CompletableFuture<String> future = Lineage.getLineageAsync("entity");
CompletableFuture<String> future = Lineage.addLineageAsync(lineageRequest);
CompletableFuture<String> future = Lineage.exportLineageAsync("table", "id");

// Async bulk operations
CompletableFuture<String> future = Bulk.createAsync("table", entities);
CompletableFuture<String> future = Bulk.deleteAsync("table", ids);

// Handle async results
future.thenAccept(result -> {
    System.out.println("Operation completed: " + result);
}).exceptionally(error -> {
    System.err.println("Operation failed: " + error);
    return null;
});
```

## Advanced Configuration

```java
// Full configuration options
OpenMetadataConfig config = OpenMetadataConfig.builder()
    .serverUrl("https://metadata.company.com")
    .apiKey("api-key")
    .connectionTimeoutMillis(30000)
    .readTimeoutMillis(60000)
    .writeTimeoutMillis(60000)
    .maxRetries(3)
    .retryIntervalMillis(1000)
    .build();

// JWT authentication
OpenMetadataConfig config = OpenMetadataConfig.builder()
    .serverUrl("https://metadata.company.com")
    .jwtToken("eyJhbGciOiJ...")
    .build();
```

## Error Handling

```java
try {
    Table table = Table.retrieve("table-id");
} catch (OpenMetadataException e) {
    if (e.getStatusCode() == 404) {
        System.err.println("Table not found");
    } else if (e.getStatusCode() == 401) {
        System.err.println("Authentication failed");
    } else {
        System.err.println("Error: " + e.getMessage());
    }
}
```

## Auto-Pagination

The SDK automatically handles pagination for list operations:

```java
// Iterate through all tables
for (Table table : Table.list().autoPagingIterable()) {
    processTable(table);
}

// Manual pagination control
TableListParams params = TableListParams.builder()
    .limit(100)
    .after("cursor-token")
    .build();
TableCollection tables = Table.list(params);
```

## Thread Safety

The OpenMetadataClient is thread-safe and can be shared across multiple threads. The static API methods use a shared default client instance.

## Examples

See the [examples](examples/) directory for complete working examples:

- Basic CRUD operations
- Bulk data import/export
- Lineage management
- Search and discovery
- Async operations
- Error handling

## Contributing

Please read [CONTRIBUTING.md](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../LICENSE) file for details.
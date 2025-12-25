# Pure Fluent API vs Previous Approach

## Key Differences

### 1. Creation

**Previous Approach (Request Objects):**
```java
CreateTable request = new CreateTable();
request.setName("customers");
request.setDatabaseSchema("mysql.sales.public");
Table table = Tables.create(request);
```

**Pure Fluent API:**
```java
Table table = Tables.create()
    .name("customers")
    .in("mysql.sales.public")
    .withColumn("id", BIGINT).asPrimaryKey()
    .withColumn("email", VARCHAR(255)).asUnique()
    .execute();
```

### 2. Retrieval

**Previous Approach (Request Objects):**
```java
RetrieveRequest<Table> request = Tables.retrieve(id);
Table table = request.include("owner", "tags").fetch();
```

**Pure Fluent API:**
```java
Table table = Tables.find(id)
    .includeOwner()
    .includeTags()
    .fetch();
```

### 3. Update

**Previous Approach (Request Objects):**
```java
UpdateRequest<Table> request = Tables.update(id);
Table updated = request.set(modifiedTable).execute();
```

**Pure Fluent API:**
```java
Table updated = Tables.find(id)
    .fetch()
    .withDescription("New description")
    .addTag("PII")
    .save();
```

### 4. Delete

**Previous Approach (Request Objects):**
```java
DeleteRequest<Table> request = Tables.delete(id);
request.recursive().hardDelete().execute();
```

**Pure Fluent API:**
```java
Tables.find(id)
    .delete()
    .recursively()
    .permanently()
    .confirm();
```

### 5. Listing

**Previous Approach (Request Objects):**
```java
ListRequest<Table> request = Tables.list();
var response = request.filter("database", "sales").limit(50).fetch();
```

**Pure Fluent API:**
```java
Tables.list()
    .from("mysql.sales")
    .withTag("PII")
    .limit(50)
    .forEach(table -> process(table));
```

## Benefits of Pure Fluent API

### 1. **Natural Language Flow**
The API reads like English sentences:
- "Create a table named customers in sales database"
- "Find table by id and delete it recursively"
- "List tables from sales with PII tag"

### 2. **No Intermediate Objects**
No need to understand request/response objects. Direct method chaining.

### 3. **Entity-Centric Operations**
Work directly with entities:
```java
table.withDescription("New")
     .addTag("PII")
     .save();
```

### 4. **Contextual Methods**
Methods make sense in context:
- `delete().recursively().permanently()`
- `create().withColumn().asPrimaryKey()`

### 5. **Type Safety**
Still maintains full type safety with proper return types.

### 6. **Discoverable**
IDE autocomplete naturally guides you through the available operations.

## Entity-Specific Operations

The pure fluent API also supports entity-specific operations:

```java
// Table-specific
table.addColumn("new_col", "VARCHAR(100)")
     .dropColumn("old_col")
     .updateProfilerConfig(config)
     .save();

// User-specific
user.joinTeam("engineering")
    .assignRole("DataSteward")
    .save();

// Dashboard-specific
dashboard.addChart("chart-id")
         .removeChart("old-chart")
         .updateLayout(layout)
         .save();
```

## Migration Guide

### For Developers

1. **Replace static methods with fluent chains:**
   - `Tables.retrieve(id)` → `Tables.find(id).fetch()`
   - `Tables.delete(id)` → `Tables.find(id).delete().confirm()`

2. **Use natural method names:**
   - `recursive()` → `recursively()`
   - `hardDelete()` → `permanently()`
   - `execute()` → `confirm()` for deletes

3. **Entity operations:**
   - Get entity first: `var table = Tables.find(id).fetch()`
   - Then operate: `table.addTag("PII").save()`

### For Test Writers

Tests become more readable:
```java
// Old
when(mockService.create(any(CreateTable.class))).thenReturn(table);

// New - same mock, but usage is cleaner
Table table = Tables.create()
    .name("test")
    .in("service.db.schema")
    .execute();
```

## Summary

The pure fluent API provides:
- ✅ Natural language-like syntax
- ✅ No intermediate request/response objects
- ✅ Entity-centric operations
- ✅ Contextual method names
- ✅ Better discoverability
- ✅ Cleaner, more readable code
- ✅ Maintains type safety
- ✅ Supports bulk operations
- ✅ Extensible for entity-specific features
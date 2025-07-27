# SQL-to-SPARQL Implementation

This document describes OpenMetadata's SQL-to-SPARQL translation feature that allows users to query RDF data using familiar SQL syntax.

## Overview

The SQL-to-SPARQL translator enables SQL queries to be executed against RDF triple stores by automatically translating SQL syntax to SPARQL. This makes RDF data accessible to users and tools that only understand SQL.

## Architecture

```
SQL Query → Apache Calcite Parser → AST → SPARQL Builder → SPARQL Query → Fuseki
```

### Components

1. **SqlToSparqlTranslator**: Main translator class using Apache Calcite for SQL parsing
2. **SqlMappingContext**: Maps SQL tables/columns to RDF classes/properties
3. **SparqlBuilder**: AST visitor that builds SPARQL from SQL parse tree
4. **SqlToSparqlService**: Service layer for query execution
5. **RdfSqlResource**: REST endpoint for SQL queries

## API Endpoints

### Execute SQL Query
```
POST /v1/rdf/sql/query
Content-Type: application/json

{
  "query": "SELECT name, description FROM tables WHERE database = 'sales'"
}
```

### Translate SQL to SPARQL
```
POST /v1/rdf/sql/translate
Content-Type: application/json

{
  "query": "SELECT t.name, c.dataType FROM tables t JOIN columns c ON t.id = c.tableId"
}
```

## SQL to SPARQL Mapping

### Table Mappings

| SQL Table | RDF Class | Subject Pattern |
|-----------|-----------|-----------------|
| tables | om:Table | om:table/{id} |
| columns | om:Column | om:column/{id} |
| databases | om:Database | om:database/{id} |
| users | om:User | om:user/{id} |
| teams | om:Team | om:team/{id} |

### Column Mappings

| SQL Column | RDF Property | Data Type |
|------------|--------------|-----------|
| id | om:id | xsd:string |
| name | om:name | xsd:string |
| description | om:description | xsd:string |
| dataType | om:dataType | xsd:string |
| tableId | om:table | @id (object) |

## Supported SQL Features

### Currently Supported
- SELECT with column projections
- WHERE with simple conditions (=, LIKE)
- JOIN on foreign keys
- ORDER BY (ASC/DESC)
- LIMIT
- AND conditions
- Table aliases

### Example Translations

#### Simple SELECT
```sql
SELECT name, description FROM tables
```
Translates to:
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?var1_name ?var1_description
WHERE {
  ?var1 a om:Table .
  ?var1 om:name ?var1_name .
  ?var1 om:description ?var1_description .
}
```

#### WHERE Clause
```sql
SELECT name FROM tables WHERE database = 'sales'
```
Translates to:
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?var1_name
WHERE {
  ?var1 a om:Table .
  ?var1 om:name ?var1_name .
  ?var1 om:database ?var1_database .
  FILTER (?var1_database = "sales")
}
```

#### JOIN Query
```sql
SELECT t.name, c.dataType 
FROM tables t 
JOIN columns c ON t.id = c.tableId
```
Translates to:
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?var1_name ?var2_dataType
WHERE {
  ?var1 a om:Table .
  ?var1 om:name ?var1_name .
  ?var2 a om:Column .
  ?var2 om:dataType ?var2_dataType .
  ?var1 om:id ?var2 .
}
```

## Configuration

Enable SQL-to-SPARQL in `openmetadata.yaml`:
```yaml
rdf:
  enabled: true
  storageType: FUSEKI
  remoteEndpoint: http://fuseki:3030/openmetadata
```

## SQL Dialect Support

The translator supports multiple SQL dialects:
- **STANDARD**: ANSI SQL (default)
- **MYSQL**: MySQL-specific syntax
- **POSTGRESQL**: PostgreSQL-specific syntax

## Performance Considerations

1. **Query Caching**: Translated queries are cached to avoid re-parsing
2. **Result Limits**: Apply LIMIT clauses to prevent large result sets
3. **Index Usage**: Ensure RDF store has appropriate indexes

## Limitations

1. **Subqueries**: Not currently supported
2. **Aggregations**: GROUP BY, COUNT, SUM etc. not yet implemented
3. **Complex JOINs**: Only simple foreign key joins supported
4. **Functions**: SQL functions not translated

## Future Enhancements

1. Support for aggregation functions
2. Subquery support
3. More SQL functions (UPPER, LOWER, etc.)
4. UNION queries
5. Full outer joins
6. Window functions

## Testing

Run unit tests:
```bash
mvn test -Dtest=SqlToSparqlTranslatorTest
```

Example test query:
```bash
curl -X POST http://localhost:8585/api/v1/rdf/sql/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query": "SELECT name FROM tables LIMIT 10"}'
```
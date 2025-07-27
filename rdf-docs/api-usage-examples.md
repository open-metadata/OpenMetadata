# RDF API Usage Examples

This guide shows how to use the OpenMetadata RDF APIs.

## Prerequisites

1. Enable RDF in your OpenMetadata configuration:
```yaml
rdf:
  enabled: true
  baseUri: "https://open-metadata.org/"
  storageType: "TDB2"
  storagePath: "./rdf-store"
  jsonLdEnabled: true
  sparqlEndpointEnabled: true
```

2. Restart OpenMetadata server

## API Examples

### 1. Get Entity as JSON-LD

Retrieve a table entity in JSON-LD format:

```bash
curl -X GET "http://localhost:8585/api/v1/rdf/entity/table/1234-5678-90ab-cdef?format=jsonld" \
  -H "Authorization: Bearer <your-token>"
```

Response:
```json
{
  "@context": {
    "om": "https://open-metadata.org/ontology/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "dcat": "http://www.w3.org/ns/dcat#",
    ...
  },
  "@id": "https://open-metadata.org/entity/table/1234-5678-90ab-cdef",
  "@type": ["om:Table", "dcat:Dataset"],
  "rdfs:label": "customer_orders",
  "om:fullyQualifiedName": "sales_db.public.customer_orders",
  "dct:description": "Table containing customer order data",
  "om:hasColumn": [
    {
      "@id": "https://open-metadata.org/entity/column/order_id",
      "om:columnName": "order_id",
      "om:columnType": "INTEGER"
    }
  ],
  "om:belongsToDatabase": {
    "@id": "https://open-metadata.org/entity/database/sales-db-id",
    "rdfs:label": "sales_db"
  }
}
```

### 2. Get Entity as Turtle

```bash
curl -X GET "http://localhost:8585/api/v1/rdf/entity/table/1234-5678-90ab-cdef?format=turtle" \
  -H "Authorization: Bearer <your-token>"
```

Response:
```turtle
@prefix om: <https://open-metadata.org/ontology/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .

<https://open-metadata.org/entity/table/1234-5678-90ab-cdef>
    a om:Table, dcat:Dataset ;
    rdfs:label "customer_orders" ;
    om:fullyQualifiedName "sales_db.public.customer_orders" ;
    dct:description "Table containing customer order data" ;
    om:hasColumn <https://open-metadata.org/entity/column/order_id> ;
    om:belongsToDatabase <https://open-metadata.org/entity/database/sales-db-id> .
```

### 3. Execute SPARQL Query

Find all tables with PII tags:

```bash
curl -X POST "http://localhost:8585/api/v1/rdf/sparql?format=json" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table ?name WHERE {
  ?table a om:Table ;
         rdfs:label ?name ;
         om:hasTag ?tag .
  ?tag om:tagFQN "PII.Sensitive" .
}'
```

Response:
```json
{
  "head": {
    "vars": ["table", "name"]
  },
  "results": {
    "bindings": [
      {
        "table": {
          "type": "uri",
          "value": "https://open-metadata.org/entity/table/customers-table-id"
        },
        "name": {
          "type": "literal",
          "value": "customers"
        }
      },
      {
        "table": {
          "type": "uri",
          "value": "https://open-metadata.org/entity/table/users-table-id"
        },
        "name": {
          "type": "literal",
          "value": "users"
        }
      }
    ]
  }
}
```

### 4. Get Lineage Using SPARQL

```bash
curl -X POST "http://localhost:8585/api/v1/rdf/sparql?format=json" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: text/plain" \
  -d 'PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?upstream ?name WHERE {
  <https://open-metadata.org/entity/table/analytics-table-id> om:upstream+ ?upstream .
  ?upstream rdfs:label ?name .
}'
```

### 5. Different Output Formats

SPARQL queries support multiple output formats:

```bash
# JSON (default)
curl -X POST "http://localhost:8585/api/v1/rdf/sparql?format=json" ...

# XML
curl -X POST "http://localhost:8585/api/v1/rdf/sparql?format=xml" ...

# CSV
curl -X POST "http://localhost:8585/api/v1/rdf/sparql?format=csv" ...

# For CONSTRUCT queries - Turtle
curl -X POST "http://localhost:8585/api/v1/rdf/sparql?format=turtle" ...

# For CONSTRUCT queries - JSON-LD
curl -X POST "http://localhost:8585/api/v1/rdf/sparql?format=jsonld" ...
```

## Python Client Examples

Using the OpenMetadata Python SDK with RDF:

```python
import requests
import json

class OpenMetadataRdfClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "text/plain"
        }
    
    def get_entity_as_jsonld(self, entity_type, entity_id):
        """Get entity in JSON-LD format"""
        url = f"{self.base_url}/api/v1/rdf/entity/{entity_type}/{entity_id}?format=jsonld"
        response = requests.get(url, headers=self.headers)
        return response.json()
    
    def sparql_query(self, query, format="json"):
        """Execute SPARQL query"""
        url = f"{self.base_url}/api/v1/rdf/sparql?format={format}"
        response = requests.post(url, data=query, headers=self.headers)
        
        if format == "json":
            return response.json()
        else:
            return response.text
    
    def find_tables_with_tag(self, tag_fqn):
        """Find all tables with a specific tag"""
        query = f"""
        PREFIX om: <https://open-metadata.org/ontology/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?table ?name WHERE {{
          ?table a om:Table ;
                 rdfs:label ?name ;
                 om:hasTag ?tag .
          ?tag om:tagFQN "{tag_fqn}" .
        }}
        """
        return self.sparql_query(query)
    
    def get_lineage(self, table_id, direction="upstream"):
        """Get lineage for a table"""
        operator = "om:upstream+" if direction == "upstream" else "om:downstream+"
        query = f"""
        PREFIX om: <https://open-metadata.org/ontology/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?entity ?name ?type WHERE {{
          <https://open-metadata.org/entity/table/{table_id}> {operator} ?entity .
          ?entity rdfs:label ?name ;
                  a ?type .
        }}
        """
        return self.sparql_query(query)

# Usage
client = OpenMetadataRdfClient("http://localhost:8585", "your-token")

# Get table as JSON-LD
table_jsonld = client.get_entity_as_jsonld("table", "customer-table-id")

# Find tables with PII tags
pii_tables = client.find_tables_with_tag("PII.Sensitive")

# Get upstream lineage
lineage = client.get_lineage("analytics-table-id", "upstream")
```

## JavaScript/TypeScript Examples

```typescript
interface SparqlResults {
  head: { vars: string[] };
  results: {
    bindings: Array<{
      [key: string]: {
        type: string;
        value: string;
      };
    }>;
  };
}

class OpenMetadataRdfClient {
  constructor(
    private baseUrl: string,
    private token: string
  ) {}

  async getEntityAsJsonLd(entityType: string, entityId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/rdf/entity/${entityType}/${entityId}?format=jsonld`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );
    return response.json();
  }

  async sparqlQuery(query: string, format = "json"): Promise<SparqlResults | string> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/rdf/sparql?format=${format}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "text/plain",
        },
        body: query,
      }
    );

    if (format === "json") {
      return response.json() as Promise<SparqlResults>;
    }
    return response.text();
  }

  async findEntitiesWithTag(entityType: string, tagFqn: string): Promise<SparqlResults> {
    const query = `
      PREFIX om: <https://open-metadata.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?entity ?name WHERE {
        ?entity a om:${entityType} ;
                rdfs:label ?name ;
                om:hasTag ?tag .
        ?tag om:tagFQN "${tagFqn}" .
      }
    `;
    return this.sparqlQuery(query) as Promise<SparqlResults>;
  }
}

// Usage
const client = new OpenMetadataRdfClient("http://localhost:8585", "your-token");

// Get entity
const table = await client.getEntityAsJsonLd("table", "customer-table-id");

// Find tables with tags
const piiTables = await client.findEntitiesWithTag("Table", "PII.Sensitive");
console.log("Tables with PII data:", piiTables.results.bindings);
```

## Common Use Cases

### 1. Impact Analysis
Find all downstream entities that would be affected by changes to a source table.

### 2. Data Discovery
Use SPARQL queries to find data based on complex criteria combining tags, ownership, quality scores, etc.

### 3. Compliance Reporting
Query for all sensitive data across the organization using classification tags.

### 4. Lineage Visualization
Build lineage graphs using CONSTRUCT queries for visualization tools.

### 5. Knowledge Graph Integration
Export OpenMetadata as RDF to integrate with enterprise knowledge graphs.

## Best Practices

1. **Use Prefixes**: Always define prefixes to make queries more readable
2. **Limit Results**: Use LIMIT for exploratory queries to avoid large result sets
3. **Cache Results**: Cache frequently used SPARQL query results
4. **Index Optimization**: The RDF store maintains indexes for efficient querying
5. **Batch Operations**: Use CONSTRUCT queries to build subgraphs for complex visualizations
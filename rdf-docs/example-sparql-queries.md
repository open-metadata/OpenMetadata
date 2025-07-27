# Example SPARQL Queries for OpenMetadata Knowledge Graph

This document provides example SPARQL queries to demonstrate the power of the RDF/Knowledge Graph capabilities in OpenMetadata.

## 1. Basic Entity Queries

### Get all tables with their descriptions
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?table ?name ?description WHERE {
  ?table a om:Table ;
         rdfs:label ?name ;
         dct:description ?description .
}
LIMIT 100
```

### Find tables in a specific database
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table ?tableName WHERE {
  ?database a om:Database ;
            rdfs:label "sales_db" .
  ?table om:belongsToDatabase ?database ;
         rdfs:label ?tableName .
}
```

## 2. Tag and Classification Queries

### Find all tables with PII tags
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?table ?name ?tag WHERE {
  ?table a om:Table ;
         rdfs:label ?name ;
         om:hasTag ?tagEntity .
  ?tagEntity om:tagFQN ?tag .
  FILTER(CONTAINS(?tag, "PII"))
}
```

### Find all entities with a specific classification
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?name ?type WHERE {
  ?entity om:hasTag ?tag ;
          rdfs:label ?name ;
          a ?type .
  ?tag om:tagFQN "Classification.Confidential" .
}
```

## 3. Ownership and Team Queries

### Find all assets owned by a specific team
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?asset ?assetName ?assetType WHERE {
  ?team a om:Team ;
        rdfs:label "Data Engineering Team" .
  ?asset om:hasOwner ?team ;
         rdfs:label ?assetName ;
         a ?assetType .
}
```

### Find all users who are experts on specific tables
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table ?tableName ?expert ?expertName WHERE {
  ?table a om:Table ;
         rdfs:label ?tableName ;
         om:hasExpert ?expert .
  ?expert rdfs:label ?expertName .
}
```

## 4. Lineage Queries

### Get upstream lineage of a table (all ancestors)
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?upstream ?name ?type WHERE {
  <https://open-metadata.org/entity/table/customer-analytics-table-id> om:upstream+ ?upstream .
  ?upstream rdfs:label ?name ;
            a ?type .
}
```

### Get downstream impact of a table (all descendants)
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?downstream ?name ?type WHERE {
  ?downstream om:upstream+ <https://open-metadata.org/entity/table/source-table-id> ;
              rdfs:label ?name ;
              a ?type .
}
```

### Find common upstream sources for multiple tables
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?commonSource ?sourceName WHERE {
  <https://open-metadata.org/entity/table/table1-id> om:upstream+ ?commonSource .
  <https://open-metadata.org/entity/table/table2-id> om:upstream+ ?commonSource .
  ?commonSource rdfs:label ?sourceName .
}
```

## 5. Cross-Entity Relationships

### Find dashboards using specific tables
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?dashboard ?dashboardName ?table ?tableName WHERE {
  ?dashboard a om:Dashboard ;
             rdfs:label ?dashboardName ;
             om:uses ?table .
  ?table a om:Table ;
         rdfs:label ?tableName .
}
```

### Find pipelines that process specific topics
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?pipeline ?pipelineName ?topic ?topicName WHERE {
  ?pipeline a om:Pipeline ;
            rdfs:label ?pipelineName ;
            om:uses ?topic .
  ?topic a om:Topic ;
         rdfs:label ?topicName .
}
```

## 6. Data Quality Queries

### Find tables with failing test cases
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table ?tableName ?testCase ?status WHERE {
  ?table a om:Table ;
         rdfs:label ?tableName .
  ?testCase om:testedBy ?table ;
            om:hasTestCaseStatus ?status .
  FILTER(?status = "Failed")
}
```

### Get tables with data quality scores below threshold
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table ?name ?qualityScore WHERE {
  ?table a om:Table ;
         rdfs:label ?name ;
         om:hasProfile ?profile .
  ?profile om:dataQualityScore ?qualityScore .
  FILTER(?qualityScore < 0.8)
}
```

## 7. Complex Graph Traversals

### Find all paths between two entities
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?path WHERE {
  <https://open-metadata.org/entity/table/source-id> 
    (om:upstream|om:downstream|om:uses|om:contains)* ?path .
  ?path (om:upstream|om:downstream|om:uses|om:contains)* 
    <https://open-metadata.org/entity/dashboard/target-id> .
}
```

### Find tables that share columns with similar names
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table1 ?table2 ?col1 ?col2 ?colName WHERE {
  ?table1 a om:Table ;
          om:hasColumn ?col1 .
  ?table2 a om:Table ;
          om:hasColumn ?col2 .
  ?col1 om:columnName ?colName .
  ?col2 om:columnName ?colName .
  FILTER(?table1 != ?table2)
}
```

## 8. Governance and Compliance Queries

### Find all assets in a specific domain
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?asset ?name ?type WHERE {
  ?domain a om:Domain ;
          rdfs:label "Finance Domain" .
  ?asset om:belongsToDomain ?domain ;
         rdfs:label ?name ;
         a ?type .
}
```

### Find glossary terms applied to tables
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?table ?tableName ?term ?termName ?definition WHERE {
  ?table a om:Table ;
         rdfs:label ?tableName ;
         om:hasGlossaryTerm ?term .
  ?term a om:GlossaryTerm ;
        skos:prefLabel ?termName ;
        skos:definition ?definition .
}
```

## 9. Usage and Analytics Queries

### Most frequently queried tables
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table ?name (COUNT(?query) as ?queryCount) WHERE {
  ?table a om:Table ;
         rdfs:label ?name .
  ?query a om:Query ;
         om:uses ?table .
}
GROUP BY ?table ?name
ORDER BY DESC(?queryCount)
LIMIT 10
```

### Find inactive tables (not used in last 30 days)
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?table ?name ?lastAccessed WHERE {
  ?table a om:Table ;
         rdfs:label ?name ;
         om:lastAccessed ?lastAccessed .
  FILTER(?lastAccessed < NOW() - "P30D"^^xsd:duration)
}
```

## 10. CONSTRUCT Queries (Building New Graphs)

### Create a lineage graph for visualization
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
  ?source om:lineageTo ?target ;
          rdfs:label ?sourceName .
  ?target rdfs:label ?targetName .
} WHERE {
  ?source om:downstream ?target ;
          rdfs:label ?sourceName .
  ?target rdfs:label ?targetName .
  ?source a om:Table .
  ?target a om:Table .
}
```

### Build a team ownership graph
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
  ?team om:ownsAsset ?asset ;
        om:assetCount ?count ;
        rdfs:label ?teamName .
  ?asset rdfs:label ?assetName ;
         a ?assetType .
} WHERE {
  SELECT ?team ?teamName ?asset ?assetName ?assetType (COUNT(?asset) as ?count) WHERE {
    ?team a om:Team ;
          rdfs:label ?teamName .
    ?asset om:hasOwner ?team ;
           rdfs:label ?assetName ;
           a ?assetType .
  }
  GROUP BY ?team ?teamName
}
```

## Usage Tips

1. **Performance**: Use LIMIT for exploratory queries
2. **Prefixes**: Always define necessary prefixes at the beginning
3. **Filters**: Use FILTER to narrow results
4. **Property Paths**: Use + for one or more, * for zero or more relationships
5. **Optional**: Use OPTIONAL for properties that may not exist
6. **Union**: Use UNION to combine different query patterns

## Integration with Applications

These queries can be used in:
- Custom dashboards
- Data discovery tools
- Compliance reporting
- Impact analysis tools
- Data quality monitoring
- Automated documentation generation
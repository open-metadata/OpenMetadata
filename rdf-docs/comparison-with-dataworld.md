# OpenMetadata RDF vs Data.world: Feature Comparison

This document compares the RDF/Knowledge Graph implementation between OpenMetadata and Data.world.

## Executive Summary

Both OpenMetadata and Data.world have embraced RDF and knowledge graphs, but with different approaches:
- **Data.world**: RDF-native platform with automatic tabular-to-RDF conversion
- **OpenMetadata**: JSON-native with optional RDF layer for knowledge graph capabilities

## Feature Comparison Table

| Feature | Data.world | OpenMetadata | Notes |
|---------|------------|--------------|-------|
| **Core Architecture** | RDF-native knowledge graph | JSON-native with RDF layer | OpenMetadata maintains compatibility with existing JSON APIs |
| **RDF Storage** | Built-in RDF store | External (Apache Jena Fuseki) | OpenMetadata uses stateless architecture |
| **SPARQL Support** | ✅ Native | ✅ Full support | Both support full SPARQL 1.1 |
| **JSON-LD** | ❌ Not supported | ✅ Full support | OpenMetadata has comprehensive JSON-LD contexts |
| **SQL-to-SPARQL** | ✅ Automatic compiler | ❌ Not implemented | Data.world makes SPARQL accessible via SQL |
| **Tabular-to-RDF** | ✅ Automatic | ❌ Manual/API | Data.world auto-converts CSV/Excel to RDF |
| **Federation** | ✅ SERVICE keyword | ✅ Via Fuseki | Both support federated queries |
| **Standard Ontologies** | Limited info | ✅ DCAT, PROV, SKOS, FOAF | OpenMetadata maps to W3C standards |
| **Custom Ontology** | ✓ Proprietary | ✅ OWL ontology | OpenMetadata has complete OWL ontology |
| **RDF Formats** | Turtle, N-triples, RDF/XML | All Jena-supported formats | OpenMetadata supports more formats |
| **Auto-generation** | Unknown | ✅ From JSON schemas | OpenMetadata auto-generates RDF models |

## Detailed Comparison

### 1. Architecture Philosophy

**Data.world**
- RDF is the native format - all data is stored as RDF triples
- Automatic conversion of tabular data to RDF
- Knowledge graph is the primary data model
- SQL queries are compiled to SPARQL internally

**OpenMetadata**
- JSON remains the primary format for compatibility
- RDF is an optional layer for knowledge graph capabilities
- Dual API support (JSON REST + SPARQL)
- Maintains backward compatibility with existing integrations

### 2. RDF Implementation

**Data.world**
- Direct RDF file upload (Turtle, N-triples, RDF/XML)
- No JSON-LD support
- Proprietary JSON-to-RDF mapping (j2r namespace)
- Built-in triple store

**OpenMetadata**
- Full JSON-LD support with comprehensive contexts
- Supports all Apache Jena RDF formats
- Standards-based mapping to W3C ontologies
- External RDF store (Fuseki) for stateless architecture

### 3. Query Capabilities

**Data.world**
```sql
-- SQL query automatically compiled to SPARQL
SELECT * FROM dataset1 
JOIN dataset2 ON dataset1.id = dataset2.ref_id
```

**OpenMetadata**
```sparql
# Direct SPARQL query
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?table ?column WHERE {
  ?table a om:Table ;
         om:hasColumn ?column .
}
```

### 4. Data Integration

**Data.world**
- Automatic RDF conversion for CSV, Excel, JSON
- Federated queries to external SPARQL endpoints
- URI assignment for all data elements

**OpenMetadata**
- Entity lifecycle hooks for RDF updates
- Comprehensive relationship mapping
- Standard vocabulary integration (DCAT, PROV, etc.)

### 5. Use Cases

**Data.world Strengths**
- Ad-hoc data integration from various sources
- Non-technical users via SQL interface
- Automatic semantic enrichment of tabular data
- Data marketplace scenarios

**OpenMetadata Strengths**
- Enterprise metadata management
- Standards compliance (W3C ontologies)
- API-first architecture
- Existing system integration

## What OpenMetadata Has That Data.world Doesn't

1. **JSON-LD Support**: Full JSON-LD contexts for all entity types
2. **Standards Mapping**: Comprehensive mapping to W3C standards (DCAT, PROV, SKOS, FOAF)
3. **Auto-generation**: RDF models generated from JSON schemas
4. **OWL Ontology**: Complete formal ontology definition
5. **Stateless Architecture**: Separation of concerns with external RDF store

## What Data.world Has That OpenMetadata Doesn't

1. **SQL-to-SPARQL Compiler**: Makes SPARQL accessible to SQL users
2. **Automatic Tabular Conversion**: CSV/Excel files auto-converted to RDF
3. **Native RDF Storage**: Built-in triple store
4. **Simplified User Experience**: Hidden complexity for non-technical users

## Recommendations for OpenMetadata

To match or exceed Data.world's capabilities:

### High Priority
1. **Implement SQL-to-SPARQL Translation**
   - Allow SQL queries over RDF data
   - Use Apache Calcite or similar framework
   - Map SQL tables to RDF classes

2. **Add Tabular-to-RDF Conversion**
   - Auto-convert CSV uploads to RDF
   - Use W3C CSV on the Web standards
   - Generate appropriate ontology mappings

### Medium Priority
3. **Improve Federation Support**
   - Add UI for federated SPARQL queries
   - Support more external endpoints
   - Cache external data for performance

4. **Enhanced Semantic Layer**
   - Business-friendly vocabulary mappings
   - Visual knowledge graph explorer
   - Semantic search capabilities

### Nice to Have
5. **RDF Inference Engine**
   - OWL reasoning capabilities
   - SHACL validation
   - Custom inference rules

## Conclusion

OpenMetadata's RDF implementation is more standards-compliant and architecturally cleaner than Data.world's, but lacks some user-friendly features like SQL-to-SPARQL translation and automatic tabular conversion. The JSON-LD support and comprehensive ontology mapping give OpenMetadata an edge in enterprise integration scenarios.

Both platforms demonstrate the value of RDF/knowledge graphs for metadata management, but target slightly different use cases:
- **Data.world**: Focus on ease of use and automatic semantic enrichment
- **OpenMetadata**: Focus on standards compliance and enterprise integration
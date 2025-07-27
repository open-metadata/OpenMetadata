# RDF Model Generation

This document describes how RDF models (JSON-LD contexts and OWL ontology) are automatically generated from OpenMetadata JSON schemas.

## Overview

The RDF Model Generator ensures that RDF representations stay in sync with OpenMetadata's JSON schemas by:

1. **Scanning JSON Schema Files** - Reads all entity and type definitions
2. **Generating JSON-LD Contexts** - Creates context files for each entity type
3. **Building OWL Ontology** - Generates a complete ontology with classes and properties
4. **Mapping to Standards** - Maps to standard vocabularies (DCAT, PROV, SKOS, etc.)

## Running the Generator

### Manual Generation

Run the generation script:

```bash
cd openmetadata
./scripts/generate-rdf-models.sh
```

### During Development

Run the watcher to auto-regenerate on schema changes:

```bash
cd openmetadata-service
mvn exec:java \
  -Dexec.mainClass="org.openmetadata.service.rdf.generator.RdfSchemaWatcher" \
  -Dexec.args="../openmetadata-spec/src/main/resources/json/schema ../openmetadata-spec/src/main/resources/json/schema/rdf"
```

### As Part of Build

Add to your Maven build:

```xml
<plugin>
  <groupId>org.codehaus.mojo</groupId>
  <artifactId>exec-maven-plugin</artifactId>
  <version>3.1.0</version>
  <executions>
    <execution>
      <id>generate-rdf-models</id>
      <phase>generate-resources</phase>
      <goals>
        <goal>java</goal>
      </goals>
      <configuration>
        <mainClass>org.openmetadata.service.rdf.generator.RdfModelGenerator</mainClass>
        <arguments>
          <argument>${project.basedir}/src/main/resources/json/schema</argument>
          <argument>${project.basedir}/src/main/resources/json/schema/rdf</argument>
        </arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

## Generated Files

The generator creates:

### JSON-LD Contexts

- **Individual Contexts**: `rdf/contexts/{entityType}.jsonld`
  - One context per entity type (table, database, user, etc.)
  - Maps JSON properties to RDF predicates
  - Defines data types and relationships

- **Combined Context**: `rdf/contexts/combined.jsonld`
  - Merges all entity contexts
  - Used for cross-entity queries

### OWL Ontology

- **File**: `rdf/ontology/openmetadata-generated.ttl`
- **Contents**:
  - Class definitions for all entity types
  - Property definitions with domains and ranges
  - Mappings to standard ontologies
  - Cardinality constraints

## Mapping Strategy

### Entity Types → RDF Classes

| OpenMetadata Type | RDF Class | Standard Mapping |
|-------------------|-----------|------------------|
| Table | om:Table | dcat:Dataset |
| Database | om:Database | dcat:Catalog |
| Dashboard | om:Dashboard | dcat:DataService |
| Pipeline | om:Pipeline | prov:Activity |
| User | om:User | foaf:Person |
| Team | om:Team | foaf:Group |
| GlossaryTerm | om:GlossaryTerm | skos:Concept |

### Properties → RDF Predicates

| JSON Property | RDF Predicate | Standard Mapping |
|---------------|---------------|------------------|
| name | om:name | rdfs:label |
| displayName | om:displayName | skos:prefLabel |
| description | om:description | dct:description |
| created | om:created | dct:created |
| owner | om:owner | dct:creator |
| tags | om:tags | dcat:theme |

### Data Types

| JSON Schema Type | RDF Data Type |
|------------------|---------------|
| string | xsd:string |
| integer | xsd:integer |
| number | xsd:double |
| boolean | xsd:boolean |
| string + format:date-time | xsd:dateTime |
| string + format:uuid | @id (IRI) |
| array | @container: @set |

## Extending the Generator

### Adding New Mappings

Edit `RdfModelGenerator.java`:

```java
// Add entity type mapping
TYPE_MAPPINGS.put("newEntityType", "standard:Class");

// Add property mapping
PROPERTY_MAPPINGS.put("newProperty", "standard:predicate");
```

### Custom Processing

Override methods in `RdfModelGenerator`:

```java
@Override
protected void processEntitySchema(Path schemaPath) {
  // Custom entity processing
}

@Override
protected ObjectNode createPropertyMapping(String propName, JsonNode propSchema) {
  // Custom property mapping logic
}
```

## Integration with CI/CD

The generator can be integrated into CI/CD pipelines to ensure RDF models are always up-to-date:

```yaml
# GitHub Actions example
- name: Generate RDF Models
  run: |
    ./scripts/generate-rdf-models.sh
    
- name: Check for changes
  run: |
    git diff --exit-code openmetadata-spec/src/main/resources/json/schema/rdf/
```

## Validation

Generated models can be validated using:

1. **JSON-LD Playground**: https://json-ld.org/playground/
2. **OWL Validator**: http://mowl-power.cs.man.ac.uk:8080/validator/
3. **Jena RIOT**: `riot --validate ontology/openmetadata-generated.ttl`

## Best Practices

1. **Run generator after schema changes** - Ensures RDF stays in sync
2. **Review generated mappings** - Check that standard vocabulary usage is appropriate
3. **Test with sample data** - Validate that JSON-LD contexts work correctly
4. **Version control generated files** - Track changes to RDF models
5. **Document custom mappings** - Explain non-standard vocabulary choices
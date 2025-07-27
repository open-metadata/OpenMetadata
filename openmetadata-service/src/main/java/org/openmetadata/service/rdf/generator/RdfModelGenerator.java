package org.openmetadata.service.rdf.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.XSD;

/**
 * Automatically generates RDF models from OpenMetadata JSON schemas.
 * This includes:
 * - JSON-LD contexts for each entity type
 * - OWL ontology definitions
 * - Property mappings to standard vocabularies
 */
@Slf4j
public class RdfModelGenerator {

  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String ONTOLOGY_URI = BASE_URI + "ontology/";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  // Standard vocabulary prefixes
  private static final Map<String, String> VOCAB_PREFIXES =
      Map.of(
          "dcat", "http://www.w3.org/ns/dcat#",
          "dct", "http://purl.org/dc/terms/",
          "foaf", "http://xmlns.com/foaf/0.1/",
          "prov", "http://www.w3.org/ns/prov#",
          "skos", "http://www.w3.org/2004/02/skos/core#",
          "void", "http://rdfs.org/ns/void#",
          "rdfs", "http://www.w3.org/2000/01/rdf-schema#",
          "xsd", "http://www.w3.org/2001/XMLSchema#");

  // Mapping of OpenMetadata types to standard vocabularies
  private static final Map<String, String> TYPE_MAPPINGS =
      Map.of(
          "table", "dcat:Dataset",
          "database", "dcat:Catalog",
          "dashboard", "dcat:DataService",
          "pipeline", "prov:Activity",
          "user", "foaf:Person",
          "team", "foaf:Group",
          "glossaryTerm", "skos:Concept",
          "tag", "skos:Concept");

  // Property mappings to standard vocabularies
  private static final Map<String, String> PROPERTY_MAPPINGS =
      Map.of(
          "name", "rdfs:label",
          "displayName", "skos:prefLabel",
          "description", "dct:description",
          "created", "dct:created",
          "modified", "dct:modified",
          "version", "dct:hasVersion",
          "owner", "dct:creator",
          "tags", "dcat:theme");

  private final Path schemaBasePath;
  private final Path outputPath;
  private final Model ontologyModel;
  private final Set<String> processedTypes;

  public RdfModelGenerator(String schemaBasePath, String outputPath) {
    this.schemaBasePath = Paths.get(schemaBasePath);
    this.outputPath = Paths.get(outputPath);
    this.ontologyModel = ModelFactory.createDefaultModel();
    this.processedTypes = new HashSet<>();

    // Initialize ontology with prefixes
    VOCAB_PREFIXES.forEach(ontologyModel::setNsPrefix);
    ontologyModel.setNsPrefix("om", ONTOLOGY_URI);
  }

  /**
   * Generate RDF models for all JSON schemas
   */
  public void generateAll() throws IOException {
    LOG.info("Starting RDF model generation from schemas at: {}", schemaBasePath);

    // Initialize ontology
    initializeOntology();

    // Process entity schemas
    Path entityPath = schemaBasePath.resolve("entity");
    if (Files.exists(entityPath)) {
      try (Stream<Path> paths = Files.walk(entityPath)) {
        paths
            .filter(Files::isRegularFile)
            .filter(p -> p.toString().endsWith(".json"))
            .forEach(this::processEntitySchema);
      }
    }

    // Process type schemas
    Path typePath = schemaBasePath.resolve("type");
    if (Files.exists(typePath)) {
      try (Stream<Path> paths = Files.walk(typePath)) {
        paths
            .filter(Files::isRegularFile)
            .filter(p -> p.toString().endsWith(".json"))
            .forEach(this::processTypeSchema);
      }
    }

    // Generate combined JSON-LD context
    generateCombinedContext();

    // Write ontology
    writeOntology();

    LOG.info("RDF model generation completed. Processed {} types", processedTypes.size());
  }

  private void initializeOntology() {
    Resource omOntology = ontologyModel.createResource(ONTOLOGY_URI);
    omOntology.addProperty(RDF.type, OWL.Ontology);
    omOntology.addProperty(RDFS.label, "OpenMetadata Ontology");
    omOntology.addProperty(RDFS.comment, "Ontology for OpenMetadata entities and relationships");
    omOntology.addProperty(OWL.versionInfo, "1.0.0");
  }

  private void processEntitySchema(Path schemaPath) {
    try {
      JsonNode schema = MAPPER.readTree(schemaPath.toFile());
      String entityType = extractEntityType(schemaPath);

      if (entityType != null && schema.has("properties")) {
        LOG.debug("Processing entity schema: {}", entityType);

        // Create JSON-LD context for this entity
        ObjectNode context = createJsonLdContext(entityType, schema);
        writeJsonLdContext(entityType, context);

        // Add to ontology
        addToOntology(entityType, schema);

        processedTypes.add(entityType);
      }
    } catch (IOException e) {
      LOG.error("Failed to process schema: {}", schemaPath, e);
    }
  }

  private void processTypeSchema(Path schemaPath) {
    try {
      JsonNode schema = MAPPER.readTree(schemaPath.toFile());
      String typeName = extractTypeName(schemaPath);

      if (typeName != null && schema.has("properties")) {
        LOG.debug("Processing type schema: {}", typeName);

        // Add to ontology as a class
        Resource typeClass = ontologyModel.createResource(ONTOLOGY_URI + typeName);
        typeClass.addProperty(RDF.type, OWL.Class);
        typeClass.addProperty(RDFS.label, typeName);

        if (schema.has("description")) {
          typeClass.addProperty(RDFS.comment, schema.get("description").asText());
        }
      }
    } catch (IOException e) {
      LOG.error("Failed to process type schema: {}", schemaPath, e);
    }
  }

  private ObjectNode createJsonLdContext(String entityType, JsonNode schema) {
    ObjectNode root = MAPPER.createObjectNode();
    ObjectNode context = MAPPER.createObjectNode();

    // Add @vocab and prefixes
    context.put("@vocab", ONTOLOGY_URI);
    VOCAB_PREFIXES.forEach(context::put);
    context.put("om", ONTOLOGY_URI);

    // Add entity type mapping
    String standardType = TYPE_MAPPINGS.getOrDefault(entityType, "om:" + capitalize(entityType));
    ObjectNode typeMapping = MAPPER.createObjectNode();
    typeMapping.put("@id", "om:" + entityType);
    typeMapping.put("@type", standardType);
    context.set(capitalize(entityType), typeMapping);

    // Process properties
    JsonNode properties = schema.get("properties");
    if (properties != null && properties.isObject()) {
      properties
          .fields()
          .forEachRemaining(
              entry -> {
                String propName = entry.getKey();
                JsonNode propSchema = entry.getValue();

                // Skip internal properties
                if (propName.startsWith("_") || propName.equals("href")) {
                  return;
                }

                ObjectNode propMapping = createPropertyMapping(propName, propSchema);
                if (propMapping != null) {
                  context.set(propName, propMapping);
                }
              });
    }

    root.set("@context", context);
    return root;
  }

  private ObjectNode createPropertyMapping(String propName, JsonNode propSchema) {
    ObjectNode mapping = MAPPER.createObjectNode();

    // Check for standard property mapping
    String standardProp = PROPERTY_MAPPINGS.get(propName);
    if (standardProp != null) {
      mapping.put("@id", standardProp);
    } else {
      mapping.put("@id", "om:" + propName);
    }

    // Determine type from schema
    String jsonType = propSchema.path("type").asText();
    switch (jsonType) {
      case "string":
        if (propSchema.has("format")) {
          String format = propSchema.get("format").asText();
          if ("date-time".equals(format)) {
            mapping.put("@type", "xsd:dateTime");
          } else if ("uuid".equals(format)) {
            mapping.put("@type", "@id");
          }
        }
        break;
      case "integer":
        mapping.put("@type", "xsd:integer");
        break;
      case "number":
        mapping.put("@type", "xsd:double");
        break;
      case "boolean":
        mapping.put("@type", "xsd:boolean");
        break;
      case "array":
        mapping.put("@container", "@set");
        break;
    }

    // Handle $ref for entity references
    if (propSchema.has("$ref")) {
      String ref = propSchema.get("$ref").asText();
      if (ref.contains("entityReference")) {
        mapping.put("@type", "@id");
      }
    }

    return mapping;
  }

  private void addToOntology(String entityType, JsonNode schema) {
    // Create class for entity type
    Resource entityClass = ontologyModel.createResource(ONTOLOGY_URI + capitalize(entityType));
    entityClass.addProperty(RDF.type, OWL.Class);
    entityClass.addProperty(RDFS.label, capitalize(entityType));

    if (schema.has("description")) {
      entityClass.addProperty(RDFS.comment, schema.get("description").asText());
    }

    // Map to standard class if available
    String standardType = TYPE_MAPPINGS.get(entityType);
    if (standardType != null && standardType.contains(":")) {
      String[] parts = standardType.split(":");
      String prefix = parts[0];
      String localName = parts[1];
      String namespace = VOCAB_PREFIXES.get(prefix);
      if (namespace != null) {
        Resource standardClass = ontologyModel.createResource(namespace + localName);
        entityClass.addProperty(RDFS.subClassOf, standardClass);
      }
    }

    // Add properties
    JsonNode properties = schema.get("properties");
    if (properties != null && properties.isObject()) {
      properties
          .fields()
          .forEachRemaining(
              entry -> {
                String propName = entry.getKey();
                if (!propName.startsWith("_") && !propName.equals("href")) {
                  addPropertyToOntology(entityClass, propName, entry.getValue());
                }
              });
    }
  }

  private void addPropertyToOntology(Resource domainClass, String propName, JsonNode propSchema) {
    Property property = ontologyModel.createProperty(ONTOLOGY_URI + propName);
    property.addProperty(RDF.type, OWL.DatatypeProperty);
    property.addProperty(RDFS.label, propName);
    property.addProperty(RDFS.domain, domainClass);

    // Add description if available
    if (propSchema.has("description")) {
      property.addProperty(RDFS.comment, propSchema.get("description").asText());
    }

    // Set range based on type
    String jsonType = propSchema.path("type").asText();
    switch (jsonType) {
      case "string":
        property.addProperty(RDFS.range, XSD.xstring);
        break;
      case "integer":
        property.addProperty(RDFS.range, XSD.integer);
        break;
      case "number":
        property.addProperty(RDFS.range, XSD.xdouble);
        break;
      case "boolean":
        property.addProperty(RDFS.range, XSD.xboolean);
        break;
    }
  }

  private void generateCombinedContext() throws IOException {
    ObjectNode combined = MAPPER.createObjectNode();
    ObjectNode context = MAPPER.createObjectNode();

    // Add base context
    context.put("@vocab", ONTOLOGY_URI);
    VOCAB_PREFIXES.forEach(context::put);
    context.put("om", ONTOLOGY_URI);

    // Add all entity type mappings
    for (String entityType : processedTypes) {
      ObjectNode typeMapping = MAPPER.createObjectNode();
      typeMapping.put("@id", "om:" + entityType);
      String standardType = TYPE_MAPPINGS.getOrDefault(entityType, "om:" + capitalize(entityType));
      typeMapping.put("@type", standardType);
      context.set(capitalize(entityType), typeMapping);
    }

    combined.set("@context", context);

    // Write combined context
    Path combinedPath = outputPath.resolve("contexts/combined.jsonld");
    Files.createDirectories(combinedPath.getParent());
    MAPPER.writerWithDefaultPrettyPrinter().writeValue(combinedPath.toFile(), combined);

    LOG.info("Generated combined JSON-LD context at: {}", combinedPath);
  }

  private void writeJsonLdContext(String entityType, ObjectNode context) throws IOException {
    Path contextPath = outputPath.resolve("contexts/" + entityType + ".jsonld");
    Files.createDirectories(contextPath.getParent());
    MAPPER.writerWithDefaultPrettyPrinter().writeValue(contextPath.toFile(), context);
    LOG.debug("Generated JSON-LD context for: {}", entityType);
  }

  private void writeOntology() throws IOException {
    Path ontologyPath = outputPath.resolve("ontology/openmetadata-generated.ttl");
    Files.createDirectories(ontologyPath.getParent());

    try (FileWriter writer = new FileWriter(ontologyPath.toFile())) {
      ontologyModel.write(writer, "TURTLE");
    }

    LOG.info("Generated OWL ontology at: {}", ontologyPath);
  }

  private String extractEntityType(Path schemaPath) {
    String fileName = schemaPath.getFileName().toString();
    if (fileName.endsWith(".json")) {
      // Convert camelCase to lowercase
      String name = fileName.substring(0, fileName.length() - 5);
      return name.substring(0, 1).toLowerCase() + name.substring(1);
    }
    return null;
  }

  private String extractTypeName(Path schemaPath) {
    String fileName = schemaPath.getFileName().toString();
    if (fileName.endsWith(".json")) {
      return fileName.substring(0, fileName.length() - 5);
    }
    return null;
  }

  private String capitalize(String str) {
    if (str == null || str.isEmpty()) {
      return str;
    }
    return str.substring(0, 1).toUpperCase() + str.substring(1);
  }

  /**
   * Main method to run the generator
   */
  public static void main(String[] args) throws IOException {
    if (args.length < 2) {
      System.err.println("Usage: RdfModelGenerator <schema-base-path> <output-path>");
      System.exit(1);
    }

    RdfModelGenerator generator = new RdfModelGenerator(args[0], args[1]);
    generator.generateAll();
  }
}

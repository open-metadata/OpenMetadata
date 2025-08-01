package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.jsonldjava.core.JsonLdError;
import com.github.jsonldjava.utils.JsonUtils;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.vocabulary.RDF;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.rdf.RdfUtils;

@Slf4j
public class JsonLdTranslator {

  private static final String CONTEXT_BASE_PATH = "/rdf/contexts/";
  private final ObjectMapper objectMapper;
  private final Map<String, Object> contextCache;
  private final String baseUri;

  public JsonLdTranslator(ObjectMapper objectMapper, String baseUri) {
    this.objectMapper = objectMapper;
    this.contextCache = new HashMap<>();
    this.baseUri = baseUri;
    loadContexts();
  }

  private void loadContexts() {
    String[] contexts = {
      "base",
      "dataAsset-complete",
      "service",
      "team",
      "thread",
      "entityRelationship",
      "governance",
      "quality",
      "operations"
    };
    for (String contextName : contexts) {
      try {
        Object context = loadContext(contextName + ".jsonld");
        contextCache.put(contextName, context);
      } catch (Exception e) {
        LOG.error("Failed to load context: {}", contextName, e);
      }
    }
  }

  private Object loadContext(String filename) throws IOException {
    String path = CONTEXT_BASE_PATH + filename;
    try (InputStream is = getClass().getResourceAsStream(path)) {
      if (is == null) {
        throw new IOException("Context file not found: " + path);
      }
      return JsonUtils.fromInputStream(is);
    }
  }

  public ObjectNode toJsonLd(EntityInterface entity) {
    JsonNode jsonNode = objectMapper.valueToTree(entity);
    ObjectNode objectNode = (ObjectNode) jsonNode;

    String entityType = entity.getEntityReference().getType();
    Object context = selectContext(entityType);
    objectNode.set("@context", objectMapper.valueToTree(context));

    String id = baseUri + "entity/" + entityType + "/" + entity.getId();
    objectNode.put("@id", id);

    objectNode.put("@type", getEntityRdfType(entityType));

    return objectNode;
  }

  public Model toRdf(EntityInterface entity) throws JsonLdError {
    Model model = ModelFactory.createDefaultModel();

    model.setNsPrefix("om", "https://open-metadata.org/ontology/");
    model.setNsPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
    model.setNsPrefix("dcat", "http://www.w3.org/ns/dcat#");
    model.setNsPrefix("foaf", "http://xmlns.com/foaf/0.1/");
    model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");
    model.setNsPrefix("prov", "http://www.w3.org/ns/prov#");
    model.setNsPrefix("dct", "http://purl.org/dc/terms/");
    model.setNsPrefix("dprod", "https://ekgf.github.io/dprod/");

    String entityType = entity.getEntityReference().getType();
    String entityUri = baseUri + "entity/" + entityType + "/" + entity.getId();

    org.apache.jena.rdf.model.Resource entityResource = model.createResource(entityUri);

    String rdfType = getEntityRdfType(entityType);
    if (rdfType.contains(":")) {
      String[] parts = rdfType.split(":", 2);
      String prefix = parts[0];
      String localName = parts[1];
      String namespace = model.getNsPrefixURI(prefix);
      if (namespace != null) {
        entityResource.addProperty(RDF.type, model.createResource(namespace + localName));
      } else {
        LOG.warn("Namespace not found for prefix: {}, using as-is: {}", prefix, rdfType);
        entityResource.addProperty(RDF.type, model.createResource(rdfType));
      }
    } else {
      entityResource.addProperty(RDF.type, model.createResource(rdfType));
    }

    // Hybrid approach: Always add OpenMetadata-specific type as defined in our ontology
    // This aligns with our ontology where om:Table is subClassOf dcat:Dataset
    String omNamespace = model.getNsPrefixURI("om");
    String omType = entityType.substring(0, 1).toUpperCase() + entityType.substring(1);
    entityResource.addProperty(RDF.type, model.createResource(omNamespace + omType));

    // Add basic properties
    entityResource.addProperty(
        model.createProperty("https://open-metadata.org/ontology/", "fullyQualifiedName"),
        entity.getFullyQualifiedName());
    entityResource.addProperty(org.apache.jena.vocabulary.RDFS.label, entity.getName());

    if (entity.getDisplayName() != null) {
      entityResource.addProperty(
          model.createProperty("http://www.w3.org/2004/02/skos/core#", "prefLabel"),
          entity.getDisplayName());
    }

    if (entity.getDescription() != null) {
      entityResource.addProperty(
          model.createProperty("http://purl.org/dc/terms/", "description"),
          entity.getDescription());
    }

    if (entity.getOwners() != null && !entity.getOwners().isEmpty()) {
      for (org.openmetadata.schema.type.EntityReference owner : entity.getOwners()) {
        String ownerUri = baseUri + "entity/" + owner.getType() + "/" + owner.getId();
        entityResource.addProperty(
            model.createProperty("https://open-metadata.org/ontology/", "hasOwner"),
            model.createResource(ownerUri));
      }
    }

    if (entity.getTags() != null && !entity.getTags().isEmpty()) {
      for (org.openmetadata.schema.type.TagLabel tag : entity.getTags()) {
        String tagUri =
            baseUri
                + "entity/tag/"
                + java.net.URLEncoder.encode(tag.getTagFQN(), StandardCharsets.UTF_8);
        String predicate =
            tag.getSource() == org.openmetadata.schema.type.TagLabel.TagSource.GLOSSARY
                ? "hasGlossaryTerm"
                : "hasTag";
        entityResource.addProperty(
            model.createProperty("https://open-metadata.org/ontology/", predicate),
            model.createResource(tagUri));
      }
    }

    LOG.info(
        "RDF model size for entity {}: {} triples", entity.getFullyQualifiedName(), model.size());

    return model;
  }

  public String toJsonLdString(EntityInterface entity, boolean prettyPrint) throws IOException {
    ObjectNode jsonLd = toJsonLd(entity);
    return prettyPrint
        ? objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(jsonLd)
        : objectMapper.writeValueAsString(jsonLd);
  }

  private Object selectContext(String entityType) {
    return switch (entityType.toLowerCase()) {
      case "table",
          "database",
          "databaseschema",
          "storedprocedure",
          "query",
          "dashboard",
          "chart",
          "report",
          "pipeline",
          "topic",
          "mlmodel",
          "container",
          "metric",
          "searchindex",
          "apicollection",
          "apiendpoint",
          "directory",
          "file",
          "spreadsheet",
          "worksheet" -> contextCache.get("dataAsset-complete");
      case "databaseservice",
          "dashboardservice",
          "messagingservice",
          "pipelineservice",
          "mlmodelservice",
          "storageservice",
          "searchservice",
          "metadataservice",
          "apiservice",
          "reportingservice",
          "qualityservice",
          "observabilityservice",
          "driveservice" -> contextCache.get("service");
      case "user", "team", "role", "bot", "policy" -> contextCache.get("team");
      case "thread", "post" -> contextCache.get("thread");
      case "glossary",
          "glossaryterm",
          "classification",
          "tag",
          "datacontract",
          "dataproduct",
          "domain",
          "persona" -> contextCache.get("governance");
      case "testdefinition",
          "testsuite",
          "testcase",
          "testcaseresult",
          "testcaseresolutionstatus" -> contextCache.get("quality");
      case "ingestionpipeline",
          "workflow",
          "workflowdefinition",
          "workflowinstance",
          "workflowinstancestate",
          "eventsubscription",
          "kpi",
          "datainsightchart",
          "webanalyticevent",
          "app",
          "appmarketplacedefinition",
          "document",
          "page" -> contextCache.get("operations");
      default -> contextCache.get("base");
    };
  }

  private String getEntityRdfType(String entityType) {
    return RdfUtils.getRdfType(entityType);
  }
}

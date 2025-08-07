package org.openmetadata.service.rdf.translator;

import com.apicatalog.jsonld.JsonLd;
import com.apicatalog.jsonld.JsonLdError;
import com.apicatalog.jsonld.document.JsonDocument;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
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
    try {
      Object baseContext = loadBaseContext();
      contextCache.put("base", baseContext);
    } catch (Exception e) {
      LOG.error("Failed to load base context", e);
    }

    String[] contexts = {
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

  private Object loadBaseContext() throws IOException {
    String path = CONTEXT_BASE_PATH + "base.jsonld";
    try (InputStream is = getClass().getResourceAsStream(path)) {
      if (is == null) {
        throw new IOException("Base context file not found: " + path);
      }
      String contextContent = new String(is.readAllBytes(), StandardCharsets.UTF_8);
      JsonNode contextJson = objectMapper.readTree(contextContent);
      return objectMapper.convertValue(contextJson.get("@context"), Object.class);
    }
  }

  private Object loadContext(String filename) throws IOException {
    String path = CONTEXT_BASE_PATH + filename;
    try (InputStream is = getClass().getResourceAsStream(path)) {
      if (is == null) {
        throw new IOException("Context file not found: " + path);
      }

      String contextContent = new String(is.readAllBytes(), StandardCharsets.UTF_8);
      JsonNode contextJson = objectMapper.readTree(contextContent);
      Object contextValue = objectMapper.convertValue(contextJson.get("@context"), Object.class);

      if (contextValue instanceof java.util.List) {
        java.util.List<Object> contextArray = (java.util.List<Object>) contextValue;
        java.util.List<Object> resolvedContext = new java.util.ArrayList<>();

        for (Object item : contextArray) {
          if ("./base.jsonld".equals(item) && contextCache.containsKey("base")) {
            Object baseContext = contextCache.get("base");
            if (baseContext instanceof Map) {
              resolvedContext.add(baseContext);
            }
          } else {
            resolvedContext.add(item);
          }
        }
        return resolvedContext;
      }

      return contextValue;
    }
  }

  public ObjectNode toJsonLd(EntityInterface entity) {
    try {
      JsonNode entityJson = objectMapper.valueToTree(entity);
      Map<String, Object> entityMap = objectMapper.convertValue(entityJson, Map.class);
      addJsonLdPropertiesToReferences(entityMap);

      String entityType = entity.getEntityReference().getType();
      String id = baseUri + "entity/" + entityType + "/" + entity.getId();
      entityMap.put("@id", id);
      entityMap.put("@type", getEntityRdfType(entityType));

      Object context = selectContext(entityType);
      String entityJsonString = objectMapper.writeValueAsString(entityMap);
      JsonDocument document = JsonDocument.of(new StringReader(entityJsonString));
      String contextJsonString = objectMapper.writeValueAsString(context);
      JsonDocument contextDoc = JsonDocument.of(new StringReader(contextJsonString));

      JsonObject compacted = JsonLd.compact(document, contextDoc).get();

      String compactedString = compacted.toString();
      JsonNode compactedNode = objectMapper.readTree(compactedString);

      if (compactedNode.isObject()) {
        ObjectNode result = (ObjectNode) compactedNode;
        Map<String, Object> compactedMap = objectMapper.convertValue(result, Map.class);
        addJsonLdPropertiesToReferences(compactedMap);
        return objectMapper.valueToTree(compactedMap);
      }

      return (ObjectNode) compactedNode;

    } catch (Exception e) {
      LOG.error("Failed to create JSON-LD for entity", e);
      // Fallback to simple approach
      return createSimpleJsonLd(entity);
    }
  }

  private void addJsonLdPropertiesToReferences(Map<String, Object> map) {
    for (Map.Entry<String, Object> entry : map.entrySet()) {
      Object value = entry.getValue();

      if (value instanceof Map) {
        Map<String, Object> nestedMap = (Map<String, Object>) value;

        if (nestedMap.containsKey("id") && nestedMap.containsKey("type")) {
          String refType = (String) nestedMap.get("type");
          Object refId = nestedMap.get("id");
          nestedMap.put("@id", baseUri + "entity/" + refType + "/" + refId);
          nestedMap.put("@type", getEntityRdfType(refType));
        }

        addJsonLdPropertiesToReferences(nestedMap);

      } else if (value instanceof java.util.List) {
        // Handle lists
        java.util.List<Object> list = (java.util.List<Object>) value;
        for (Object item : list) {
          if (item instanceof Map) {
            addJsonLdPropertiesToReferences((Map<String, Object>) item);
          }
        }
      }
    }
  }

  private ObjectNode createSimpleJsonLd(EntityInterface entity) {
    ObjectNode result = objectMapper.createObjectNode();

    String entityType = entity.getEntityReference().getType();
    Object context = selectContext(entityType);
    result.set("@context", objectMapper.valueToTree(context));

    String id = baseUri + "entity/" + entityType + "/" + entity.getId();
    result.put("@id", id);
    result.put("@type", getEntityRdfType(entityType));

    JsonNode entityJson = objectMapper.valueToTree(entity);
    if (entityJson.isObject()) {
      ObjectNode entityObject = (ObjectNode) entityJson;
      entityObject
          .fields()
          .forEachRemaining(
              entry -> {
                if (!entry.getKey().equals("@context")
                    && !entry.getKey().equals("@id")
                    && !entry.getKey().equals("@type")) {
                  result.set(entry.getKey(), entry.getValue());
                }
              });
    }

    return result;
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
    model.setNsPrefix("void", "http://rdfs.org/ns/void#");
    model.setNsPrefix("csvw", "http://www.w3.org/ns/csvw#");
    model.setNsPrefix("xsd", "http://www.w3.org/2001/XMLSchema#");

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

    // Always add OpenMetadata-specific type
    String omNamespace = model.getNsPrefixURI("om");
    String omType = entityType.substring(0, 1).toUpperCase() + entityType.substring(1);
    entityResource.addProperty(RDF.type, model.createResource(omNamespace + omType));

    RdfPropertyMapper propertyMapper = new RdfPropertyMapper(baseUri, objectMapper, contextCache);
    propertyMapper.mapEntityToRdf(entity, entityResource, model);

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

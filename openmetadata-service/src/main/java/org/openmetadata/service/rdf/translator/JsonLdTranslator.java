package org.openmetadata.service.rdf.translator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.rdf.RdfUtils;

@Slf4j
public class JsonLdTranslator {

  private static final String CONTEXT_BASE_PATH = "/rdf/contexts/";
  private static final List<String> CONTEXT_NAMES =
      List.of(
          "dataAsset-complete",
          "service",
          "team",
          "thread",
          "entityRelationship",
          "governance",
          "quality",
          "operations",
          "lineage",
          "ai",
          "automation");
  private final ObjectMapper objectMapper;
  private final Map<String, Object> contextCache;
  private final String baseUri;
  private final RdfPropertyMapper propertyMapper;
  private final Function<EntityInterface, String> entityTypeResolver;

  public JsonLdTranslator(ObjectMapper objectMapper, String baseUri) {
    this(objectMapper, baseUri, entity -> entity.getEntityReference().getType());
  }

  JsonLdTranslator(
      ObjectMapper objectMapper,
      String baseUri,
      Function<EntityInterface, String> entityTypeResolver) {
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.contextCache = new HashMap<>();
    this.baseUri = Objects.requireNonNull(baseUri, "baseUri");
    this.entityTypeResolver = Objects.requireNonNull(entityTypeResolver, "entityTypeResolver");
    loadContexts();
    this.propertyMapper = new RdfPropertyMapper(baseUri, objectMapper, contextCache);
  }

  private void loadContexts() {
    contextCache.put("base", contextValue("base.jsonld"));
    CONTEXT_NAMES.forEach(
        contextName -> contextCache.put(contextName, contextValue(contextName + ".jsonld")));
  }

  private Object contextValue(String filename) {
    JsonNode context = readContext(filename);
    if (!context.isArray()) {
      return objectMapper.convertValue(context, Object.class);
    }
    List<Object> resolved = new ArrayList<>();
    context.forEach(item -> resolved.add(resolveContextItem(item)));
    return resolved;
  }

  private Object resolveContextItem(JsonNode item) {
    return item.isTextual() && "./base.jsonld".equals(item.asText())
        ? contextCache.get("base")
        : objectMapper.convertValue(item, Object.class);
  }

  private JsonNode readContext(String filename) {
    String path = CONTEXT_BASE_PATH + filename;
    URL resource =
        Optional.ofNullable(getClass().getResource(path))
            .orElseThrow(
                () -> new IllegalStateException("Required JSON-LD context is missing: " + path));
    try (InputStream input = resource.openStream()) {
      return Optional.ofNullable(objectMapper.readTree(input))
          .map(document -> document.get("@context"))
          .orElseThrow(
              () -> new IllegalStateException("JSON-LD context has no @context value: " + path));
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to read JSON-LD context: " + path, exception);
    }
  }

  public ObjectNode toJsonLd(EntityInterface entity) {
    String entityType = resolveEntityType(entity);
    ObjectNode entityJson = createEntityDocument(entity, entityType);
    Object context = selectContext(entityType);
    try {
      return compact(entityJson, context);
    } catch (JsonLdError | IOException exception) {
      LOG.error("Failed to create JSON-LD for entity", exception);
      entityJson.set("@context", objectMapper.valueToTree(context));
      return entityJson;
    }
  }

  private ObjectNode createEntityDocument(EntityInterface entity, String entityType) {
    ObjectNode entityJson = objectMapper.valueToTree(entity);
    addJsonLdPropertiesToReferences(entityJson);
    assignColumnIds(entityJson);
    entityJson.put("@id", baseUri + "entity/" + entityType + "/" + entity.getId());
    entityJson.put("@type", RdfUtils.getRdfType(entityType));
    return entityJson;
  }

  private ObjectNode compact(ObjectNode entityJson, Object context)
      throws JsonLdError, IOException {
    JsonDocument document =
        JsonDocument.of(new StringReader(objectMapper.writeValueAsString(entityJson)));
    JsonDocument contextDocument =
        JsonDocument.of(new StringReader(objectMapper.writeValueAsString(context)));
    JsonObject compacted = JsonLd.compact(document, contextDocument).get();
    JsonNode compactedNode = objectMapper.readTree(compacted.toString());
    if (compactedNode instanceof ObjectNode result) {
      addJsonLdPropertiesToReferences(result);
      return result;
    }
    throw new IllegalStateException("JSON-LD compaction did not produce an object");
  }

  private void addJsonLdPropertiesToReferences(JsonNode node) {
    if (node instanceof ObjectNode object) {
      RdfJsonNode.field(object, "id")
          .filter(JsonNode::isValueNode)
          .map(JsonNode::asText)
          .flatMap(
              identifier ->
                  RdfJsonNode.field(object, "type")
                      .filter(JsonNode::isTextual)
                      .map(JsonNode::asText)
                      .map(type -> new EntityIdentifier(type, identifier)))
          .ifPresent(
              reference -> {
                object.put(
                    "@id", baseUri + "entity/" + reference.type() + "/" + reference.identifier());
                object.put("@type", RdfUtils.getRdfType(reference.type()));
              });
      object.forEach(this::addJsonLdPropertiesToReferences);
    } else if (node.isArray()) {
      node.forEach(this::addJsonLdPropertiesToReferences);
    }
  }

  private record EntityIdentifier(String type, String identifier) {}

  private void assignColumnIds(JsonNode entity) {
    RdfJsonNode.array(entity, "columns")
        .ifPresent(columns -> columns.forEach(this::assignColumnId));
  }

  private void assignColumnId(JsonNode columnNode) {
    if (columnNode instanceof ObjectNode column) {
      RdfJsonNode.field(column, "fullyQualifiedName")
          .filter(JsonNode::isTextual)
          .map(JsonNode::asText)
          .filter(fqn -> !fqn.isBlank())
          .map(fqn -> RdfUtils.columnUri(baseUri, fqn))
          .filter(uri -> !nullOrEmpty(uri))
          .ifPresent(
              uri -> {
                column.put("@id", uri);
                column.put("@type", "om:Column");
              });
      RdfJsonNode.array(column, "children")
          .ifPresent(children -> children.forEach(this::assignColumnId));
    }
  }

  public Model toRdf(EntityInterface entity) {
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

    String entityType = resolveEntityType(entity);
    String entityUri = baseUri + "entity/" + entityType + "/" + entity.getId();

    Resource entityResource = model.createResource(entityUri);

    String rdfType = RdfUtils.getRdfType(entityType);
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

    // Add PROV-O class typing (prov:Entity/Activity/Agent) so PROV-O reasoners can
    // apply standard rules. Skipped when the primary rdfType is already a PROV-O
    // class (e.g. pipeline → prov:Activity) to avoid duplicate triples.
    String provType = RdfUtils.getProvType(entityType);
    if (provType != null && !provType.equals(rdfType)) {
      String provNamespace = model.getNsPrefixURI("prov");
      String provLocalName = provType.substring(provType.indexOf(':') + 1);
      entityResource.addProperty(RDF.type, model.createResource(provNamespace + provLocalName));
    }

    propertyMapper.mapEntityToRdf(entity, entityResource, model);

    LOG.debug(
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
          "eventsubscription",
          "kpi",
          "datainsightchart",
          "webanalyticevent",
          "app",
          "appmarketplacedefinition",
          "document",
          "page" -> contextCache.get("operations");
      case "llmmodel",
          "aiapplication",
          "mcpserver",
          "mcpexecution",
          "agentexecution",
          "prompttemplate" -> contextCache.get("ai");
      case "workflow",
          "workflowdefinition",
          "workflowinstance",
          "workflowinstancestate",
          "automation" -> contextCache.get("automation");
      default -> contextCache.get("base");
    };
  }

  private String resolveEntityType(EntityInterface entity) {
    EntityInterface requiredEntity = Objects.requireNonNull(entity, "entity");
    String entityType = entityTypeResolver.apply(requiredEntity);
    if (nullOrEmpty(entityType)) {
      throw new IllegalArgumentException(
          "Entity type is not registered for " + requiredEntity.getClass().getSimpleName());
    }
    return entityType;
  }
}

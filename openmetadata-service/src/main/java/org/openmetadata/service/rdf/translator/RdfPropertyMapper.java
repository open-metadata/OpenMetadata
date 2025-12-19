package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.rdf.RdfUtils;

/**
 * Maps all entity properties to RDF triples based on context definitions
 */
@Slf4j
public class RdfPropertyMapper {

  private final String baseUri;
  private final ObjectMapper objectMapper;
  private final Map<String, Object> contextCache;

  // Common namespace URIs
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String DCT_NS = "http://purl.org/dc/terms/";
  private static final String DCAT_NS = "http://www.w3.org/ns/dcat#";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";
  private static final String FOAF_NS = "http://xmlns.com/foaf/0.1/";
  private static final String VOID_NS = "http://rdfs.org/ns/void#";
  private static final String CSVW_NS = "http://www.w3.org/ns/csvw#";

  // Properties that should be mapped to structured RDF instead of JSON literals
  private static final Set<String> STRUCTURED_PROPERTIES =
      Set.of("changeDescription", "votes", "lifeCycle", "customProperties", "extension");

  // Lineage properties that need special handling
  private static final Set<String> LINEAGE_PROPERTIES =
      Set.of("upstreamEdges", "downstreamEdges", "lineage");

  public RdfPropertyMapper(
      String baseUri, ObjectMapper objectMapper, Map<String, Object> contextCache) {
    this.baseUri = baseUri;
    this.objectMapper = objectMapper;
    this.contextCache = contextCache;
  }

  /**
   * Convert all entity properties to RDF triples based on context mappings
   */
  public void mapEntityToRdf(EntityInterface entity, Resource entityResource, Model model) {
    try {
      // Convert entity to JSON to access all properties
      JsonNode entityJson = objectMapper.valueToTree(entity);

      // Get the appropriate context for this entity type
      String entityType = entity.getEntityReference().getType();
      Object context = contextCache.get(getContextName(entityType));

      if (context instanceof java.util.List) {
        // Process array context (includes base + specific mappings)
        processArrayContext((java.util.List<Object>) context, entityJson, entityResource, model);
      } else if (context instanceof Map) {
        // Process single context object
        processContextMappings((Map<String, Object>) context, entityJson, entityResource, model);
      }

      // Always add standard properties
      addStandardProperties(entity, entityResource, model);

    } catch (Exception e) {
      LOG.error("Failed to map entity properties to RDF", e);
    }
  }

  private void processArrayContext(
      java.util.List<Object> contextArray,
      JsonNode entityJson,
      Resource entityResource,
      Model model) {
    for (Object contextItem : contextArray) {
      if (contextItem instanceof Map) {
        processContextMappings(
            (Map<String, Object>) contextItem, entityJson, entityResource, model);
      }
    }
  }

  private void processContextMappings(
      Map<String, Object> contextMap, JsonNode entityJson, Resource entityResource, Model model) {
    // Iterate through all fields in the entity JSON
    Iterator<Map.Entry<String, JsonNode>> fields = entityJson.fields();
    while (fields.hasNext()) {
      Map.Entry<String, JsonNode> field = fields.next();
      String fieldName = field.getKey();
      JsonNode fieldValue = field.getValue();

      // Skip internal fields and JSON-LD specific fields
      if (fieldName.startsWith("@")
          || fieldName.equals("href")
          || fieldName.equals("id")
          || fieldName.equals("type")) {
        continue;
      }

      // Look up the mapping in context
      Object mapping = contextMap.get(fieldName);
      if (mapping != null) {
        processFieldMapping(fieldName, fieldValue, mapping, entityResource, model);
      } else {
        // If no mapping found, use default om: namespace
        processUnmappedField(fieldName, fieldValue, entityResource, model);
      }
    }
  }

  private void processFieldMapping(
      String fieldName, JsonNode fieldValue, Object mapping, Resource entityResource, Model model) {
    if (fieldValue == null || fieldValue.isNull() || fieldValue.isMissingNode()) {
      return;
    }

    // Check if this is a lineage property that needs special handling
    if (LINEAGE_PROPERTIES.contains(fieldName)) {
      addLineageProperty(fieldName, fieldValue, entityResource, model);
      return;
    }

    // Check if this is a structured property that needs special handling
    if (STRUCTURED_PROPERTIES.contains(fieldName) && fieldValue.isObject()) {
      addStructuredProperty(fieldName, fieldValue, entityResource, model);
      return;
    }

    if (mapping instanceof String) {
      // Simple property mapping: "name": "rdfs:label"
      addSimpleProperty(entityResource, (String) mapping, fieldValue, model);

    } else if (mapping instanceof Map) {
      Map<String, Object> complexMapping = (Map<String, Object>) mapping;
      String propertyId = (String) complexMapping.get("@id");
      String propertyType = (String) complexMapping.get("@type");
      String container = (String) complexMapping.get("@container");

      if (propertyId != null) {
        if ("@id".equals(propertyType)) {
          // Check for structured property references
          if (STRUCTURED_PROPERTIES.contains(fieldName)) {
            addStructuredProperty(fieldName, fieldValue, entityResource, model);
          } else {
            // This is a reference to another entity
            addEntityReference(entityResource, propertyId, fieldValue, model);
          }
        } else if ("@json".equals(propertyType)) {
          // Store as JSON literal (fallback for properties not yet converted)
          addJsonProperty(entityResource, propertyId, fieldValue, model);
        } else if (container != null) {
          // Handle containers (lists, sets)
          if (STRUCTURED_PROPERTIES.contains(fieldName) && fieldValue.isArray()) {
            addStructuredArrayProperty(fieldName, fieldValue, entityResource, model);
          } else {
            addContainerProperty(entityResource, propertyId, fieldValue, container, model);
          }
        } else {
          // Regular typed property
          addTypedProperty(entityResource, propertyId, fieldValue, propertyType, model);
        }
      }
    }
  }

  private void processUnmappedField(
      String fieldName, JsonNode fieldValue, Resource entityResource, Model model) {
    // Create property in om: namespace
    String propertyUri = OM_NS + fieldName;
    Property property = model.createProperty(propertyUri);

    if (fieldValue.isTextual()) {
      entityResource.addProperty(property, fieldValue.asText());
    } else if (fieldValue.isNumber()) {
      addNumericProperty(entityResource, property, fieldValue, model);
    } else if (fieldValue.isBoolean()) {
      entityResource.addProperty(property, model.createTypedLiteral(fieldValue.asBoolean()));
    } else if (fieldValue.isArray() || fieldValue.isObject()) {
      // Store complex types as JSON
      entityResource.addProperty(
          property, model.createTypedLiteral(fieldValue.toString(), XSDDatatype.XSDstring));
    }
  }

  private void addSimpleProperty(
      Resource resource, String propertyMapping, JsonNode value, Model model) {
    if (value.isNull() || value.isMissingNode()) {
      return;
    }

    Property property = createProperty(propertyMapping, model);

    if (value.isTextual()) {
      resource.addProperty(property, value.asText());
    } else if (value.isNumber()) {
      addNumericProperty(resource, property, value, model);
    } else if (value.isBoolean()) {
      resource.addProperty(property, model.createTypedLiteral(value.asBoolean()));
    }
  }

  private void addEntityReference(
      Resource resource, String propertyId, JsonNode value, Model model) {
    Property property = createProperty(propertyId, model);

    if (value.isObject() && value.has("id") && value.has("type")) {
      // Create reference to the entity (EntityReference)
      String refType = value.get("type").asText();
      String refId = value.get("id").asText();
      String refUri = baseUri + "entity/" + refType + "/" + refId;

      Resource refResource = model.createResource(refUri);
      resource.addProperty(property, refResource);

      // Also add type information for the reference
      refResource.addProperty(RDF.type, model.createResource(getRdfType(refType)));

      // Add basic properties of the reference
      if (value.has("name")) {
        refResource.addProperty(RDFS.label, value.get("name").asText());
      }
      if (value.has("fullyQualifiedName")) {
        refResource.addProperty(
            model.createProperty(OM_NS, "fullyQualifiedName"),
            value.get("fullyQualifiedName").asText());
      }

    } else if (value.isObject() && value.has("tagFQN")) {
      // Handle TagLabel objects
      addTagLabel(resource, property, value, model);

    } else if (value.isArray()) {
      // Handle array of references
      for (JsonNode item : value) {
        addEntityReference(resource, propertyId, item, model);
      }
    }
  }

  private void addTagLabel(Resource resource, Property property, JsonNode tagLabel, Model model) {
    String tagFqn = tagLabel.get("tagFQN").asText();

    // Create a URI for the tag based on its FQN
    // Convert FQN like "PII.None" to a valid URI
    String tagUri = baseUri + "tag/" + tagFqn.replace(".", "/");
    Resource tagResource = model.createResource(tagUri);

    // Link the entity to the tag
    resource.addProperty(property, tagResource);

    // Add tag type
    tagResource.addProperty(RDF.type, model.createResource(OM_NS + "Tag"));

    // Add tagFQN as a property
    tagResource.addProperty(model.createProperty(OM_NS, "tagFQN"), tagFqn);

    // Add tag name if available
    if (tagLabel.has("name")) {
      tagResource.addProperty(RDFS.label, tagLabel.get("name").asText());
    }

    // Add displayName if available
    if (tagLabel.has("displayName")) {
      tagResource.addProperty(SKOS.prefLabel, tagLabel.get("displayName").asText());
    }

    // Add labelType
    if (tagLabel.has("labelType")) {
      tagResource.addProperty(
          model.createProperty(OM_NS, "labelType"), tagLabel.get("labelType").asText());
    }

    // Add source (Classification or Glossary)
    if (tagLabel.has("source")) {
      String source = tagLabel.get("source").asText();
      tagResource.addProperty(model.createProperty(OM_NS, "tagSource"), source);

      // Also add appropriate type based on source
      if ("Glossary".equals(source)) {
        tagResource.addProperty(RDF.type, model.createResource(SKOS.getURI() + "Concept"));
      }
    }

    // Add state
    if (tagLabel.has("state")) {
      tagResource.addProperty(
          model.createProperty(OM_NS, "tagState"), tagLabel.get("state").asText());
    }

    // Add description if available
    if (tagLabel.has("description")) {
      tagResource.addProperty(
          model.createProperty(DCT_NS, "description"), tagLabel.get("description").asText());
    }
  }

  /**
   * Dispatches structured property handling based on field name. These properties are converted
   * from JSON literals to proper RDF structures for better queryability via SPARQL.
   */
  private void addStructuredProperty(
      String fieldName, JsonNode value, Resource entityResource, Model model) {
    switch (fieldName) {
      case "changeDescription" -> addChangeDescription(value, entityResource, model);
      case "votes" -> addVotes(value, entityResource, model);
      case "lifeCycle" -> addLifeCycle(value, entityResource, model);
      case "extension" -> addExtension(value, entityResource, model);
      default -> LOG.warn("Unknown structured property: {}", fieldName);
    }
  }

  /**
   * Handles array-type structured properties (e.g., customProperties)
   */
  private void addStructuredArrayProperty(
      String fieldName, JsonNode value, Resource entityResource, Model model) {
    if ("customProperties".equals(fieldName)) {
      Property property = model.createProperty(OM_NS, "hasCustomProperty");
      for (JsonNode item : value) {
        addCustomProperty(item, entityResource, property, model);
      }
    }
  }

  /**
   * Converts ChangeDescription to structured RDF triples. Enables SPARQL queries like: "Find all
   * entities where description was changed by user X after date Y"
   *
   * <p>Structure: entity -> om:hasChangeDescription -> _:changeNode _:changeNode a
   * om:ChangeDescription _:changeNode om:previousVersion "1.0" _:changeNode om:fieldsAdded ->
   * _:fieldChange1
   */
  private void addChangeDescription(JsonNode changeDesc, Resource entityResource, Model model) {
    if (changeDesc == null || changeDesc.isNull()) {
      return;
    }

    // Create a blank node for the change description
    String changeNodeUri =
        baseUri + "change/" + entityResource.getLocalName() + "/" + UUID.randomUUID();
    Resource changeNode = model.createResource(changeNodeUri);

    // Link entity to change description
    Property hasChangeDesc = model.createProperty(OM_NS, "hasChangeDescription");
    entityResource.addProperty(hasChangeDesc, changeNode);

    // Add type
    changeNode.addProperty(RDF.type, model.createResource(OM_NS + "ChangeDescription"));

    // Add previous version
    if (changeDesc.has("previousVersion")) {
      changeNode.addProperty(
          model.createProperty(OM_NS, "previousVersion"),
          model.createTypedLiteral(changeDesc.get("previousVersion").asDouble()));
    }

    // Add fields added
    if (changeDesc.has("fieldsAdded") && changeDesc.get("fieldsAdded").isArray()) {
      addFieldChanges(
          changeDesc.get("fieldsAdded"), changeNode, "fieldsAdded", entityResource, model);
    }

    // Add fields updated
    if (changeDesc.has("fieldsUpdated") && changeDesc.get("fieldsUpdated").isArray()) {
      addFieldChanges(
          changeDesc.get("fieldsUpdated"), changeNode, "fieldsUpdated", entityResource, model);
    }

    // Add fields deleted
    if (changeDesc.has("fieldsDeleted") && changeDesc.get("fieldsDeleted").isArray()) {
      addFieldChanges(
          changeDesc.get("fieldsDeleted"), changeNode, "fieldsDeleted", entityResource, model);
    }
  }

  /**
   * Adds field change details as structured RDF
   */
  private void addFieldChanges(
      JsonNode fieldsArray,
      Resource changeNode,
      String changeType,
      Resource entityResource,
      Model model) {
    Property changeProp = model.createProperty(OM_NS, changeType);

    for (JsonNode fieldChange : fieldsArray) {
      // Create a blank node for each field change
      String fieldChangeUri =
          baseUri + "fieldChange/" + entityResource.getLocalName() + "/" + UUID.randomUUID();
      Resource fieldChangeNode = model.createResource(fieldChangeUri);

      changeNode.addProperty(changeProp, fieldChangeNode);
      fieldChangeNode.addProperty(RDF.type, model.createResource(OM_NS + "FieldChange"));

      // Add field name
      if (fieldChange.has("name")) {
        fieldChangeNode.addProperty(
            model.createProperty(OM_NS, "fieldName"), fieldChange.get("name").asText());
      }

      // Add old value (as string representation for queryability)
      if (fieldChange.has("oldValue") && !fieldChange.get("oldValue").isNull()) {
        JsonNode oldVal = fieldChange.get("oldValue");
        String oldValueStr = oldVal.isTextual() ? oldVal.asText() : oldVal.toString();
        fieldChangeNode.addProperty(model.createProperty(OM_NS, "oldValue"), oldValueStr);
      }

      // Add new value (as string representation for queryability)
      if (fieldChange.has("newValue") && !fieldChange.get("newValue").isNull()) {
        JsonNode newVal = fieldChange.get("newValue");
        String newValueStr = newVal.isTextual() ? newVal.asText() : newVal.toString();
        fieldChangeNode.addProperty(model.createProperty(OM_NS, "newValue"), newValueStr);
      }
    }
  }

  /**
   * Converts Votes to structured RDF triples. Enables SPARQL queries like: "Find all entities with
   * more than 10 upvotes" or "Find entities upvoted by user X"
   */
  private void addVotes(JsonNode votes, Resource entityResource, Model model) {
    if (votes == null || votes.isNull()) {
      return;
    }

    // Create a resource for votes
    String votesUri = baseUri + "votes/" + entityResource.getLocalName();
    Resource votesNode = model.createResource(votesUri);

    // Link entity to votes
    Property hasVotes = model.createProperty(OM_NS, "hasVotes");
    entityResource.addProperty(hasVotes, votesNode);

    // Add type
    votesNode.addProperty(RDF.type, model.createResource(OM_NS + "Votes"));

    // Add upVotes count
    if (votes.has("upVotes")) {
      votesNode.addProperty(
          model.createProperty(OM_NS, "upVotes"),
          model.createTypedLiteral(votes.get("upVotes").asInt()));
    }

    // Add downVotes count
    if (votes.has("downVotes")) {
      votesNode.addProperty(
          model.createProperty(OM_NS, "downVotes"),
          model.createTypedLiteral(votes.get("downVotes").asInt()));
    }

    // Add upVoters as entity references
    if (votes.has("upVoters") && votes.get("upVoters").isArray()) {
      Property upVotersProp = model.createProperty(OM_NS, "upVoters");
      for (JsonNode voter : votes.get("upVoters")) {
        if (voter.has("id") && voter.has("type")) {
          String voterUri =
              baseUri + "entity/" + voter.get("type").asText() + "/" + voter.get("id").asText();
          votesNode.addProperty(upVotersProp, model.createResource(voterUri));
        }
      }
    }

    // Add downVoters as entity references
    if (votes.has("downVoters") && votes.get("downVoters").isArray()) {
      Property downVotersProp = model.createProperty(OM_NS, "downVoters");
      for (JsonNode voter : votes.get("downVoters")) {
        if (voter.has("id") && voter.has("type")) {
          String voterUri =
              baseUri + "entity/" + voter.get("type").asText() + "/" + voter.get("id").asText();
          votesNode.addProperty(downVotersProp, model.createResource(voterUri));
        }
      }
    }
  }

  /**
   * Converts LifeCycle to structured RDF triples. Enables SPARQL queries like: "Find all entities
   * last accessed before date X" or "Find entities created by user Y"
   */
  private void addLifeCycle(JsonNode lifeCycle, Resource entityResource, Model model) {
    if (lifeCycle == null || lifeCycle.isNull()) {
      return;
    }

    // Create a resource for lifecycle
    String lifeCycleUri = baseUri + "lifecycle/" + entityResource.getLocalName();
    Resource lifeCycleNode = model.createResource(lifeCycleUri);

    // Link entity to lifecycle
    Property hasLifeCycle = model.createProperty(OM_NS, "hasLifeCycle");
    entityResource.addProperty(hasLifeCycle, lifeCycleNode);

    // Add type
    lifeCycleNode.addProperty(RDF.type, model.createResource(OM_NS + "LifeCycle"));

    // Add created access details
    if (lifeCycle.has("created")) {
      addAccessDetails(lifeCycle.get("created"), lifeCycleNode, "lifecycleCreated", model);
    }

    // Add updated access details
    if (lifeCycle.has("updated")) {
      addAccessDetails(lifeCycle.get("updated"), lifeCycleNode, "lifecycleUpdated", model);
    }

    // Add accessed details
    if (lifeCycle.has("accessed")) {
      addAccessDetails(lifeCycle.get("accessed"), lifeCycleNode, "lifecycleAccessed", model);
    }
  }

  /**
   * Adds access details (timestamp, user, process) as structured RDF
   */
  private void addAccessDetails(
      JsonNode accessDetails, Resource lifeCycleNode, String propertyName, Model model) {
    if (accessDetails == null || accessDetails.isNull()) {
      return;
    }

    // Create access details node
    String accessUri = lifeCycleNode.getURI() + "/" + propertyName;
    Resource accessNode = model.createResource(accessUri);

    // Link lifecycle to access details
    Property accessProp = model.createProperty(OM_NS, propertyName);
    lifeCycleNode.addProperty(accessProp, accessNode);

    // Add type
    accessNode.addProperty(RDF.type, model.createResource(OM_NS + "AccessDetails"));

    // Add timestamp
    if (accessDetails.has("timestamp")) {
      accessNode.addProperty(
          model.createProperty(OM_NS, "accessTimestamp"),
          model.createTypedLiteral(
              accessDetails.get("timestamp").asText(), XSDDatatype.XSDdateTime));
    }

    // Add accessedBy (user reference)
    if (accessDetails.has("accessedBy") && accessDetails.get("accessedBy").has("id")) {
      JsonNode user = accessDetails.get("accessedBy");
      String userType = user.has("type") ? user.get("type").asText() : "user";
      String userUri = baseUri + "entity/" + userType + "/" + user.get("id").asText();
      accessNode.addProperty(
          model.createProperty(OM_NS, "accessedBy"), model.createResource(userUri));
    }

    // Add accessedByAProcess (pipeline reference)
    if (accessDetails.has("accessedByAProcess")
        && accessDetails.get("accessedByAProcess").has("id")) {
      JsonNode process = accessDetails.get("accessedByAProcess");
      String processType = process.has("type") ? process.get("type").asText() : "pipeline";
      String processUri = baseUri + "entity/" + processType + "/" + process.get("id").asText();
      accessNode.addProperty(
          model.createProperty(OM_NS, "accessedByProcess"), model.createResource(processUri));
    }
  }

  /**
   * Converts CustomProperty to structured RDF triples. Enables SPARQL queries like: "Find all
   * entities with custom property 'costCenter' = 'Engineering'"
   */
  private void addCustomProperty(
      JsonNode customProp, Resource entityResource, Property linkProperty, Model model) {
    if (customProp == null || customProp.isNull()) {
      return;
    }

    // Create a resource for the custom property
    String propUri =
        baseUri + "customProperty/" + entityResource.getLocalName() + "/" + UUID.randomUUID();
    Resource propNode = model.createResource(propUri);

    // Link entity to custom property
    entityResource.addProperty(linkProperty, propNode);

    // Add type
    propNode.addProperty(RDF.type, model.createResource(OM_NS + "CustomProperty"));

    // Add property name
    if (customProp.has("name")) {
      propNode.addProperty(
          model.createProperty(OM_NS, "propertyName"), customProp.get("name").asText());
    }

    // Add property value (convert to string for queryability)
    if (customProp.has("value") && !customProp.get("value").isNull()) {
      JsonNode val = customProp.get("value");
      String valueStr = val.isTextual() ? val.asText() : val.toString();
      propNode.addProperty(model.createProperty(OM_NS, "propertyValue"), valueStr);
    }

    // Add property type if available
    if (customProp.has("propertyType")) {
      JsonNode typeNode = customProp.get("propertyType");
      if (typeNode.has("name")) {
        propNode.addProperty(
            model.createProperty(OM_NS, "propertyType"), typeNode.get("name").asText());
      }
    }
  }

  /**
   * Converts Extension data to structured RDF triples. Extensions are key-value pairs that can be
   * queried via SPARQL.
   */
  private void addExtension(JsonNode extension, Resource entityResource, Model model) {
    if (extension == null || extension.isNull()) {
      return;
    }

    // Create a resource for the extension
    String extUri = baseUri + "extension/" + entityResource.getLocalName();
    Resource extNode = model.createResource(extUri);

    // Link entity to extension
    Property hasExtension = model.createProperty(OM_NS, "hasExtension");
    entityResource.addProperty(hasExtension, extNode);

    // Add type
    extNode.addProperty(RDF.type, model.createResource(OM_NS + "Extension"));

    // Iterate through extension fields and add them as key-value pairs
    Iterator<Map.Entry<String, JsonNode>> fields = extension.fields();
    while (fields.hasNext()) {
      Map.Entry<String, JsonNode> field = fields.next();
      String key = field.getKey();
      JsonNode value = field.getValue();

      // Create a property for each extension key in the om: namespace
      Property extKeyProp = model.createProperty(OM_NS, "ext_" + key);

      if (value.isTextual()) {
        extNode.addProperty(extKeyProp, value.asText());
      } else if (value.isNumber()) {
        if (value.isInt()) {
          extNode.addProperty(extKeyProp, model.createTypedLiteral(value.asInt()));
        } else if (value.isDouble()) {
          extNode.addProperty(extKeyProp, model.createTypedLiteral(value.asDouble()));
        }
      } else if (value.isBoolean()) {
        extNode.addProperty(extKeyProp, model.createTypedLiteral(value.asBoolean()));
      } else {
        // For complex values, store as string representation
        extNode.addProperty(extKeyProp, value.toString());
      }
    }
  }

  /**
   * Handles lineage properties (upstreamEdges, downstreamEdges, lineage). Converts lineage edges to
   * proper RDF triples using PROV-O vocabulary for provenance tracking. Enables SPARQL queries
   * like: "Find all upstream tables of dashboard X" or "What pipelines create table Y"
   */
  private void addLineageProperty(
      String fieldName, JsonNode value, Resource entityResource, Model model) {
    if (value == null || value.isNull()) {
      return;
    }

    switch (fieldName) {
      case "upstreamEdges" -> {
        if (value.isArray()) {
          for (JsonNode edge : value) {
            addLineageEdge(edge, entityResource, "upstream", model);
          }
        }
      }
      case "downstreamEdges" -> {
        if (value.isArray()) {
          for (JsonNode edge : value) {
            addLineageEdge(edge, entityResource, "downstream", model);
          }
        }
      }
      case "lineage" -> {
        // Handle full lineage object if present
        if (value.isObject()) {
          addFullLineage(value, entityResource, model);
        }
      }
    }
  }

  /**
   * Adds a single lineage edge as RDF triples. Uses PROV-O vocabulary: -
   * prov:wasDerivedFrom for upstream relationships - prov:wasInfluencedBy for downstream
   * relationships
   */
  private void addLineageEdge(
      JsonNode edge, Resource entityResource, String direction, Model model) {
    if (edge == null || edge.isNull()) {
      return;
    }

    // Get the related entity (fromEntity for upstream, toEntity for downstream)
    String relatedEntityField = "upstream".equals(direction) ? "fromEntity" : "toEntity";
    JsonNode relatedEntityNode = edge.get(relatedEntityField);

    Resource relatedEntityResource = null;
    if (relatedEntityNode != null) {
      if (relatedEntityNode.isTextual()) {
        // UUID string
        String relatedEntityUri = baseUri + "entity/unknown/" + relatedEntityNode.asText();
        relatedEntityResource = model.createResource(relatedEntityUri);
      } else if (relatedEntityNode.isObject() && relatedEntityNode.has("id")) {
        // EntityReference object
        String entityType =
            relatedEntityNode.has("type") ? relatedEntityNode.get("type").asText() : "entity";
        String entityId = relatedEntityNode.get("id").asText();
        String relatedEntityUri = baseUri + "entity/" + entityType + "/" + entityId;
        relatedEntityResource = model.createResource(relatedEntityUri);

        // Add type to the related entity
        relatedEntityResource.addProperty(RDF.type, model.createResource(getRdfType(entityType)));

        // Add name if available
        if (relatedEntityNode.has("name")) {
          relatedEntityResource.addProperty(RDFS.label, relatedEntityNode.get("name").asText());
        }
        if (relatedEntityNode.has("fullyQualifiedName")) {
          relatedEntityResource.addProperty(
              model.createProperty(OM_NS, "fullyQualifiedName"),
              relatedEntityNode.get("fullyQualifiedName").asText());
        }
      }
    }

    if (relatedEntityResource != null) {
      // Add the lineage relationship using PROV-O vocabulary
      if ("upstream".equals(direction)) {
        // This entity was derived from the upstream entity
        Property derivedFrom = model.createProperty(PROV_NS, "wasDerivedFrom");
        entityResource.addProperty(derivedFrom, relatedEntityResource);

        // Also add OpenMetadata-specific property for easier querying
        Property upstream = model.createProperty(OM_NS, "upstream");
        entityResource.addProperty(upstream, relatedEntityResource);
      } else {
        // This entity influenced the downstream entity
        Property influenced = model.createProperty(PROV_NS, "wasInfluencedBy");
        relatedEntityResource.addProperty(influenced, entityResource);

        // Also add OpenMetadata-specific property for easier querying
        Property downstream = model.createProperty(OM_NS, "downstream");
        entityResource.addProperty(downstream, relatedEntityResource);
      }

      // Add lineage details if present
      if (edge.has("lineageDetails") && !edge.get("lineageDetails").isNull()) {
        addLineageDetails(edge.get("lineageDetails"), entityResource, relatedEntityResource, model);
      }
    }
  }

  /**
   * Adds lineage details (SQL query, pipeline, column lineage) as structured RDF
   */
  private void addLineageDetails(
      JsonNode details, Resource fromEntity, Resource toEntity, Model model) {
    if (details == null || details.isNull()) {
      return;
    }

    // Create a lineage details resource
    String detailsUri =
        baseUri
            + "lineageDetails/"
            + fromEntity.getLocalName()
            + "/"
            + toEntity.getLocalName()
            + "/"
            + UUID.randomUUID();
    Resource detailsResource = model.createResource(detailsUri);

    // Link from entity to lineage details
    Property hasLineageDetails = model.createProperty(OM_NS, "hasLineageDetails");
    fromEntity.addProperty(hasLineageDetails, detailsResource);

    // Add type
    detailsResource.addProperty(RDF.type, model.createResource(OM_NS + "LineageDetails"));

    // Add SQL query
    if (details.has("sqlQuery") && !details.get("sqlQuery").isNull()) {
      detailsResource.addProperty(
          model.createProperty(OM_NS, "sqlQuery"), details.get("sqlQuery").asText());
    }

    // Add lineage source type
    if (details.has("source") && !details.get("source").isNull()) {
      detailsResource.addProperty(
          model.createProperty(OM_NS, "lineageSource"), details.get("source").asText());
    }

    // Add description
    if (details.has("description") && !details.get("description").isNull()) {
      detailsResource.addProperty(
          model.createProperty(DCT_NS, "description"), details.get("description").asText());
    }

    // Add pipeline reference
    if (details.has("pipeline") && details.get("pipeline").has("id")) {
      JsonNode pipeline = details.get("pipeline");
      String pipelineType = pipeline.has("type") ? pipeline.get("type").asText() : "pipeline";
      String pipelineUri = baseUri + "entity/" + pipelineType + "/" + pipeline.get("id").asText();
      Resource pipelineResource = model.createResource(pipelineUri);

      // Link lineage to pipeline using PROV-O
      detailsResource.addProperty(
          model.createProperty(PROV_NS, "wasGeneratedBy"), pipelineResource);

      // Add pipeline type
      pipelineResource.addProperty(RDF.type, model.createResource(getRdfType(pipelineType)));
    }

    // Add column lineage
    if (details.has("columnsLineage") && details.get("columnsLineage").isArray()) {
      addColumnLineage(details.get("columnsLineage"), detailsResource, model);
    }

    // Add timestamps
    if (details.has("createdAt") && !details.get("createdAt").isNull()) {
      detailsResource.addProperty(
          model.createProperty(DCT_NS, "created"),
          model.createTypedLiteral(details.get("createdAt").asText(), XSDDatatype.XSDdateTime));
    }
    if (details.has("updatedAt") && !details.get("updatedAt").isNull()) {
      detailsResource.addProperty(
          model.createProperty(DCT_NS, "modified"),
          model.createTypedLiteral(details.get("updatedAt").asText(), XSDDatatype.XSDdateTime));
    }

    // Add creator/updater
    if (details.has("createdBy") && !details.get("createdBy").isNull()) {
      detailsResource.addProperty(
          model.createProperty(OM_NS, "lineageCreatedBy"), details.get("createdBy").asText());
    }
    if (details.has("updatedBy") && !details.get("updatedBy").isNull()) {
      detailsResource.addProperty(
          model.createProperty(OM_NS, "lineageUpdatedBy"), details.get("updatedBy").asText());
    }
  }

  /**
   * Adds column-level lineage as structured RDF. Enables SPARQL queries like: "Which columns feed
   * into column X" or "What transformation is applied to column Y"
   */
  private void addColumnLineage(
      JsonNode columnsLineage, Resource lineageDetailsResource, Model model) {
    Property hasColumnLineage = model.createProperty(OM_NS, "hasColumnLineage");

    for (JsonNode colLineage : columnsLineage) {
      // Create column lineage resource
      String colLineageUri =
          lineageDetailsResource.getURI() + "/columnLineage/" + UUID.randomUUID();
      Resource colLineageResource = model.createResource(colLineageUri);

      lineageDetailsResource.addProperty(hasColumnLineage, colLineageResource);
      colLineageResource.addProperty(RDF.type, model.createResource(OM_NS + "ColumnLineage"));

      // Add source columns
      if (colLineage.has("fromColumns") && colLineage.get("fromColumns").isArray()) {
        Property fromColumnProp = model.createProperty(OM_NS, "fromColumn");
        for (JsonNode fromCol : colLineage.get("fromColumns")) {
          colLineageResource.addProperty(fromColumnProp, fromCol.asText());
        }
      }

      // Add destination column
      if (colLineage.has("toColumn") && !colLineage.get("toColumn").isNull()) {
        colLineageResource.addProperty(
            model.createProperty(OM_NS, "toColumn"), colLineage.get("toColumn").asText());
      }

      // Add transformation function
      if (colLineage.has("function") && !colLineage.get("function").isNull()) {
        colLineageResource.addProperty(
            model.createProperty(OM_NS, "transformFunction"), colLineage.get("function").asText());
      }
    }
  }

  /**
   * Handles full lineage object (entity + nodes + upstreamEdges + downstreamEdges)
   */
  private void addFullLineage(JsonNode lineage, Resource entityResource, Model model) {
    // Process upstream edges
    if (lineage.has("upstreamEdges") && lineage.get("upstreamEdges").isArray()) {
      for (JsonNode edge : lineage.get("upstreamEdges")) {
        addLineageEdge(edge, entityResource, "upstream", model);
      }
    }

    // Process downstream edges
    if (lineage.has("downstreamEdges") && lineage.get("downstreamEdges").isArray()) {
      for (JsonNode edge : lineage.get("downstreamEdges")) {
        addLineageEdge(edge, entityResource, "downstream", model);
      }
    }

    // Process lineage nodes (other entities in the lineage graph)
    if (lineage.has("nodes") && lineage.get("nodes").isArray()) {
      Property hasLineageNode = model.createProperty(OM_NS, "hasLineageNode");
      for (JsonNode node : lineage.get("nodes")) {
        if (node.has("id") && node.has("type")) {
          String nodeUri =
              baseUri + "entity/" + node.get("type").asText() + "/" + node.get("id").asText();
          Resource nodeResource = model.createResource(nodeUri);
          entityResource.addProperty(hasLineageNode, nodeResource);

          // Add type to the node
          nodeResource.addProperty(
              RDF.type, model.createResource(getRdfType(node.get("type").asText())));

          // Add name if available
          if (node.has("name")) {
            nodeResource.addProperty(RDFS.label, node.get("name").asText());
          }
        }
      }
    }
  }

  private void addJsonProperty(Resource resource, String propertyId, JsonNode value, Model model) {
    if (!value.isNull()) {
      Property property = createProperty(propertyId, model);
      resource.addProperty(
          property, model.createTypedLiteral(value.toString(), XSDDatatype.XSDstring));
    }
  }

  private void addContainerProperty(
      Resource resource, String propertyId, JsonNode value, String container, Model model) {
    if (value.isArray()) {
      Property property = createProperty(propertyId, model);

      if ("@list".equals(container)) {
        // Create RDF list
        org.apache.jena.rdf.model.RDFList list = model.createList();
        for (JsonNode item : value) {
          if (item.isTextual()) {
            list = list.with(model.createLiteral(item.asText()));
          } else if (item.isObject() && item.has("id")) {
            // Entity reference in list
            String refUri =
                baseUri + "entity/" + item.get("type").asText() + "/" + item.get("id").asText();
            list = list.with(model.createResource(refUri));
          }
        }
        resource.addProperty(property, list);

      } else {
        // @set or default - add multiple values
        for (JsonNode item : value) {
          if (item.isTextual()) {
            resource.addProperty(property, item.asText());
          } else if (item.isObject()) {
            addEntityReference(resource, propertyId, item, model);
          }
        }
      }
    }
  }

  private void addTypedProperty(
      Resource resource, String propertyId, JsonNode value, String type, Model model) {
    Property property = createProperty(propertyId, model);

    if (type != null && type.startsWith("xsd:")) {
      String xsdType = type.substring(4);
      XSDDatatype datatype = getXSDDatatype(xsdType);

      if (datatype != null && !value.isNull()) {
        resource.addProperty(property, model.createTypedLiteral(value.asText(), datatype));
      }
    } else {
      addSimpleProperty(resource, propertyId, value, model);
    }
  }

  private void addNumericProperty(
      Resource resource, Property property, JsonNode value, Model model) {
    if (value.isInt()) {
      resource.addProperty(property, model.createTypedLiteral(value.asInt()));
    } else if (value.isLong()) {
      resource.addProperty(property, model.createTypedLiteral(value.asLong()));
    } else if (value.isDouble()) {
      resource.addProperty(property, model.createTypedLiteral(value.asDouble()));
    }
  }

  private void addStandardProperties(EntityInterface entity, Resource resource, Model model) {
    // Add timestamps
    if (entity.getUpdatedAt() != null) {
      resource.addProperty(
          model.createProperty(DCT_NS, "modified"),
          model.createTypedLiteral(entity.getUpdatedAt().toString(), XSDDatatype.XSDdateTime));
    }

    // Add version
    if (entity.getVersion() != null) {
      resource.addProperty(
          model.createProperty(DCAT_NS, "version"), model.createTypedLiteral(entity.getVersion()));
    }
  }

  private Property createProperty(String propertyMapping, Model model) {
    if (propertyMapping.contains(":")) {
      String[] parts = propertyMapping.split(":", 2);
      String prefix = parts[0];
      String localName = parts[1];

      String namespace = getNamespace(prefix);
      if (namespace != null) {
        return model.createProperty(namespace, localName);
      }
    }

    // Default to creating property with full URI
    return model.createProperty(propertyMapping);
  }

  private String getNamespace(String prefix) {
    return switch (prefix) {
      case "om" -> OM_NS;
      case "dct" -> DCT_NS;
      case "dcat" -> DCAT_NS;
      case "prov" -> PROV_NS;
      case "foaf" -> FOAF_NS;
      case "rdfs" -> RDFS.getURI();
      case "skos" -> SKOS.getURI();
      case "void" -> VOID_NS;
      case "csvw" -> CSVW_NS;
      default -> null;
    };
  }

  private XSDDatatype getXSDDatatype(String type) {
    return switch (type) {
      case "string" -> XSDDatatype.XSDstring;
      case "boolean" -> XSDDatatype.XSDboolean;
      case "integer" -> XSDDatatype.XSDinteger;
      case "long" -> XSDDatatype.XSDlong;
      case "double" -> XSDDatatype.XSDdouble;
      case "float" -> XSDDatatype.XSDfloat;
      case "dateTime" -> XSDDatatype.XSDdateTime;
      case "date" -> XSDDatatype.XSDdate;
      case "decimal" -> XSDDatatype.XSDdecimal;
      default -> XSDDatatype.XSDstring;
    };
  }

  private String getContextName(String entityType) {
    return switch (entityType.toLowerCase()) {
      case "table",
          "database",
          "databaseschema",
          "pipeline",
          "topic",
          "dashboard",
          "chart",
          "mlmodel",
          "container",
          "report" -> "dataAsset-complete";
      case "databaseservice",
          "dashboardservice",
          "messagingservice",
          "pipelineservice",
          "mlmodelservice",
          "storageservice" -> "service";
      case "user", "team", "role" -> "team";
      case "glossary", "glossaryterm", "tag", "classification" -> "governance";
      default -> "base";
    };
  }

  private String getRdfType(String entityType) {
    return RdfUtils.getRdfType(entityType);
  }
}

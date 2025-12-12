package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Iterator;
import java.util.Map;
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
          // This is a reference to another entity
          addEntityReference(entityResource, propertyId, fieldValue, model);
        } else if ("@json".equals(propertyType)) {
          // Store as JSON literal
          addJsonProperty(entityResource, propertyId, fieldValue, model);
        } else if (container != null) {
          // Handle containers (lists, sets)
          addContainerProperty(entityResource, propertyId, fieldValue, container, model);
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
      // Create reference to the entity
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

    } else if (value.isArray()) {
      // Handle array of references
      for (JsonNode item : value) {
        addEntityReference(resource, propertyId, item, model);
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

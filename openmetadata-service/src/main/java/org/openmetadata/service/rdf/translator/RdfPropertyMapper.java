package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Maps all entity properties to RDF triples based on context definitions
 */
@Slf4j
public class RdfPropertyMapper {

  private final String baseUri;
  private final ObjectMapper objectMapper;
  private final Map<String, Object> contextCache;
  private final Map<String, UUID> glossaryTermIdCache = new ConcurrentHashMap<>();
  private final Map<String, UUID> classificationTagIdCache = new ConcurrentHashMap<>();
  private static final String TIER_CLASSIFICATION_PREFIX = "Tier.";

  // Common namespace URIs
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String DCT_NS = "http://purl.org/dc/terms/";
  private static final String DCAT_NS = "http://www.w3.org/ns/dcat#";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";
  private static final String FOAF_NS = "http://xmlns.com/foaf/0.1/";
  private static final String VOID_NS = "http://rdfs.org/ns/void#";
  private static final String CSVW_NS = "http://www.w3.org/ns/csvw#";
  private static final String DPROD_NS = "https://ekgf.github.io/dprod/";

  // Properties that should be mapped to structured RDF instead of JSON literals
  private static final Set<String> STRUCTURED_PROPERTIES =
      Set.of("lifeCycle", "customProperties", "extension", "certification");

  // Properties that should be omitted from RDF because they are audit/helper data.
  private static final Set<String> IGNORED_PROPERTIES = Set.of("changeDescription", "votes");

  // Lineage properties that need special handling
  private static final Set<String> LINEAGE_PROPERTIES =
      Set.of("upstreamEdges", "downstreamEdges", "lineage");

  // Direct URI-valued predicates the translator emits from an entity. These
  // are the predicates whose VALUE can change (or shrink to empty) between
  // writes of the same entity — e.g. tags removed, owner changed, domain
  // unset — without any relationship-hook firing. JenaFusekiStorage.storeEntity
  // uses this set (unioned with the predicates actually emitted in the current
  // model) to scope its DELETE, so old values get cleaned up while
  // hook-managed predicates (om:UPSTREAM, om:owns/contains/…, etc.) stay
  // intact. Add to this set when a new URI-valued direct predicate is
  // introduced in this class; the unit test
  // RdfTranslatorManagedPredicatesTest will fail otherwise.
  public static final Set<String> TRANSLATOR_MANAGED_DIRECT_PREDICATES =
      Set.of(
          // Identity / typing
          RDF.type.getURI(),
          // Owner / attribution
          OM_NS + "hasOwner",
          PROV_NS + "wasAttributedTo",
          // Tags / glossary terms / tier (all addTagLabel paths)
          OM_NS + "hasTag",
          OM_NS + "hasGlossaryTerm",
          OM_NS + "hasTier",
          // Domain / data product
          OM_NS + "belongsToDomain",
          OM_NS + "hasDataProduct",
          // Source provenance (translator only, not a hook)
          DCT_NS + "source",
          OM_NS + "sourceUrl",
          // Structured sub-resources attached to the entity — the entity's
          // direct triple pointing at the blank node must be deleted so the
          // new model's blank node replaces it. The blank node subtree itself
          // becomes orphaned; that's a separate (out-of-scope) GC concern.
          OM_NS + "hasLifeCycle",
          OM_NS + "hasCertification",
          OM_NS + "hasExtension",
          OM_NS + "hasCustomProperty");

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
    // Flatten all context maps in the array into one combined map BEFORE iterating
    // entity fields, so each field gets resolved against the union of mappings
    // exactly once. Without this, processContextMappings runs per-context-map and
    // the same field can be emitted multiple times: e.g. `owners` is mapped in
    // base.jsonld (→ om:hasOwner) but absent from `dataAsset-complete`, so the
    // second pass falls through to processUnmappedField and emits an extra
    // `om:owners` predicate alongside om:hasOwner — duplicate triples for the
    // same logical relationship. Later contexts win on key conflicts (standard
    // JSON-LD context-merge semantics).
    Map<String, Object> mergedContext = new java.util.HashMap<>();
    for (Object contextItem : contextArray) {
      if (contextItem instanceof Map) {
        mergedContext.putAll((Map<String, Object>) contextItem);
      }
    }
    processContextMappings(mergedContext, entityJson, entityResource, model);
  }

  // Fields that are handled separately with typed predicates (not via JSON-LD context)
  private static final Set<String> TYPED_RELATION_FIELDS = Set.of("relatedTerms");

  // Fields where the array contains EntityReferences. When the field also has a
  // JSON-LD context mapping the mapped path emits clean `om:<predicate> <ref>`
  // triples and the unmapped path's JSON-string literal would be redundant noise.
  // For fields without a context mapping the unmapped path is the ONLY path, so we
  // can't simply skip — we expand each array element as an entity reference using
  // an `om:<fieldName>` predicate so the data isn't lost.
  private static final Set<String> ENTITY_REFERENCE_ARRAY_FIELDS =
      Set.of("owners", "followers", "reviewers", "voters", "experts", "domains", "dataProducts");

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

      // Skip fields that are handled separately with typed predicates
      // (e.g., relatedTerms which use typed relations like broader, synonym, etc.)
      if (TYPED_RELATION_FIELDS.contains(fieldName) || IGNORED_PROPERTIES.contains(fieldName)) {
        continue;
      }

      // Structured properties (certification, lifeCycle, etc.) are handled before the JSON-LD
      // context lookup so they get proper RDF triples even when no context entry exists for them.
      if (STRUCTURED_PROPERTIES.contains(fieldName)
          && fieldValue != null
          && !fieldValue.isNull()
          && (fieldValue.isObject() || fieldValue.isArray())) {
        if (fieldValue.isArray()) {
          addStructuredArrayProperty(fieldName, fieldValue, entityResource, model);
        } else {
          addStructuredProperty(fieldName, fieldValue, entityResource, model);
        }
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

    // PROV-O attribution: emit prov:wasAttributedTo for each owner in addition to
    // the standard om:owners triples. Lets external SPARQL clients query attribution
    // using the W3C PROV-O vocabulary instead of OpenMetadata-specific predicates.
    if ("owners".equals(fieldName) && fieldValue.isArray()) {
      addProvAttribution(entityResource, fieldValue, model);
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
    // PROV-O attribution mirror — fires here too because not every entity context
    // declares the owners field, in which case it falls through to the unmapped path
    // and bypasses processFieldMapping.
    if ("owners".equals(fieldName) && fieldValue.isArray()) {
      addProvAttribution(entityResource, fieldValue, model);
    }

    // EntityReference arrays: don't dump the raw JSON as a literal. If the array is
    // empty there's nothing to emit. Otherwise expand each element through
    // addEntityReference so the data still lands as proper `om:<fieldName> <ref>`
    // triples even when no JSON-LD context maps the field. For fields the mapped
    // path also handles (e.g. owners), this is a no-op because the same triples
    // were already added — Jena's Model dedupes identical triples.
    if (ENTITY_REFERENCE_ARRAY_FIELDS.contains(fieldName) && fieldValue.isArray()) {
      if (fieldValue.isEmpty()) {
        return;
      }
      addEntityReference(entityResource, OM_NS + fieldName, fieldValue, model);
      return;
    }

    // Skip empty arrays / objects — emitting "[]" or "{}" string literals creates
    // noise without providing useful information.
    if ((fieldValue.isArray() && fieldValue.isEmpty())
        || (fieldValue.isObject() && fieldValue.isEmpty())) {
      return;
    }

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

  private void addProvAttribution(Resource entityResource, JsonNode owners, Model model) {
    Property attributedTo = model.createProperty(PROV_NS, "wasAttributedTo");
    for (JsonNode owner : owners) {
      if (owner.isObject() && owner.has("id") && owner.has("type")) {
        String ownerUri =
            baseUri + "entity/" + owner.get("type").asText() + "/" + owner.get("id").asText();
        entityResource.addProperty(attributedTo, model.createResource(ownerUri));
      }
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
      refResource.addProperty(RDF.type, createTypeResource(refType, model));

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
    String source = tagLabel.has("source") ? tagLabel.get("source").asText() : "Classification";
    boolean isGlossary = "Glossary".equalsIgnoreCase(source);

    Resource tagResource = resolveTagResource(tagFqn, source, tagLabel, model);
    resource.addProperty(property, tagResource);

    if (isGlossary) {
      tagResource.addProperty(RDF.type, createTypeResource("glossaryTerm", model));
      tagResource.addProperty(RDF.type, model.createResource(SKOS.getURI() + "Concept"));
      resource.addProperty(model.createProperty(OM_NS, "hasGlossaryTerm"), tagResource);
    } else {
      tagResource.addProperty(RDF.type, createTypeResource("tag", model));
      tagResource.addProperty(RDF.type, model.createResource(OM_NS + "Tag"));
      if (tagFqn.startsWith(TIER_CLASSIFICATION_PREFIX)) {
        resource.addProperty(model.createProperty(OM_NS, "hasTier"), tagResource);
      }
    }

    tagResource.addProperty(model.createProperty(OM_NS, "tagFQN"), tagFqn);
    tagResource.addProperty(model.createProperty(OM_NS, "tagSource"), source);
    if (tagLabel.has("name")) {
      tagResource.addProperty(RDFS.label, tagLabel.get("name").asText());
    }
    if (tagLabel.has("displayName")) {
      tagResource.addProperty(SKOS.prefLabel, tagLabel.get("displayName").asText());
    }
    if (tagLabel.has("labelType")) {
      tagResource.addProperty(
          model.createProperty(OM_NS, "labelType"), tagLabel.get("labelType").asText());
    }
    if (tagLabel.has("state")) {
      tagResource.addProperty(
          model.createProperty(OM_NS, "tagState"), tagLabel.get("state").asText());
    }
    if (tagLabel.has("description")) {
      tagResource.addProperty(
          model.createProperty(DCT_NS, "description"), tagLabel.get("description").asText());
    }
  }

  /**
   * Resolves a TagLabel to the canonical entity URI. When the underlying tag or glossary term can
   * be looked up by FQN, the asset is linked to the real entity (e.g. {@code entity/tag/{uuid}})
   * so SPARQL traversals reach the tag's metadata, owners, classification, etc. Falls back to a
   * deterministic synthetic URI only if lookup fails (e.g. tag deleted concurrently).
   */
  private Resource resolveTagResource(
      String tagFqn, String source, JsonNode tagLabel, Model model) {
    UUID id =
        "Glossary".equalsIgnoreCase(source)
            ? resolveGlossaryTermId(tagFqn, tagLabel)
            : resolveClassificationTagId(tagFqn, tagLabel);
    String entityType = "Glossary".equalsIgnoreCase(source) ? "glossaryTerm" : "tag";
    if (id != null) {
      return model.createResource(baseUri + "entity/" + entityType + "/" + id);
    }
    return model.createResource(baseUri + "tag/" + tagFqn.replace(".", "/"));
  }

  private String extractCertificationLevel(String tagFqn) {
    if (tagFqn == null || tagFqn.isBlank()) {
      return null;
    }
    try {
      String[] parts = FullyQualifiedName.split(tagFqn);
      if (parts.length < 2) {
        return null;
      }
      return FullyQualifiedName.unquoteName(parts[parts.length - 1]);
    } catch (Exception e) {
      LOG.debug("Could not extract certification level from FQN {}", tagFqn);
      return null;
    }
  }

  private UUID resolveClassificationTagId(String tagFqn, JsonNode tagLabel) {
    if (tagFqn == null || tagFqn.isEmpty()) {
      return null;
    }
    UUID cached = classificationTagIdCache.get(tagFqn);
    if (cached != null) {
      return cached;
    }
    try {
      UUID resolvedId = tryResolveUuidFromHref(tagLabel);
      if (resolvedId != null) {
        classificationTagIdCache.put(tagFqn, resolvedId);
        return resolvedId;
      }

      Tag tag = Entity.getEntityByName(Entity.TAG, tagFqn, "", Include.NON_DELETED, false);
      UUID id = tag != null ? tag.getId() : null;
      if (id != null) {
        classificationTagIdCache.put(tagFqn, id);
      }
      return id;
    } catch (Exception e) {
      LOG.debug("Could not resolve classification tag id for FQN {}: {}", tagFqn, e.getMessage());
      return null;
    }
  }

  private UUID resolveGlossaryTermId(String termFqn, JsonNode tagLabel) {
    if (termFqn == null || termFqn.isEmpty()) {
      return null;
    }

    if (glossaryTermIdCache.containsKey(termFqn)) {
      return glossaryTermIdCache.get(termFqn);
    }

    try {
      UUID resolvedTermId = tryResolveUuidFromHref(tagLabel);
      if (resolvedTermId != null) {
        glossaryTermIdCache.put(termFqn, resolvedTermId);
        return resolvedTermId;
      }

      GlossaryTerm term =
          Entity.getEntityByName(Entity.GLOSSARY_TERM, termFqn, "", Include.NON_DELETED, false);
      UUID termId = term != null ? term.getId() : null;
      if (termId != null) {
        glossaryTermIdCache.put(termFqn, termId);
      }
      return termId;
    } catch (Exception e) {
      LOG.debug("Could not resolve glossary term id for FQN {}", termFqn);
      return null;
    }
  }

  private UUID tryResolveUuidFromHref(JsonNode tagLabel) {
    if (tagLabel == null || !tagLabel.has("href")) {
      return null;
    }

    String href = tagLabel.get("href").asText();
    if (href == null || href.isBlank()) {
      return null;
    }

    try {
      java.net.URI uri = java.net.URI.create(href);
      String path = uri.getPath();
      if (path == null || path.isBlank()) {
        return null;
      }
      String[] parts = path.split("/");
      if (parts.length == 0) {
        return null;
      }
      String last = parts[parts.length - 1];
      if (last.isBlank()) {
        return null;
      }
      return java.util.UUID.fromString(last);
    } catch (Exception e) {
      return null;
    }
  }

  /**
   * Dispatches structured property handling based on field name. These properties are converted
   * from JSON literals to proper RDF structures for better queryability via SPARQL.
   */
  private void addStructuredProperty(
      String fieldName, JsonNode value, Resource entityResource, Model model) {
    switch (fieldName) {
      case "lifeCycle" -> addLifeCycle(value, entityResource, model);
      case "extension" -> addExtension(value, entityResource, model);
      case "certification" -> addCertification(value, entityResource, model);
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
   * Converts AssetCertification into a real RDF link. Emits {@code asset om:hasCertification} to
   * the resolved tag resource (canonical {@code entity/tag/{uuid}} when the tag can be looked up,
   * falling back to a synthetic {@code tag/{fqn}} URI only if lookup fails), plus the
   * certification level (last FQN segment) and the applied/expiry timestamps as typed literals —
   * instead of dumping the whole JSON as a string literal under {@code om:certification}.
   */
  private void addCertification(JsonNode certification, Resource entityResource, Model model) {
    if (certification == null || certification.isNull() || !certification.has("tagLabel")) {
      return;
    }
    JsonNode tagLabel = certification.get("tagLabel");
    if (!tagLabel.has("tagFQN")) {
      return;
    }
    String tagFqn = tagLabel.get("tagFQN").asText();
    String source = tagLabel.has("source") ? tagLabel.get("source").asText() : "Classification";
    boolean isGlossary = "Glossary".equalsIgnoreCase(source);
    Resource tagResource = resolveTagResource(tagFqn, source, tagLabel, model);

    // Mirror addTagLabel's typing so SPARQL queries can find certification
    // targets the same way they find any other tag/glossary term — by source
    // (glossaryTerm vs tag), with skos:Concept on glossary-backed targets and
    // om:Tag on classification-backed ones.
    if (isGlossary) {
      tagResource.addProperty(RDF.type, createTypeResource("glossaryTerm", model));
      tagResource.addProperty(RDF.type, model.createResource(SKOS.getURI() + "Concept"));
    } else {
      tagResource.addProperty(RDF.type, createTypeResource("tag", model));
      tagResource.addProperty(RDF.type, model.createResource(OM_NS + "Tag"));
    }
    tagResource.addProperty(model.createProperty(OM_NS, "tagFQN"), tagFqn);
    tagResource.addProperty(model.createProperty(OM_NS, "tagSource"), source);
    if (tagLabel.has("name")) {
      tagResource.addProperty(RDFS.label, tagLabel.get("name").asText());
    }

    entityResource.addProperty(model.createProperty(OM_NS, "hasCertification"), tagResource);
    String level = extractCertificationLevel(tagFqn);
    if (level != null) {
      entityResource.addProperty(model.createProperty(OM_NS, "certificationLevel"), level);
    }
    if (certification.has("appliedDate") && certification.get("appliedDate").isNumber()) {
      entityResource.addProperty(
          model.createProperty(OM_NS, "certificationAppliedAt"),
          model.createTypedLiteral(certification.get("appliedDate").asLong()));
    }
    if (certification.has("expiryDate") && certification.get("expiryDate").isNumber()) {
      entityResource.addProperty(
          model.createProperty(OM_NS, "certificationExpiresAt"),
          model.createTypedLiteral(certification.get("expiryDate").asLong()));
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
        relatedEntityResource.addProperty(RDF.type, createTypeResource(entityType, model));

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
      pipelineResource.addProperty(RDF.type, createTypeResource(pipelineType, model));
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
          nodeResource.addProperty(RDF.type, createTypeResource(node.get("type").asText(), model));

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
        String literal = value.asText();
        // Skip blank xsd:string triples. An empty literal carries no real
        // information and downstream readers had to special-case it — most
        // visibly skos:prefLabel="" winning over rdfs:label in the glossary
        // term graph SPARQL. By not writing the triple at all, OPTIONAL
        // patterns and COALESCE on the read side behave correctly with no
        // extra logic.
        if (XSDDatatype.XSDstring.equals(datatype) && literal.isBlank()) {
          return;
        }
        resource.addProperty(property, model.createTypedLiteral(literal, datatype));
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
    // Add timestamps. updatedAt is epoch millis on the entity; convert to an
    // ISO-8601 instant before tagging it as xsd:dateTime so the lexical form is
    // valid (a long literal would be a malformed xsd:dateTime).
    if (entity.getUpdatedAt() != null) {
      String iso = java.time.Instant.ofEpochMilli(entity.getUpdatedAt()).toString();
      resource.addProperty(
          model.createProperty(DCT_NS, "modified"),
          model.createTypedLiteral(iso, XSDDatatype.XSDdateTime));
    }

    // PROV-O soft-delete: when the entity is marked deleted, expose its updatedAt
    // as the invalidation timestamp so timeline-aware queries can filter on it.
    if (Boolean.TRUE.equals(entity.getDeleted()) && entity.getUpdatedAt() != null) {
      resource.addProperty(
          model.createProperty(PROV_NS, "invalidatedAtTime"),
          model.createTypedLiteral(
              java.time.Instant.ofEpochMilli(entity.getUpdatedAt()).toString(),
              XSDDatatype.XSDdateTime));
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
      case "dprod" -> DPROD_NS;
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

  private Resource createTypeResource(String entityType, Model model) {
    String curieOrUri = getRdfType(entityType);
    if (curieOrUri == null || curieOrUri.isEmpty()) {
      return model.createResource();
    }
    if (curieOrUri.startsWith("http://") || curieOrUri.startsWith("https://")) {
      return model.createResource(curieOrUri);
    }
    int separatorIndex = curieOrUri.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex == curieOrUri.length() - 1) {
      return model.createResource(curieOrUri);
    }
    String namespace = getNamespace(curieOrUri.substring(0, separatorIndex));
    if (namespace == null) {
      return model.createResource(curieOrUri);
    }
    return model.createResource(namespace + curieOrUri.substring(separatorIndex + 1));
  }
}

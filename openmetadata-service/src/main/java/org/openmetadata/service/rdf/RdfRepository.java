package org.openmetadata.service.rdf;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.rdf.storage.RdfStorageFactory;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class RdfRepository {

  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  static final int DEFAULT_BULK_ENTITY_BATCH_SIZE = 50;
  static final int DEFAULT_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE = 25;

  // Fallback predicate URIs for clearAllGlossaryTermRelations when
  // GlossaryTermRelationSettings can't be loaded (e.g. DB blip during startup).
  // Mirrors the system-defined types bootstrapped in SettingsCache.initialize
  // (see SettingsCache.java ~:355-486) so the floor matches what every install
  // gets out of the box: relatedTo, synonym (skos:exactMatch), antonym,
  // broader, narrower, partOf, hasPart, calculatedFrom, usedToCalculate,
  // seeAlso (rdfs:seeAlso). Also includes a few legacy om:* URIs the stale
  // getGlossaryTermRelationPredicateUri switch (used by the live remove path)
  // may have written into older datasets, so a manual cleanup run on those
  // doesn't leave them behind.
  private static final Set<String> DEFAULT_GLOSSARY_TERM_RELATION_PREDICATES =
      Set.of(
          // SettingsCache bootstrap defaults — keep in sync if that list changes.
          "https://open-metadata.org/ontology/relatedTo",
          "http://www.w3.org/2004/02/skos/core#exactMatch",
          "https://open-metadata.org/ontology/antonym",
          "http://www.w3.org/2004/02/skos/core#broader",
          "http://www.w3.org/2004/02/skos/core#narrower",
          "https://open-metadata.org/ontology/partOf",
          "https://open-metadata.org/ontology/hasPart",
          "https://open-metadata.org/ontology/calculatedFrom",
          "https://open-metadata.org/ontology/usedToCalculate",
          "http://www.w3.org/2000/01/rdf-schema#seeAlso",
          // om:* fallback URIs that getGlossaryTermRelationPredicate writes
          // when SettingsCache is unavailable / returns null — the default
          // branch concats `https://open-metadata.org/ontology/` + relationType
          // verbatim, so a "broader" / "narrower" / etc. type lands as
          // `om:broader`, NOT `skos:broader`. Without these in the fallback
          // set, a cleanup run during a transient SettingsCache outage would
          // miss those triples.
          "https://open-metadata.org/ontology/broader",
          "https://open-metadata.org/ontology/narrower",
          "https://open-metadata.org/ontology/exactMatch",
          // Legacy URIs from older code paths / pre-SettingsCache data.
          "https://open-metadata.org/ontology/synonym",
          "https://open-metadata.org/ontology/seeAlso",
          "https://open-metadata.org/ontology/typeOf",
          "https://open-metadata.org/ontology/hasTypes",
          "https://open-metadata.org/ontology/componentOf",
          "https://open-metadata.org/ontology/composedOf",
          "http://www.w3.org/2004/02/skos/core#related");

  private final RdfConfiguration config;
  private final RdfStorageInterface storageService;
  private final JsonLdTranslator translator;
  private static RdfRepository INSTANCE;

  /**
   * Per-thread cache of (fullPredicateIRI → configured type name) used by
   * {@link #extractPredicateName(String)} during a single graph-build pass.
   * {@link #parseGlossaryTermGraphResults(String, boolean, UUID, UUID, int, int)}
   * builds and clears the map; everything
   * else sees an empty optional and short-circuits to the URI local-name
   * fallback. Pre-fix the lookup walked the full configured-types list per
   * edge — O(edges × relationTypes) with a regex+concat per iteration.
   */
  private static final ThreadLocal<java.util.Map<String, String>> predicateNameCache =
      new ThreadLocal<>();

  private RdfRepository(RdfConfiguration config) {
    this.config = config;
    if (config.getEnabled() != null && config.getEnabled()) {
      this.storageService = RdfStorageFactory.createStorage(config);
      this.translator =
          new JsonLdTranslator(JsonUtils.getObjectMapper(), config.getBaseUri().toString());
      LOG.info("RDF Repository initialized with {} storage", config.getStorageType());

      loadOntologies();
    } else {
      this.storageService = null;
      this.translator = null;
      LOG.info("RDF Repository disabled");
    }
  }

  RdfRepository(
      RdfConfiguration config, RdfStorageInterface storageService, JsonLdTranslator translator) {
    this.config = config;
    this.storageService = storageService;
    this.translator = translator;
  }

  static int resolveBulkEntityBatchSize(RdfConfiguration config) {
    return positiveInt(config.getBulkEntityBatchSize(), DEFAULT_BULK_ENTITY_BATCH_SIZE);
  }

  static int resolveBulkRelationshipSourceBatchSize(RdfConfiguration config) {
    return positiveInt(
        config.getBulkRelationshipSourceBatchSize(), DEFAULT_BULK_RELATIONSHIP_SOURCE_BATCH_SIZE);
  }

  private static int positiveInt(Integer value, int defaultValue) {
    return value != null && value > 0 ? value : defaultValue;
  }

  private void loadOntologies() {
    try {
      OntologyLoader loader = new OntologyLoader(this);
      if (!loader.areOntologiesLoaded()) {
        LOG.info("Loading OpenMetadata ontologies into RDF store");
        loader.loadOntologies();
      } else {
        LOG.info("OpenMetadata ontologies already loaded");
      }
    } catch (Exception e) {
      LOG.error("Failed to load ontologies", e);
    }
  }

  // CLEAR ALL (called by clearAll()) wipes the ontology and shapes graphs too.
  // Callers that wipe the dataset must invoke this afterwards so SPARQL queries
  // that depend on the ontology don't break. Unlike loadOntologies() this skips
  // the "already loaded" guard — areOntologiesLoaded() would return false right
  // after a CLEAR, but we want to unconditionally reload.
  //
  // OntologyLoader.loadOntologies swallows its own exceptions, so we verify via
  // areOntologiesLoaded() afterwards and throw on failure. Otherwise callers
  // would silently proceed against an empty ontology graph.
  public void reloadOntologies() {
    if (!isEnabled()) {
      return;
    }
    OntologyLoader loader = new OntologyLoader(this);
    loader.loadOntologies();
    if (!loader.areOntologiesLoaded()) {
      throw new RuntimeException(
          "Failed to reload ontologies into RDF store; ontology graph is still empty after load");
    }
    LOG.info("Reloaded OpenMetadata ontologies into RDF store");
  }

  public static void initialize(RdfConfiguration config) {
    if (INSTANCE != null) {
      throw new IllegalStateException("RdfRepository already initialized");
    }
    INSTANCE = new RdfRepository(config);
  }

  public static RdfRepository getInstance() {
    if (INSTANCE == null) {
      throw new IllegalStateException("RdfRepository not initialized");
    }
    return INSTANCE;
  }

  public static RdfRepository getInstanceOrNull() {
    return INSTANCE;
  }

  public static void reset() {
    if (INSTANCE != null) {
      INSTANCE.close();
    }
    INSTANCE = null;
  }

  public boolean isEnabled() {
    return config.getEnabled() != null && config.getEnabled() && storageService != null;
  }

  public String getBaseUri() {
    if (config.getBaseUri() == null) {
      throw new IllegalStateException("RDF baseUri is not configured");
    }
    return config.getBaseUri().toString();
  }

  public void ensureStorageReady() {
    if (!isEnabled()) {
      return;
    }
    storageService.ensureStorageReady();
  }

  public void createOrUpdate(EntityInterface entity) {
    if (!isEnabled()) {
      return;
    }

    try {
      String entityType = entity.getEntityReference().getType();
      LOG.debug(
          "Storing entity in RDF - Type: {}, FQN: {}, Name: {}, ID: {}",
          entityType,
          entity.getFullyQualifiedName(),
          entity.getName(),
          entity.getId());
      Model rdfModel = translator.toRdf(entity);
      storageService.storeEntity(entityType, entity.getId(), rdfModel);
      LOG.debug("Created/Updated entity {} in RDF store", entity.getId());
    } catch (Exception e) {
      LOG.error(
          "Failed to create/update entity {} in RDF - Type: {}, FQN: {}",
          entity.getId(),
          entity.getEntityReference().getType(),
          entity.getFullyQualifiedName(),
          e);
      throw new RuntimeException("Failed to create/update entity in RDF", e);
    }
  }

  /**
   * Bulk variant of {@link #createOrUpdate(EntityInterface)} — translates every
   * entity to RDF and forwards the batch to the storage layer. Used by the
   * indexer batch path; production hot path (per-entity hooks) keeps calling
   * {@link #createOrUpdate}.
   *
   * <p>From the caller's perspective: all-or-nothing — a single thrown
   * exception means the caller should retry the whole batch (or fall back to
   * per-entity {@link #createOrUpdate} for per-row error attribution). The
   * indexer in {@code RdfBatchProcessor.processEntities} does the latter.
   *
   * <p>Implementation note: {@link
   * org.openmetadata.service.rdf.storage.JenaFusekiStorage#bulkStoreEntities}
   * runs each configured repository chunk as a SINGLE SPARQL UPDATE containing
   * both the combined per-entity DELETE statements and an {@code INSERT DATA}
   * block with the unioned N-Triples body. Fuseki executes multi-statement
   * UPDATEs in one transaction, so each chunk is atomic at the storage side.
   * The per-entity fallback in {@code RdfBatchProcessor.processEntities} keeps
   * row-level failure attribution when a chunk fails.
   */
  public void bulkCreateOrUpdate(List<? extends EntityInterface> entities) {
    if (!isEnabled() || entities == null || entities.isEmpty()) {
      return;
    }
    List<RdfStorageInterface.EntityWriteRequest> requests = new ArrayList<>(entities.size());
    for (EntityInterface entity : entities) {
      String entityType = entity.getEntityReference().getType();
      Model rdfModel = translator.toRdf(entity);
      requests.add(
          new RdfStorageInterface.EntityWriteRequest(entityType, entity.getId(), rdfModel));
    }
    try {
      bulkStoreEntityRequests(requests);
      LOG.debug("Bulk created/updated {} entities in RDF store", entities.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk create/update {} entities in RDF", entities.size(), e);
      throw new RuntimeException("Failed to bulk create/update entities in RDF", e);
    }
  }

  void bulkStoreEntityRequests(List<RdfStorageInterface.EntityWriteRequest> requests) {
    if (requests == null || requests.isEmpty()) {
      return;
    }
    int chunkSize = resolveBulkEntityBatchSize(config);
    for (int start = 0; start < requests.size(); start += chunkSize) {
      int end = Math.min(start + chunkSize, requests.size());
      storageService.bulkStoreEntities(requests.subList(start, end));
    }
  }

  public void delete(EntityReference entityReference) {
    if (!isEnabled()) {
      return;
    }

    try {
      String entityUri =
          config.getBaseUri().toString()
              + "entity/"
              + entityReference.getType()
              + "/"
              + entityReference.getId();

      String sparqlUpdate =
          String.format(
              "DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }; "
                  + "DELETE WHERE { GRAPH <%s> { ?s ?p <%s> } }",
              KNOWLEDGE_GRAPH, entityUri, KNOWLEDGE_GRAPH, entityUri);

      storageService.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Deleted entity {} from RDF store", entityReference.getId());
    } catch (Exception e) {
      LOG.error("Failed to delete entity {} from RDF", entityReference.getId(), e);
    }
  }

  public void addRelationship(EntityRelationship relationship) {
    if (!isEnabled()) {
      return;
    }

    // Append the relationship triples directly with INSERT DATA. The previous
    // implementation fetched the entity model, merged the new triple in, then
    // round-tripped through storeEntity — but storeEntity performs a
    // translator-scoped delete (rdf:type, rdfs:label, om:belongsToGlossary,
    // and every literal) on the entity URI before loading the supplied model.
    // Called with a relationship-only model that path wiped the source
    // entity's identity, so subsequent SPARQL queries anchored on rdf:type or
    // om:belongsToGlossary stopped finding the term. INSERT DATA is purely
    // additive and matches the pattern used by addGlossaryTermRelation, which
    // never had this bug.
    try {
      Model relationshipModel = createRelationshipModel(relationship);
      java.io.StringWriter writer = new java.io.StringWriter();
      relationshipModel.write(writer, "N-TRIPLES");
      String triples = writer.toString();
      if (triples.isBlank()) {
        return;
      }
      String insertQuery = "INSERT DATA { GRAPH <" + KNOWLEDGE_GRAPH + "> { " + triples + " } }";
      storageService.executeSparqlUpdate(insertQuery);
      LOG.debug("Added relationship {} to RDF store", relationship);
    } catch (Exception e) {
      LOG.error("Failed to add relationship to RDF", e);
      throw new RuntimeException("Failed to add relationship to RDF", e);
    }
  }

  private Model createRelationshipModel(EntityRelationship relationship) {
    Model model = ModelFactory.createDefaultModel();

    model.setNsPrefix("om", "https://open-metadata.org/ontology/");
    model.setNsPrefix("prov", "http://www.w3.org/ns/prov#");
    model.setNsPrefix("dct", "http://purl.org/dc/terms/");

    String fromUri =
        config.getBaseUri().toString()
            + "entity/"
            + relationship.getFromEntity()
            + "/"
            + relationship.getFromId();
    String toUri =
        config.getBaseUri().toString()
            + "entity/"
            + relationship.getToEntity()
            + "/"
            + relationship.getToId();

    Resource fromResource = model.createResource(fromUri);
    Resource toResource = model.createResource(toUri);

    String relationshipType = relationship.getRelationshipType().value();
    Property predicate = getRelationshipPredicate(relationshipType, model);

    fromResource.addProperty(predicate, toResource);

    return model;
  }

  private Property getRelationshipPredicate(String relationshipType, Model model) {
    return model.createProperty(getRelationshipPredicateUri(relationshipType));
  }

  // Resolve the full predicate URI for a relationship type. Single source of
  // truth used by:
  //   - addRelationship / bulkAddRelationships (insert path)
  //   - removeRelationship (live delete path)
  //   - RELATIONSHIP_HOOK_PREDICATES below (predicate-scoped reconciliation)
  // Keep static — the mapping has no per-instance state, and constructing
  // RELATIONSHIP_HOOK_PREDICATES at class init needs a static accessor.
  static String getRelationshipPredicateUri(String relationshipType) {
    return switch (relationshipType.toLowerCase()) {
      case "contains" -> "https://open-metadata.org/ontology/contains";
      case "uses" -> "http://www.w3.org/ns/prov#used";
      case "owns" -> "https://open-metadata.org/ontology/owns";
      case "parentof" -> "https://open-metadata.org/ontology/parentOf";
      case "childof" -> "https://open-metadata.org/ontology/childOf";
      case "relatedto" -> "https://open-metadata.org/ontology/relatedTo";
      case "appliedto" -> "https://open-metadata.org/ontology/appliedTo";
      case "testedby" -> "https://open-metadata.org/ontology/testedBy";
      case "upstream" -> "http://www.w3.org/ns/prov#wasDerivedFrom";
      case "downstream" -> "http://www.w3.org/ns/prov#wasInfluencedBy";
      case "joinedwith" -> "https://open-metadata.org/ontology/joinedWith";
      case "processedby" -> "http://www.w3.org/ns/prov#wasGeneratedBy";
      default -> "https://open-metadata.org/ontology/" + relationshipType;
    };
  }

  // Predicate URIs that addRelationship / bulkAddRelationships /
  // removeRelationship operate on, EXCLUDING the lineage edge predicates
  // (prov:wasDerivedFrom, om:UPSTREAM, om:hasLineageDetails) which are managed
  // independently by addLineageWithDetails. Used by
  // clearOutgoingEntityRelationships and JenaFusekiStorage.bulkStoreRelationships
  // to scope the per-source DELETE so translator-managed URI triples
  // (om:hasOwner / om:hasTag / etc., see RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES)
  // and lineage triples are NOT wiped during relationship reconciliation.
  public static final Set<String> RELATIONSHIP_HOOK_PREDICATES =
      computeRelationshipHookPredicates();

  private static Set<String> computeRelationshipHookPredicates() {
    Set<String> predicates = new LinkedHashSet<>();
    for (Relationship rel : Relationship.values()) {
      String value = rel.value();
      // Lineage is owned by addLineageWithDetails — its DELETE is scoped to
      // the lineageDetails sub-resource, not the relationship hook layer.
      if ("upstream".equalsIgnoreCase(value)) {
        continue;
      }
      predicates.add(getRelationshipPredicateUri(value));
    }
    return java.util.Collections.unmodifiableSet(predicates);
  }

  // Source-entity reference used for reconciling outgoing entity-to-entity edges.
  // Carries just the (type, id) tuple needed to build an entity URI; we avoid
  // reusing EntityReference here because callers (RdfBatchProcessor) only have
  // those two fields after a batch fetch and we don't want to populate the rest.
  public record EntitySourceRef(String entityType, UUID entityId) {}

  // Clear outgoing relationship-hook edges (om:contains, om:owns, prov:used,
  // etc. — see RELATIONSHIP_HOOK_PREDICATES) for the given sources. Lineage
  // predicates are NOT in the set (managed by addLineageWithDetails), and
  // translator-managed predicates (om:hasOwner, om:hasTag, om:hasGlossaryTerm,
  // om:belongsToDomain, … — see RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES)
  // are also NOT in the set, so this clear is safe to run before
  // bulkAddRelationships without wiping translator-emitted state.
  //
  // Used by RdfBatchProcessor before bulkAddRelationships to reconcile entities
  // whose last outgoing relationship was removed — those produce zero
  // RelationshipData entries, so bulkStoreRelationships' per-source DELETE
  // would otherwise skip them and the stale edges would persist.
  public void clearOutgoingEntityRelationships(Set<EntitySourceRef> sources) {
    if (!isEnabled() || sources == null || sources.isEmpty()) {
      return;
    }
    if (RELATIONSHIP_HOOK_PREDICATES.isEmpty()) {
      return; // nothing to clear
    }
    String base = config.getBaseUri().toString();
    String filterIn = buildPredicateInList(RELATIONSHIP_HOOK_PREDICATES);
    StringBuilder update = new StringBuilder();
    boolean first = true;
    for (EntitySourceRef ref : sources) {
      if (!first) {
        update.append("; ");
      }
      first = false;
      String sourceUri = base + "entity/" + ref.entityType() + "/" + ref.entityId();
      update
          .append("DELETE { GRAPH <")
          .append(KNOWLEDGE_GRAPH)
          .append("> { <")
          .append(sourceUri)
          .append("> ?p ?o } } WHERE { GRAPH <")
          .append(KNOWLEDGE_GRAPH)
          .append("> { <")
          .append(sourceUri)
          .append("> ?p ?o . FILTER(?p IN (")
          .append(filterIn)
          .append(")) } }");
    }
    try {
      storageService.executeSparqlUpdate(update.toString());
      LOG.debug("Cleared outgoing relationship-hook edges for {} sources", sources.size());
    } catch (Exception e) {
      LOG.error("Failed to clear outgoing relationship-hook edges", e);
      throw new RuntimeException("Failed to clear outgoing relationship-hook edges", e);
    }
  }

  // Build a comma-separated "<uri1>, <uri2>, ..." for SPARQL `?p IN (...)` lists.
  // public so JenaFusekiStorage (in storage subpackage) can reuse the same
  // RELATIONSHIP_HOOK_PREDICATES rendering for its per-source DELETE filter.
  public static String buildPredicateInList(Set<String> uris) {
    StringBuilder sb = new StringBuilder();
    boolean first = true;
    for (String uri : uris) {
      if (!first) {
        sb.append(", ");
      }
      first = false;
      sb.append('<').append(uri).append('>');
    }
    return sb.toString();
  }

  public void bulkAddRelationships(List<EntityRelationship> relationships) {
    bulkAddRelationships(relationships, null);
  }

  /**
   * Bulk add relationships, reconciling only the supplied source entities. If
   * {@code reconcileSources} is null (legacy callers), the storage layer falls
   * back to reconciling whatever sources appear in {@code relationships},
   * which is unsafe when the list includes incoming-lineage rows whose
   * {@code fromId} is outside the current entity batch. Indexer callers
   * (RdfBatchProcessor) should always pass the batch's own entities so
   * outside-batch sources keep their unrelated outgoing edges.
   */
  public void bulkAddRelationships(
      List<EntityRelationship> relationships, Set<EntitySourceRef> reconcileSources) {
    if (!isEnabled()) {
      return;
    }
    // Allow empty relationships + non-empty reconcileSources: that's the
    // zero-edge case (an indexed entity with no current outgoing relationships
    // in MySQL), and we still want bulkStoreRelationships to clear any stale
    // edges that may exist for it in RDF. If BOTH are empty there's nothing
    // to do.
    if (relationships.isEmpty() && (reconcileSources == null || reconcileSources.isEmpty())) {
      return;
    }

    try {
      // Pre-compute predicate URIs via getRelationshipPredicate so they match
      // exactly what addRelationship/removeRelationship write/expect (e.g.
      // UPSTREAM → prov:wasDerivedFrom, USES → prov:used). Without this the
      // bulk path would emit `om:<relationshipType>` (lowercase value) and a
      // later removeRelationship for the same edge would target a different
      // predicate URI, leaving the bulk-written triple in place.
      List<RdfStorageInterface.RelationshipData> relationshipDataList = new ArrayList<>();
      // Jena 4's Model has a `close()` method but doesn't implement
      // java.lang.AutoCloseable, so try-with-resources is rejected at compile
      // time. Explicit try/finally close() ensures the in-memory graph backing
      // the temporary properties is released — important because we're only
      // using this model to mint Property URIs for predicate-string extraction.
      Model tempModel = ModelFactory.createDefaultModel();
      try {
        for (EntityRelationship relationship : relationships) {
          String relType = relationship.getRelationshipType().value();
          String predicateUri = getRelationshipPredicate(relType, tempModel).getURI();
          relationshipDataList.add(
              new RdfStorageInterface.RelationshipData(
                  relationship.getFromEntity(),
                  relationship.getFromId(),
                  relationship.getToEntity(),
                  relationship.getToId(),
                  relType,
                  predicateUri));
        }
      } finally {
        tempModel.close();
      }
      if (reconcileSources != null) {
        Set<String> sourceUris = new LinkedHashSet<>();
        for (EntitySourceRef ref : reconcileSources) {
          sourceUris.add(
              storageService.buildEntityUri(ref.entityType(), ref.entityId().toString()));
        }
        bulkStoreRelationshipData(relationshipDataList, sourceUris);
      } else {
        Set<String> sourceUris = new LinkedHashSet<>();
        for (RdfStorageInterface.RelationshipData relationshipData : relationshipDataList) {
          sourceUris.add(
              storageService.buildEntityUri(
                  relationshipData.getFromType(), relationshipData.getFromId().toString()));
        }
        bulkStoreRelationshipData(relationshipDataList, sourceUris);
      }
      LOG.debug("Bulk added {} relationships to RDF store", relationships.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk add relationships to RDF", e);
      throw new RuntimeException("Failed to bulk add relationships to RDF", e);
    }
  }

  void bulkStoreRelationshipData(
      List<RdfStorageInterface.RelationshipData> relationships, Set<String> sourceUris) {
    Set<String> effectiveSources = sourceUris != null ? sourceUris : Set.of();
    if (relationships.isEmpty() && effectiveSources.isEmpty()) {
      return;
    }
    if (effectiveSources.isEmpty()) {
      storageService.bulkStoreRelationships(relationships, Set.of());
      return;
    }

    Map<String, List<RdfStorageInterface.RelationshipData>> relationshipsBySource =
        new LinkedHashMap<>();
    List<RdfStorageInterface.RelationshipData> outsideSourceRelationships = new ArrayList<>();
    for (RdfStorageInterface.RelationshipData relationship : relationships) {
      String relationshipSourceUri =
          storageService.buildEntityUri(
              relationship.getFromType(), relationship.getFromId().toString());
      if (effectiveSources.contains(relationshipSourceUri)) {
        relationshipsBySource
            .computeIfAbsent(relationshipSourceUri, ignored -> new ArrayList<>())
            .add(relationship);
      } else {
        outsideSourceRelationships.add(relationship);
      }
    }

    int chunkSize = resolveBulkRelationshipSourceBatchSize(config);
    List<String> sourceChunk = new ArrayList<>(chunkSize);
    for (String sourceUri : effectiveSources) {
      sourceChunk.add(sourceUri);
      if (sourceChunk.size() == chunkSize) {
        bulkStoreRelationshipSourceChunk(sourceChunk, relationshipsBySource);
        sourceChunk.clear();
      }
    }
    if (!sourceChunk.isEmpty()) {
      bulkStoreRelationshipSourceChunk(sourceChunk, relationshipsBySource);
    }
    if (!outsideSourceRelationships.isEmpty()) {
      storageService.bulkStoreRelationships(outsideSourceRelationships, Set.of());
    }
  }

  private void bulkStoreRelationshipSourceChunk(
      List<String> sourceChunk,
      Map<String, List<RdfStorageInterface.RelationshipData>> relationshipsBySource) {
    Set<String> chunkSources = new LinkedHashSet<>(sourceChunk);
    List<RdfStorageInterface.RelationshipData> chunkRelationships = new ArrayList<>();
    for (String sourceUri : sourceChunk) {
      chunkRelationships.addAll(relationshipsBySource.getOrDefault(sourceUri, List.of()));
    }
    storageService.bulkStoreRelationships(chunkRelationships, chunkSources);
  }

  /**
   * Add a lineage relationship with full details (SQL query, pipeline, column lineage). This stores
   * the lineage as structured RDF triples instead of a single JSON literal, enabling rich SPARQL
   * queries like: "Find all tables derived from table X via pipeline Y" or "What columns from
   * source table feed into column Z"
   */
  public void addLineageWithDetails(
      String fromType,
      UUID fromId,
      String toType,
      UUID toId,
      org.openmetadata.schema.type.LineageDetails lineageDetails) {
    if (!isEnabled()) {
      return;
    }

    try {
      Model model = ModelFactory.createDefaultModel();

      model.setNsPrefix("om", "https://open-metadata.org/ontology/");
      model.setNsPrefix("prov", "http://www.w3.org/ns/prov#");
      model.setNsPrefix("dct", "http://purl.org/dc/terms/");

      String fromUri = config.getBaseUri().toString() + "entity/" + fromType + "/" + fromId;
      String toUri = config.getBaseUri().toString() + "entity/" + toType + "/" + toId;

      Resource fromResource = model.createResource(fromUri);
      Resource toResource = model.createResource(toUri);

      // PROV-O: to wasDerivedFrom from (reverse direction for semantic correctness)
      Property derivedFrom = model.createProperty("http://www.w3.org/ns/prov#", "wasDerivedFrom");
      toResource.addProperty(derivedFrom, fromResource);

      // OpenMetadata-specific upstream for compatibility
      Property upstream = model.createProperty("https://open-metadata.org/ontology/", "UPSTREAM");
      fromResource.addProperty(upstream, toResource);

      if (lineageDetails != null) {
        // Deterministic URI: re-indexing the same lineage produces the same URI,
        // letting the DELETE+INSERT idempotency below collapse duplicate
        // LineageDetails resources instead of creating a new one per run.
        String detailsUri =
            config.getBaseUri().toString() + "lineageDetails/" + fromId + "/" + toId;
        Resource detailsResource = model.createResource(detailsUri);

        Property hasLineageDetails =
            model.createProperty("https://open-metadata.org/ontology/", "hasLineageDetails");
        fromResource.addProperty(hasLineageDetails, detailsResource);

        detailsResource.addProperty(
            model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
            model.createResource("https://open-metadata.org/ontology/LineageDetails"));
        // detailsResource is the Activity instance for this lineage edge — it
        // carries Activity-shaped predicates (prov:startedAtTime, endedAtTime,
        // used, hadPlan, wasGeneratedBy, wasAssociatedWith). Type it as
        // prov:Activity so PROV-O reasoners and federated SPARQL clients treat
        // it as one without having to learn the OM-specific type.
        detailsResource.addProperty(
            model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
            model.createResource("http://www.w3.org/ns/prov#Activity"));

        if (lineageDetails.getSqlQuery() != null && !lineageDetails.getSqlQuery().isEmpty()) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "sqlQuery"),
              lineageDetails.getSqlQuery());

          // PROV-O Plan: model the SQL transformation recipe as a prov:Plan that
          // the Activity hadPlan. Lets external clients diff/version transformation
          // logic separately from individual runs.
          String planUri = detailsUri + "/plan";
          Resource planResource = model.createResource(planUri);
          planResource.addProperty(
              model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
              model.createResource("http://www.w3.org/ns/prov#Plan"));
          planResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "value"),
              lineageDetails.getSqlQuery());
          detailsResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "hadPlan"), planResource);
        }

        if (lineageDetails.getSource() != null) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "lineageSource"),
              lineageDetails.getSource().value());
        }

        if (lineageDetails.getDescription() != null && !lineageDetails.getDescription().isEmpty()) {
          detailsResource.addProperty(
              model.createProperty("http://purl.org/dc/terms/", "description"),
              lineageDetails.getDescription());
        }

        if (lineageDetails.getPipeline() != null && lineageDetails.getPipeline().getId() != null) {
          EntityReference pipeline = lineageDetails.getPipeline();
          String pipelineType = pipeline.getType() != null ? pipeline.getType() : "pipeline";
          String pipelineUri =
              config.getBaseUri().toString() + "entity/" + pipelineType + "/" + pipeline.getId();
          Resource pipelineResource = model.createResource(pipelineUri);

          detailsResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "wasGeneratedBy"),
              pipelineResource);

          // PROV-O inverse: pipeline prov:generated lineageDetails. Emitting both
          // directions lets activity-side queries ("what did this pipeline produce?")
          // run without needing reverse-property reasoning support in the triple store.
          pipelineResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "generated"), detailsResource);
        }

        // PROV-O input: lineageDetails prov:used <upstream entity>. Completes the
        // standard PROV-O Entity → Activity → Entity chain alongside wasDerivedFrom,
        // so external SPARQL clients can query "what inputs did this activity use?".
        detailsResource.addProperty(
            model.createProperty("http://www.w3.org/ns/prov#", "used"), fromResource);

        if (lineageDetails.getColumnsLineage() != null
            && !lineageDetails.getColumnsLineage().isEmpty()) {
          Property hasColumnLineage =
              model.createProperty("https://open-metadata.org/ontology/", "hasColumnLineage");

          int colLineageIndex = 0;
          for (org.openmetadata.schema.type.ColumnLineage colLineage :
              lineageDetails.getColumnsLineage()) {
            // Deterministic URI per (lineage edge, target column) so re-indexing
            // doesn't multiply column-lineage resources. The index suffix is a
            // tiebreaker so distinct toColumn values that normalize to the same
            // string (e.g. `a-b` and `a_b` both → `a_b` after the
            // [^A-Za-z0-9]→`_` replacement) don't collapse to one resource.
            String safeName =
                colLineage.getToColumn() != null
                    ? colLineage.getToColumn().replaceAll("[^A-Za-z0-9]", "_")
                    : "noTarget";
            String colLineageUri =
                detailsUri + "/columnLineage/" + safeName + "_" + colLineageIndex;
            Resource colLineageResource = model.createResource(colLineageUri);
            colLineageIndex++;

            detailsResource.addProperty(hasColumnLineage, colLineageResource);
            colLineageResource.addProperty(
                model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
                model.createResource("https://open-metadata.org/ontology/ColumnLineage"));

            if (colLineage.getFromColumns() != null) {
              Property fromColumnProp =
                  model.createProperty("https://open-metadata.org/ontology/", "fromColumn");
              for (String fromCol : colLineage.getFromColumns()) {
                colLineageResource.addProperty(fromColumnProp, fromCol);
              }
            }

            if (colLineage.getToColumn() != null) {
              colLineageResource.addProperty(
                  model.createProperty("https://open-metadata.org/ontology/", "toColumn"),
                  colLineage.getToColumn());
            }

            if (colLineage.getFunction() != null) {
              colLineageResource.addProperty(
                  model.createProperty("https://open-metadata.org/ontology/", "transformFunction"),
                  colLineage.getFunction());
            }
          }
        }

        if (lineageDetails.getCreatedAt() != null) {
          detailsResource.addProperty(
              model.createProperty("http://purl.org/dc/terms/", "created"),
              model.createTypedLiteral(
                  lineageDetails.getCreatedAt().toString(),
                  org.apache.jena.datatypes.xsd.XSDDatatype.XSDlong));
          // PROV-O timing: detailsResource represents the Activity instance, so its
          // createdAt is when the Activity started.
          detailsResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "startedAtTime"),
              model.createTypedLiteral(
                  java.time.Instant.ofEpochMilli(lineageDetails.getCreatedAt()).toString(),
                  org.apache.jena.datatypes.xsd.XSDDatatype.XSDdateTime));
        }
        if (lineageDetails.getUpdatedAt() != null) {
          detailsResource.addProperty(
              model.createProperty("http://purl.org/dc/terms/", "modified"),
              model.createTypedLiteral(
                  lineageDetails.getUpdatedAt().toString(),
                  org.apache.jena.datatypes.xsd.XSDDatatype.XSDlong));
          // PROV-O timing: updatedAt is when the Activity last completed (or was
          // last observed). For instantaneous activities it equals startedAtTime.
          detailsResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "endedAtTime"),
              model.createTypedLiteral(
                  java.time.Instant.ofEpochMilli(lineageDetails.getUpdatedAt()).toString(),
                  org.apache.jena.datatypes.xsd.XSDDatatype.XSDdateTime));
        }

        if (lineageDetails.getCreatedBy() != null) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "lineageCreatedBy"),
              lineageDetails.getCreatedBy());
          // PROV-O agency: the Activity was associated with the Agent (user/bot)
          // that triggered or owns it. We don't know the agent's UUID from a
          // username string, so use a name-based URI under entity/user/.
          String associatedAgentUri =
              config.getBaseUri().toString()
                  + "entity/user/"
                  + lineageDetails.getCreatedBy().replaceAll("[^A-Za-z0-9_.-]", "_");
          detailsResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "wasAssociatedWith"),
              model.createResource(associatedAgentUri));
        }
        if (lineageDetails.getUpdatedBy() != null) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "lineageUpdatedBy"),
              lineageDetails.getUpdatedBy());
        }
      }

      // Idempotent delete/insert pattern ensures no duplicate triples
      java.io.StringWriter writer = new java.io.StringWriter();
      model.write(writer, "N-TRIPLES");
      String triples = writer.toString();

      if (!triples.isEmpty()) {
        String detailsUri =
            config.getBaseUri().toString() + "lineageDetails/" + fromId + "/" + toId;
        // Cleanup before re-insert: remove the lineage edge (both directions),
        // any LineageDetails subtree for THIS specific (fromId, toId) edge — never
        // touch the source entity's hasLineageDetails links to OTHER downstream
        // entities — and any prov:generated reference to this details resource.
        // The hasLineageDetails delete is pinned to <fromUri> hasLineageDetails
        // <detailsUri> so reindexing one edge doesn't strip the source's other
        // downstream lineage links. The detailsUri-prefixed delete cleans up the
        // LineageDetails resource itself plus its child columnLineage resources
        // (deterministic URI prefix).
        String deleteQuery =
            String.format(
                "DELETE WHERE { GRAPH <%s> { <%s> <https://open-metadata.org/ontology/UPSTREAM> <%s> . } };"
                    + " DELETE WHERE { GRAPH <%s> { <%s> <http://www.w3.org/ns/prov#wasDerivedFrom> <%s> . } };"
                    + " DELETE WHERE { GRAPH <%s> { <%s> <https://open-metadata.org/ontology/hasLineageDetails> <%s> . } };"
                    + " DELETE { GRAPH <%s> { ?s ?p ?o } } WHERE { GRAPH <%s> { ?s ?p ?o . FILTER(STRSTARTS(STR(?s), \"%s\")) } };"
                    + " DELETE { GRAPH <%s> { ?act <http://www.w3.org/ns/prov#generated> <%s> } } WHERE { GRAPH <%s> { ?act <http://www.w3.org/ns/prov#generated> <%s> } }",
                KNOWLEDGE_GRAPH,
                fromUri,
                toUri,
                KNOWLEDGE_GRAPH,
                toUri,
                fromUri,
                KNOWLEDGE_GRAPH,
                fromUri,
                detailsUri,
                KNOWLEDGE_GRAPH,
                KNOWLEDGE_GRAPH,
                detailsUri,
                KNOWLEDGE_GRAPH,
                detailsUri,
                KNOWLEDGE_GRAPH,
                detailsUri);

        storageService.executeSparqlUpdate(deleteQuery);

        String insertQuery = "INSERT DATA { GRAPH <" + KNOWLEDGE_GRAPH + "> { " + triples + " } }";

        storageService.executeSparqlUpdate(insertQuery);
        LOG.debug("Added lineage with details from {}/{} to {}/{}", fromType, fromId, toType, toId);
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to add lineage with details from {}/{} to {}/{}",
          fromType,
          fromId,
          toType,
          toId,
          e);
      throw new RuntimeException("Failed to add lineage with details", e);
    }
  }

  public void removeRelationship(EntityRelationship relationship) {
    if (!isEnabled()) {
      return;
    }

    try {
      String fromUri =
          config.getBaseUri().toString()
              + "entity/"
              + relationship.getFromEntity()
              + "/"
              + relationship.getFromId();
      String toUri =
          config.getBaseUri().toString()
              + "entity/"
              + relationship.getToEntity()
              + "/"
              + relationship.getToId();
      // Relationships are written to the knowledge graph (see storeRelationship
      // / bulkStoreRelationships / addRelationship) so the DELETE must target
      // the same named graph. A bare DELETE in the default graph never matched
      // any of the stored triples and removeRelationship was effectively a
      // no-op. Also use getRelationshipPredicate so the predicate URI matches
      // exactly what addRelationship wrote (e.g. UPSTREAM → prov:wasDerivedFrom),
      // not a naive "<baseUri>ontology/<relationshipType>" concat.
      Model tempModel = ModelFactory.createDefaultModel();
      String predicateUri;
      try {
        predicateUri =
            getRelationshipPredicate(relationship.getRelationshipType().value(), tempModel)
                .getURI();
      } finally {
        tempModel.close();
      }

      String sparqlUpdate =
          String.format(
              "DELETE WHERE { GRAPH <%s> { <%s> <%s> <%s> } }",
              KNOWLEDGE_GRAPH, fromUri, predicateUri, toUri);

      storageService.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Removed relationship {} from RDF store", relationship);
    } catch (Exception e) {
      LOG.error("Failed to remove relationship from RDF", e);
    }
  }

  public String getEntityAsJsonLd(String entityType, UUID entityId) throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF/JSON-LD not enabled");
    }

    try {
      // Get entity to convert to JSON-LD directly
      EntityInterface entity = Entity.getEntity(entityType, entityId, "*", null);

      // Convert directly to JSON-LD without going through RDF model
      return translator.toJsonLdString(entity, true);

    } catch (EntityNotFoundException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Failed to get entity {} as JSON-LD", entityId, e);
      throw new IOException("Failed to get entity as JSON-LD", e);
    }
  }

  public String getEntityAsRdf(String entityType, UUID entityId, String format) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    try {
      // Get the entity and convert to RDF
      EntityInterface entity = Entity.getEntity(entityType, entityId, "*", null);
      Model rdfModel = translator.toRdf(entity);

      // Convert model to requested format
      java.io.StringWriter writer = new java.io.StringWriter();
      String rdfFormat =
          switch (format.toLowerCase()) {
            case "turtle", "ttl" -> "TURTLE";
            case "rdfxml", "xml" -> "RDF/XML";
            case "ntriples", "nt" -> "N-TRIPLES";
            default -> "TURTLE";
          };

      rdfModel.write(writer, rdfFormat);
      return writer.toString();

    } catch (EntityNotFoundException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Failed to get entity {} as RDF", entityId, e);
      throw new RuntimeException("Failed to get entity as RDF", e);
    }
  }

  public String executeSparqlQuery(String query, String format) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    // Check if inference is enabled by default in configuration
    if (isInferenceEnabledByDefault()) {
      String defaultLevel = getDefaultInferenceLevel();
      return executeSparqlQueryWithInference(query, format, defaultLevel);
    }

    return storageService.executeSparqlQuery(query, format);
  }

  /**
   * Execute SPARQL query without inference, regardless of configuration. Use this for internal
   * queries where inference overhead is not needed.
   */
  public String executeSparqlQueryDirect(String query, String format) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }
    return storageService.executeSparqlQuery(query, format);
  }

  public boolean isInferenceEnabledByDefault() {
    return config.getInferenceEnabled() != null && config.getInferenceEnabled();
  }

  public String getDefaultInferenceLevel() {
    if (config.getDefaultInferenceLevel() != null) {
      return config.getDefaultInferenceLevel().value();
    }
    return "NONE";
  }

  public RdfConfiguration getConfig() {
    return config;
  }

  public List<Map<String, String>> executeSparqlQueryAsJson(String query) {
    String result = executeSparqlQuery(query, "json");
    return parseSparqlJsonResults(result);
  }

  public List<Map<String, String>> executeSparqlQueryWithInferenceAsJson(
      String query, String inferenceLevel) {
    String result = executeSparqlQueryWithInference(query, "json", inferenceLevel);
    return parseSparqlJsonResults(result);
  }

  private List<Map<String, String>> parseSparqlJsonResults(String jsonResult) {
    List<Map<String, String>> results = new ArrayList<>();
    try {
      JsonNode root = JsonUtils.readTree(jsonResult);
      JsonNode bindings = root.path("results").path("bindings");

      for (JsonNode binding : bindings) {
        Map<String, String> row = new HashMap<>();
        binding
            .fields()
            .forEachRemaining(
                entry -> {
                  JsonNode value = entry.getValue();
                  String val = value.path("value").asText();
                  row.put(entry.getKey(), val);
                });
        results.add(row);
      }
    } catch (Exception e) {
      LOG.error("Failed to parse SPARQL JSON results", e);
    }
    return results;
  }

  public String executeSparqlQueryWithInference(
      String query, String format, String inferenceLevel) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    try {
      // Convert inference level string to enum
      org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel level =
          switch (inferenceLevel.toLowerCase()) {
            case "rdfs" -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel
                .RDFS;
            case "owl" -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel
                .OWL_LITE;
            case "custom" -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel
                .CUSTOM;
            default -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel.NONE;
          };

      if (level == org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel.NONE) {
        return executeSparqlQueryDirect(query, format);
      }

      // For inference queries, we need to work with the full model
      // This is a simplified implementation - in production, you'd want to cache the inference
      // model
      LOG.info("Executing SPARQL query with {} inference", inferenceLevel);

      // Get all data from the store (simplified - in production, use named graphs)
      String allDataQuery = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";
      String allData = storageService.executeSparqlQuery(allDataQuery, "text/turtle");

      // Create models
      org.apache.jena.rdf.model.Model baseModel =
          org.apache.jena.rdf.model.ModelFactory.createDefaultModel();
      baseModel.read(new java.io.StringReader(allData), null, "TURTLE");

      // Load ontology model
      org.apache.jena.rdf.model.Model ontologyModel =
          org.apache.jena.rdf.model.ModelFactory.createDefaultModel();
      String ontologyQuery =
          "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <https://open-metadata.org/graph/ontology> { ?s ?p ?o } }";
      String ontologyData = storageService.executeSparqlQuery(ontologyQuery, "text/turtle");
      if (ontologyData != null && !ontologyData.isEmpty()) {
        ontologyModel.read(new java.io.StringReader(ontologyData), null, "TURTLE");
      }

      // Create inference engine and inference model
      org.openmetadata.service.rdf.reasoning.InferenceEngine engine =
          new org.openmetadata.service.rdf.reasoning.InferenceEngine(level);
      org.apache.jena.rdf.model.InfModel infModel =
          engine.createInferenceModel(baseModel, ontologyModel);

      // Execute query on inference model
      org.apache.jena.query.Query jenaQuery = org.apache.jena.query.QueryFactory.create(query);
      org.apache.jena.query.QueryExecution qe =
          org.apache.jena.query.QueryExecutionFactory.create(jenaQuery, infModel);

      // Format results based on query type
      java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
      if (jenaQuery.isSelectType()) {
        org.apache.jena.query.ResultSet results = qe.execSelect();
        if (format.contains("json")) {
          org.apache.jena.query.ResultSetFormatter.outputAsJSON(out, results);
        } else if (format.contains("xml")) {
          org.apache.jena.query.ResultSetFormatter.outputAsXML(out, results);
        } else if (format.contains("csv")) {
          org.apache.jena.query.ResultSetFormatter.outputAsCSV(out, results);
        } else if (format.contains("tsv")) {
          org.apache.jena.query.ResultSetFormatter.outputAsTSV(out, results);
        }
      } else if (jenaQuery.isConstructType()) {
        org.apache.jena.rdf.model.Model constructModel = qe.execConstruct();
        constructModel.write(out, getJenaFormat(format));
      } else if (jenaQuery.isAskType()) {
        boolean result = qe.execAsk();
        out.write(("{\"head\":{},\"boolean\":" + result + "}").getBytes());
      } else if (jenaQuery.isDescribeType()) {
        org.apache.jena.rdf.model.Model describeModel = qe.execDescribe();
        describeModel.write(out, getJenaFormat(format));
      }

      qe.close();
      return out.toString();

    } catch (Exception e) {
      LOG.error("Error executing SPARQL query with inference", e);
      throw new RuntimeException("Failed to execute query with inference", e);
    }
  }

  private String getJenaFormat(String mimeType) {
    if (mimeType.contains("turtle")) return "TURTLE";
    if (mimeType.contains("rdf+xml")) return "RDF/XML";
    if (mimeType.contains("n-triples")) return "N-TRIPLES";
    if (mimeType.contains("json-ld") || mimeType.contains("ld+json")) return "JSON-LD";
    return "TURTLE"; // default
  }

  public String getEntityGraph(
      UUID entityId,
      String entityType,
      int depth,
      Set<String> entityTypes,
      Set<String> relationshipTypes)
      throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF Repository is not enabled");
    }

    String validatedEntityType = requireKnownEntityType(entityType);
    String entityUri =
        config.getBaseUri().toString() + "entity/" + validatedEntityType + "/" + entityId;

    try {
      EntityGraphTraversalResult traversalResult = traverseEntityGraph(entityUri, depth);
      FilteredEntityGraph filteredGraph =
          applyGraphFilters(
              entityUri,
              traversalResult.nodeUris(),
              traversalResult.edges(),
              entityTypes,
              relationshipTypes);

      return convertEdgesToGraphData(
          entityUri,
          filteredGraph.nodeUris(),
          filteredGraph.edges(),
          buildEntityTypeFilterOptions(traversalResult.nodeUris()),
          buildRelationshipFilterOptions(traversalResult.edges()));
    } catch (Exception e) {
      LOG.error("Error getting entity graph for {}", entityUri, e);
      throw new IOException("Failed to get entity graph", e);
    }
  }

  public String exportEntityGraph(
      UUID entityId,
      String entityType,
      int depth,
      Set<String> entityTypes,
      Set<String> relationshipTypes,
      String format)
      throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF Repository is not enabled");
    }

    String validatedEntityType = requireKnownEntityType(entityType);
    String normalizedFormat = normalizeEntityGraphExportFormat(format);
    String entityUri =
        config.getBaseUri().toString() + "entity/" + validatedEntityType + "/" + entityId;

    try {
      EntityGraphTraversalResult traversalResult = traverseEntityGraph(entityUri, depth);
      FilteredEntityGraph filteredGraph =
          applyGraphFilters(
              entityUri,
              traversalResult.nodeUris(),
              traversalResult.edges(),
              entityTypes,
              relationshipTypes);

      Model model = buildEntityGraphExportModel(filteredGraph.nodeUris(), filteredGraph.edges());

      java.io.StringWriter writer = new java.io.StringWriter();
      model.write(writer, normalizedFormat);

      return writer.toString();
    } catch (Exception e) {
      LOG.error("Error exporting entity graph for {}", entityUri, e);
      throw new IOException("Failed to export entity graph", e);
    }
  }

  private String requireKnownEntityType(String entityType) {
    if (entityType == null || entityType.isBlank()) {
      throw new IllegalArgumentException("Entity type is required");
    }

    String trimmedEntityType = entityType.trim();
    if (!trimmedEntityType.matches("[A-Za-z][A-Za-z0-9]*")
        || !Entity.hasEntityRepository(trimmedEntityType)) {
      throw new IllegalArgumentException("Invalid entity type");
    }

    return trimmedEntityType;
  }

  /**
   * Get glossary term relationship graph with pagination support.
   * This method queries the RDF store for glossary terms and their relationships,
   * supporting filtering by glossary and relation types.
   *
   * @param glossaryId Optional glossary ID to filter terms
   * @param glossaryTermId Optional glossary term ID to filter the graph to a term and its direct
   *     neighbors
   * @param relationTypes Comma-separated list of relation types to include (e.g., "relatedTo,synonym")
   * @param limit Maximum number of terms to return
   * @param offset Pagination offset
   * @param includeIsolated Whether to include terms without relationships
   * @return JSON string with nodes and edges
   */
  public String getGlossaryTermGraph(
      UUID glossaryId,
      UUID glossaryTermId,
      String relationTypes,
      int limit,
      int offset,
      boolean includeIsolated)
      throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF Repository is not enabled");
    }

    try {
      String sparqlQuery =
          buildGlossaryTermGraphQuery(
              glossaryId, glossaryTermId, relationTypes, limit, offset, includeIsolated);
      LOG.info("SPARQL Query for glossary term graph:\n{}", sparqlQuery);

      String results =
          storageService.executeSparqlQuery(sparqlQuery, "application/sparql-results+json");
      LOG.info(
          "SPARQL Results (first 2000 chars): {}",
          results.length() > 2000 ? results.substring(0, 2000) + "..." : results);

      return parseGlossaryTermGraphResults(
          results, includeIsolated, glossaryId, glossaryTermId, limit, offset);
    } catch (Exception e) {
      LOG.error("Error getting glossary term graph", e);
      throw new IOException("Failed to get glossary term graph", e);
    }
  }

  private String buildGlossaryTermGraphQuery(
      UUID glossaryId,
      UUID glossaryTermId,
      String relationTypes,
      int limit,
      int offset,
      boolean includeIsolated) {
    List<String> relationPredicates = buildGlossaryTermRelationPredicates(relationTypes);
    String relationPredicateFilter = String.join(", ", relationPredicates);
    StringBuilder queryBuilder = new StringBuilder();
    queryBuilder.append("PREFIX om: <https://open-metadata.org/ontology/> ");
    queryBuilder.append("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ");
    queryBuilder.append("PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ");
    queryBuilder.append("PREFIX skos: <http://www.w3.org/2004/02/skos/core#> ");
    queryBuilder.append("PREFIX prov: <http://www.w3.org/ns/prov#> ");
    queryBuilder.append(
        "SELECT DISTINCT ?term1 ?term2 ?relationType ?term1Name ?term2Name ?term1FQN ?term2FQN ?term1DisplayName ?term2DisplayName ?glossary ?glossaryName ");
    queryBuilder.append("WHERE { ");
    queryBuilder.append("  GRAPH ?g { ");
    if (glossaryTermId != null) {
      String glossaryTermUri =
          config.getBaseUri().toString() + "entity/glossaryTerm/" + glossaryTermId;
      queryBuilder.append("    VALUES ?selectedTerm { <").append(glossaryTermUri).append("> } ");
      queryBuilder.append("    { BIND(?selectedTerm AS ?term1) } UNION { ");
      queryBuilder.append("      ?selectedTerm ?candidateRelation ?term1 . ");
      queryBuilder.append("      FILTER(?candidateRelation IN (");
      queryBuilder.append(relationPredicateFilter);
      queryBuilder.append(")) ");
      queryBuilder.append("    } UNION { ");
      queryBuilder.append("      ?term1 ?candidateRelation ?selectedTerm . ");
      queryBuilder.append("      FILTER(?candidateRelation IN (");
      queryBuilder.append(relationPredicateFilter);
      queryBuilder.append(")) ");
      queryBuilder.append("    } ");
    }
    // Note: glossaryTerm entities are typed as skos:Concept (see RdfUtils.getRdfType)
    queryBuilder.append("    ?term1 a skos:Concept . ");
    // Filter to only include glossaryTerm URIs (not tags or other skos:Concept types)
    queryBuilder.append("    FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) ");
    // `name` is mapped to rdfs:label in base.jsonld; om:name is never written.
    // Read rdfs:label so terms without a displayName still surface a real label
    // instead of falling back to the entity UUID at render time.
    queryBuilder.append("    OPTIONAL { ?term1 rdfs:label ?term1Name } ");
    queryBuilder.append("    OPTIONAL { ?term1 skos:prefLabel ?term1DisplayName } ");
    queryBuilder.append("    OPTIONAL { ?term1 om:fullyQualifiedName ?term1FQN } ");
    // For glossary-wide queries, require the membership triple so rows outside
    // the requested glossary are dropped. For term-filtered queries, require
    // the selected term to be in the glossary while allowing direct neighbors
    // to come from another glossary.
    // The predicate is om:belongsToGlossary (see governance.jsonld @context for
    // GlossaryTerm.glossary); the previous om:belongsTo predicate is never
    // written, which made the downstream FILTER a no-op and leaked every
    // glossary's terms.
    if (glossaryId != null && glossaryTermId == null) {
      String glossaryUri = config.getBaseUri().toString() + "entity/glossary/" + glossaryId;
      queryBuilder.append("    ?term1 om:belongsToGlossary <").append(glossaryUri).append("> . ");
      queryBuilder.append("    BIND(<").append(glossaryUri).append("> AS ?glossary) ");
    } else {
      if (glossaryId != null) {
        String glossaryUri = config.getBaseUri().toString() + "entity/glossary/" + glossaryId;
        queryBuilder
            .append("    ?selectedTerm om:belongsToGlossary <")
            .append(glossaryUri)
            .append("> . ");
      }
      queryBuilder.append("    OPTIONAL { ?term1 om:belongsToGlossary ?glossary } ");
    }
    // Resolve the glossary's human label so the UI can render a group container
    // even when the parent Glossary entity is not in the caller's accessible
    // glossary list (otherwise it falls back to the raw UUID). The `name`
    // property is mapped to rdfs:label by base.jsonld; skos:prefLabel
    // (displayName) is also tried so a user-friendly label wins when present.
    queryBuilder.append("    OPTIONAL { ?glossary skos:prefLabel ?glossaryDisplayName } ");
    queryBuilder.append("    OPTIONAL { ?glossary rdfs:label ?glossaryRdfsLabel } ");
    queryBuilder.append(
        "    BIND(COALESCE(?glossaryDisplayName, ?glossaryRdfsLabel) AS ?glossaryName) ");

    queryBuilder.append("    OPTIONAL { ");
    queryBuilder.append("      ?term1 ?relationType ?term2 . ");
    // Note: glossaryTerm entities are typed as skos:Concept (see RdfUtils.getRdfType)
    queryBuilder.append("      ?term2 a skos:Concept . ");
    queryBuilder.append("      FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) ");
    queryBuilder.append("      OPTIONAL { ?term2 rdfs:label ?term2Name } ");
    queryBuilder.append("      OPTIONAL { ?term2 skos:prefLabel ?term2DisplayName } ");
    queryBuilder.append("      OPTIONAL { ?term2 om:fullyQualifiedName ?term2FQN } ");
    queryBuilder.append("      FILTER(?relationType IN (");
    queryBuilder.append(relationPredicateFilter);
    queryBuilder.append(")) ");
    if (glossaryTermId != null) {
      queryBuilder.append("      FILTER(?term1 = ?selectedTerm || ?term2 = ?selectedTerm) ");
    }
    queryBuilder.append("    } ");

    // Glossary scoping is handled above. Without a term filter the primary
    // term must be in the glossary; with a term filter the selected term must
    // be in the glossary while direct neighbors may come from other glossaries.

    queryBuilder.append("  } ");
    queryBuilder.append("} ");
    queryBuilder.append("ORDER BY ?term1Name ");
    queryBuilder.append("LIMIT ").append(limit * 10); // Get more to account for relations
    queryBuilder.append(" OFFSET ").append(offset);

    return queryBuilder.toString();
  }

  private List<String> buildGlossaryTermRelationPredicates(String relationTypes) {
    // Build relation type filter.
    //
    // The writer side (bulkAddGlossaryTermRelations / addGlossaryTermRelation)
    // honours user-configured custom relation types from
    // GlossaryTermRelationSettings — operators can define types like
    // "Enrolls In" / "Enabled By" with their own RDF predicate URIs and the
    // writer correctly emits those triples. But this read path was hardcoded
    // to the built-in CURIE list (om:relatedTo, skos:broader, …) and silently
    // dropped every custom-typed edge. Result: customer environments saw
    // their relations in the Overview tab (DB) and in the global Ontology
    // Explorer (DB-backed scope='global') but the term-page Relations Graph
    // (RDF-backed scope='term') rendered the source node alone, exactly as
    // image-v6 in the bug report.
    //
    // Mirror clearAllGlossaryTermRelations's settings-aware predicate
    // assembly so reader and writer stay in sync.
    List<String> relationPredicates = new ArrayList<>();
    if (relationTypes != null && !relationTypes.isEmpty()) {
      for (String relType : relationTypes.split(",")) {
        String trimmed = relType.trim().toLowerCase();
        relationPredicates.addAll(getRelationPredicates(trimmed));
      }
      return relationPredicates;
    }

    // Default: all glossary term relations (must match predicates from settings/storage)
    // OpenMetadata ontology predicates
    relationPredicates.add("om:relatedTo");
    relationPredicates.add("om:typeOf");
    relationPredicates.add("om:hasTypes");
    relationPredicates.add("om:componentOf");
    relationPredicates.add("om:composedOf");
    relationPredicates.add("om:calculatedFrom");
    relationPredicates.add("om:usedToCalculate");
    relationPredicates.add("om:partOf");
    relationPredicates.add("om:hasPart");
    relationPredicates.add("om:antonym");
    // SKOS predicates (as configured in settings)
    relationPredicates.add("skos:broader");
    relationPredicates.add("skos:narrower");
    relationPredicates.add("skos:related");
    relationPredicates.add("skos:exactMatch"); // synonym
    // RDFS predicates
    relationPredicates.add("rdfs:seeAlso");
    relationPredicates.add("rdfs:subClassOf");
    // PROV-O predicates (for calculatedFrom, usedToCalculate)
    relationPredicates.add("prov:wasDerivedFrom");
    relationPredicates.add("prov:wasInfluencedBy");
    for (String predicateUri : DEFAULT_GLOSSARY_TERM_RELATION_PREDICATES) {
      relationPredicates.add("<" + predicateUri + ">");
    }

    // Append user-configured custom predicates as full IRIs. Built-ins
    // already covered above as CURIEs; custom types use arbitrary URIs that
    // may not share any of the declared prefixes, so we always inject the
    // expanded form in angle brackets. Deduplication is handled by SPARQL
    // (?relationType IN (a, b, a) is equivalent to IN (a, b)).
    //
    // expandPredicateCurie is idempotent for full http(s) IRIs (see its
    // early-return branch at the `startsWith("http://") || startsWith("https://")`
    // check), so passing rdfPredicate.toString() through is safe whether
    // the configured value is already a full IRI (the realistic case for
    // custom types) or a CURIE-shaped URI like `skos:broader` (rare but
    // technically valid as a java.net.URI). Either way we end up with the
    // same fully-expanded IRI the writer used when storing the triple.
    //
    // When rdfPredicate is null on a configured custom type (a real-world
    // case observed on a customer instance — operators add the type name
    // without filling in the URI), mirror the writer's
    // getGlossaryTermRelationPredicate fallback: use
    // `https://open-metadata.org/ontology/<name>`. Without this fallback,
    // the writer would store triples at om:<name> but the reader filter
    // would not include them, exactly the symptom we just fixed for
    // explicit URIs.
    try {
      GlossaryTermRelationSettings settings =
          SettingsCache.getSetting(
              SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, GlossaryTermRelationSettings.class);
      if (settings != null && settings.getRelationTypes() != null) {
        for (var configuredType : settings.getRelationTypes()) {
          String fullUri =
              resolveConfiguredTypeUri(configuredType.getRdfPredicate(), configuredType.getName());
          if (fullUri == null) {
            continue;
          }
          relationPredicates.add("<" + fullUri + ">");
        }
      }
    } catch (RuntimeException e) {
      // SettingsCache.getSetting wraps everything as EntityNotFoundException
      // (a RuntimeException) on miss; catching Exception was wider than
      // necessary and would swallow programmer-error throwables. Narrow to
      // RuntimeException, which still covers the cache miss / cast failure
      // cases while letting checked exceptions (none today, but defensive)
      // propagate.
      LOG.debug(
          "Could not load GlossaryTermRelationSettings for graph query — "
              + "custom-typed glossary relations will be filtered out of the response. "
              + "Cause: {}",
          e.getMessage());
    }

    return relationPredicates;
  }

  private List<String> getRelationPredicates(String relationType) {
    List<String> predicates = new ArrayList<>();
    predicates.add(getRelationPredicate(relationType));
    predicates.add("<" + getGlossaryTermRelationPredicateUri(relationType) + ">");
    return predicates;
  }

  private String getRelationPredicate(String relationType) {
    // Must match the predicates configured in GlossaryTermRelationSettings
    return switch (relationType) {
      case "relatedto", "related" -> "om:relatedTo";
      case "synonym" -> "skos:exactMatch"; // matches settings config
      case "typeof", "type" -> "om:typeOf";
      case "hastypes" -> "om:hasTypes";
      case "componentof" -> "om:componentOf";
      case "composedof" -> "om:composedOf";
      case "calculatedfrom" -> "om:calculatedFrom";
      case "usedtocalculate" -> "om:usedToCalculate";
      case "seealso" -> "rdfs:seeAlso"; // matches settings config
      case "broader" -> "skos:broader";
      case "narrower" -> "skos:narrower";
      case "skosrelated" -> "skos:related";
      case "partof" -> "om:partOf";
      case "haspart" -> "om:hasPart";
      case "antonym" -> "om:antonym";
      default -> {
        if (!relationType.matches("[a-zA-Z][a-zA-Z0-9]*")) {
          LOG.warn("Invalid relation type rejected: {}", relationType);
          yield "om:relatedTo";
        }
        yield "om:" + relationType;
      }
    };
  }

  private String parseGlossaryTermGraphResults(
      String sparqlResults,
      boolean includeIsolated,
      UUID glossaryId,
      UUID glossaryTermId,
      int limit,
      int offset) {
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode edges =
        JsonUtils.getObjectMapper().createArrayNode();

    // Build the IRI → typeName lookup ONCE per request and stash on the
    // current thread so extractPredicateName's per-edge call does an O(1)
    // map.get instead of an O(relationTypes) scan with regex+concat per
    // iteration. ThreadLocal scope is fine because this method is invoked
    // synchronously from the SPARQL-results processing path; we always
    // clear it on the way out.
    predicateNameCache.set(buildPredicateUriToNameMap());
    try {

      Set<String> addedNodes = new HashSet<>();
      Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap = new HashMap<>();
      Set<String> edgeKeys = new HashSet<>();
      Set<String> termsWithRelations = new HashSet<>();

      // When scoped to a specific glossary, resolve its display label from the
      // DB once and use it as a fallback for `?glossaryName`. The SPARQL
      // OPTIONAL binds nothing if the parent Glossary entity hasn't been (or
      // has only partially been) projected to RDF — without this fallback the
      // response would omit the `group` field and the UI hierarchy view would
      // render the glossary UUID instead of its name.
      String scopedGlossaryName = lookupGlossaryDisplayName(glossaryId);

      com.fasterxml.jackson.databind.JsonNode resultsJson = JsonUtils.readTree(sparqlResults);

      if (resultsJson.has("results") && resultsJson.get("results").has("bindings")) {
        for (com.fasterxml.jackson.databind.JsonNode binding :
            resultsJson.get("results").get("bindings")) {

          String term1Uri =
              binding.has("term1") ? binding.get("term1").get("value").asText() : null;
          String term2Uri =
              binding.has("term2") && !binding.get("term2").isNull()
                  ? binding.get("term2").get("value").asText()
                  : null;
          String relationTypeUri =
              binding.has("relationType") && !binding.get("relationType").isNull()
                  ? binding.get("relationType").get("value").asText()
                  : null;
          String term1Name =
              binding.has("term1Name") && !binding.get("term1Name").isNull()
                  ? binding.get("term1Name").get("value").asText()
                  : null;
          String term2Name =
              binding.has("term2Name") && !binding.get("term2Name").isNull()
                  ? binding.get("term2Name").get("value").asText()
                  : null;
          String term1DisplayName =
              binding.has("term1DisplayName") && !binding.get("term1DisplayName").isNull()
                  ? binding.get("term1DisplayName").get("value").asText()
                  : null;
          String term2DisplayName =
              binding.has("term2DisplayName") && !binding.get("term2DisplayName").isNull()
                  ? binding.get("term2DisplayName").get("value").asText()
                  : null;
          String term1FQN =
              binding.has("term1FQN") && !binding.get("term1FQN").isNull()
                  ? binding.get("term1FQN").get("value").asText()
                  : null;
          String term2FQN =
              binding.has("term2FQN") && !binding.get("term2FQN").isNull()
                  ? binding.get("term2FQN").get("value").asText()
                  : null;
          String glossaryUri =
              binding.has("glossary") && !binding.get("glossary").isNull()
                  ? binding.get("glossary").get("value").asText()
                  : null;
          String glossaryName =
              binding.has("glossaryName") && !binding.get("glossaryName").isNull()
                  ? binding.get("glossaryName").get("value").asText()
                  : null;

          // Treat blank as missing: skos:prefLabel is materialized as an empty
          // literal when the term has no displayName, and an empty string here
          // would otherwise win over the real rdfs:label name and render as a
          // blank node label in the UI.
          String term1Label = firstNonBlank(term1DisplayName, term1Name);
          String term2Label = firstNonBlank(term2DisplayName, term2Name);
          glossaryName = firstNonBlank(glossaryName, scopedGlossaryName);

          if (term1Uri == null) continue;
          if (!matchesGlossaryTermFilter(term1Uri, term2Uri, glossaryTermId)) {
            continue;
          }

          // Add term1 node
          if (!addedNodes.contains(term1Uri) && addedNodes.size() < limit) {
            com.fasterxml.jackson.databind.node.ObjectNode node =
                createGlossaryTermNode(
                    term1Uri, term1Label, term1FQN, glossaryUri, glossaryName, term2Uri != null);
            nodes.add(node);
            nodeMap.put(term1Uri, node);
            addedNodes.add(term1Uri);
          } else if (addedNodes.contains(term1Uri)) {
            // The term may have been added earlier as a `term2` (edge target)
            // by a row whose `term1` was a different term; that path doesn't
            // populate glossaryId / group. Now that we have a row where this
            // term is the primary, backfill the membership fields so the
            // hierarchy view in the UI can resolve the group container label.
            com.fasterxml.jackson.databind.node.ObjectNode existing = nodeMap.get(term1Uri);
            if (existing != null) {
              if (!existing.has("glossaryId") && glossaryUri != null) {
                existing.put("glossaryId", extractEntityIdFromUri(glossaryUri));
              }
              if (!existing.has("group") && !isBlank(glossaryName)) {
                existing.put("group", glossaryName);
              }
              // Also upgrade the label if we now have a real one (the term2
              // path falls through to UUID when neither name nor displayName
              // is present in that row).
              String currentLabel = existing.path("label").asText(null);
              String entityId = extractEntityIdFromUri(term1Uri);
              if ((currentLabel == null || currentLabel.equals(entityId)) && !isBlank(term1Label)) {
                existing.put("label", term1Label);
              }
            }
          }

          // If there's a relation, add term2 and the edge
          if (term2Uri != null && relationTypeUri != null) {
            termsWithRelations.add(term1Uri);
            termsWithRelations.add(term2Uri);

            if (!addedNodes.contains(term2Uri) && addedNodes.size() < limit) {
              // term2 may live in a different glossary; the SPARQL row only
              // surfaces term1's glossary, so leave the membership fields empty
              // for term2 rather than mis-attributing it.
              com.fasterxml.jackson.databind.node.ObjectNode node =
                  createGlossaryTermNode(term2Uri, term2Label, term2FQN, null, null, true);
              nodes.add(node);
              nodeMap.put(term2Uri, node);
              addedNodes.add(term2Uri);
            }

            // Add edge (avoid duplicates)
            String edgeKey = term1Uri + "-" + relationTypeUri + "-" + term2Uri;
            String reverseKey = term2Uri + "-" + relationTypeUri + "-" + term1Uri;
            if (!edgeKeys.contains(edgeKey) && !edgeKeys.contains(reverseKey)) {
              edgeKeys.add(edgeKey);

              String extractedRelationType = extractPredicateName(relationTypeUri);
              String formattedLabel = formatGlossaryRelationType(relationTypeUri);
              // DEBUG, not INFO: this fires once per edge in the parsed
              // SPARQL result set. A typical graph response with hundreds
              // of edges would emit hundreds of INFO log lines per request
              // and dominate log-aggregation cost. The "RDF query returned
              // {} nodes and {} edges" summary log further down covers the
              // per-request signal at INFO level.
              LOG.debug(
                  "RDF Edge: {} -> {}, predicateUri={}, extractedType={}, label={}",
                  extractEntityIdFromUri(term1Uri),
                  extractEntityIdFromUri(term2Uri),
                  relationTypeUri,
                  extractedRelationType,
                  formattedLabel);

              com.fasterxml.jackson.databind.node.ObjectNode edge =
                  JsonUtils.getObjectMapper().createObjectNode();
              edge.put("from", extractEntityIdFromUri(term1Uri));
              edge.put("to", extractEntityIdFromUri(term2Uri));
              edge.put("label", formattedLabel);
              edge.put("relationType", extractedRelationType);
              edges.add(edge);
            }
          }
        }
      }

      // Mark isolated nodes
      for (com.fasterxml.jackson.databind.node.ObjectNode node : nodeMap.values()) {
        String nodeId = node.get("id").asText();
        String nodeUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + nodeId;
        if (!termsWithRelations.contains(nodeUri)) {
          node.put("type", "glossaryTermIsolated");
          node.put("isolated", true);
        }
      }

      if (!includeIsolated) {
        Set<String> includedNodeIds = new HashSet<>();
        com.fasterxml.jackson.databind.node.ArrayNode relatedNodes =
            JsonUtils.getObjectMapper().createArrayNode();
        for (com.fasterxml.jackson.databind.JsonNode node : nodes) {
          String nodeId = node.path("id").asText();
          String nodeUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + nodeId;
          if (termsWithRelations.contains(nodeUri)) {
            relatedNodes.add(node);
            includedNodeIds.add(nodeId);
          }
        }

        com.fasterxml.jackson.databind.node.ArrayNode relatedEdges =
            JsonUtils.getObjectMapper().createArrayNode();
        for (com.fasterxml.jackson.databind.JsonNode edge : edges) {
          if (includedNodeIds.contains(edge.path("from").asText())
              && includedNodeIds.contains(edge.path("to").asText())) {
            relatedEdges.add(edge);
          }
        }
        nodes = relatedNodes;
        edges = relatedEdges;
      }

      // If RDF didn't return enough results, fall back to database query
      if (nodes.isEmpty()) {
        LOG.info("RDF query returned no nodes, falling back to database");
        return getGlossaryTermGraphFromDatabase(
            glossaryId, glossaryTermId, limit, offset, includeIsolated);
      }
      LOG.info("RDF query returned {} nodes and {} edges", nodes.size(), edges.size());

      graphData.set("nodes", nodes);
      graphData.set("edges", edges);
      graphData.put("totalNodes", nodes.size());
      graphData.put("totalEdges", edges.size());

      return JsonUtils.pojoToJson(graphData);
    } finally {
      predicateNameCache.remove();
    }
  }

  private boolean matchesGlossaryTermFilter(String term1Uri, String term2Uri, UUID glossaryTermId) {
    if (glossaryTermId == null) {
      return true;
    }
    String selectedTermId = glossaryTermId.toString();
    return (term1Uri != null && selectedTermId.equals(extractEntityIdFromUri(term1Uri)))
        || (term2Uri != null && selectedTermId.equals(extractEntityIdFromUri(term2Uri)));
  }

  /**
   * Builds a single (configured rdfPredicate IRI → relation type name) map
   * from GlossaryTermRelationSettings, mirroring the resolution that
   * extractPredicateName needs per edge. Returns an empty map (NOT null) on
   * cache miss so extractPredicateName's contract is simple: {@code map.get}
   * either hits or falls through to the URI-local-name path.
   */
  private static java.util.Map<String, String> buildPredicateUriToNameMap() {
    java.util.Map<String, String> map = new java.util.HashMap<>();
    try {
      GlossaryTermRelationSettings settings =
          SettingsCache.getSetting(
              SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, GlossaryTermRelationSettings.class);
      if (settings != null && settings.getRelationTypes() != null) {
        for (var configuredType : settings.getRelationTypes()) {
          String configuredUri =
              resolveConfiguredTypeUri(configuredType.getRdfPredicate(), configuredType.getName());
          if (configuredUri != null) {
            map.putIfAbsent(configuredUri, configuredType.getName());
          }
        }
      }
    } catch (RuntimeException e) {
      LOG.debug(
          "Could not load GlossaryTermRelationSettings while building predicate-name "
              + "cache; per-edge lookups will fall back to URI local-name. Cause: {}",
          e.getMessage());
    }
    return map;
  }

  private com.fasterxml.jackson.databind.node.ObjectNode createGlossaryTermNode(
      String termUri,
      String name,
      String fqn,
      String glossaryUri,
      String glossaryName,
      boolean hasRelations) {
    com.fasterxml.jackson.databind.node.ObjectNode node =
        JsonUtils.getObjectMapper().createObjectNode();

    String entityId = extractEntityIdFromUri(termUri);
    node.put("id", entityId);
    node.put("label", name != null ? name : entityId);
    node.put("type", hasRelations ? "glossaryTerm" : "glossaryTermIsolated");
    if (fqn != null) {
      node.put("fullyQualifiedName", fqn);
    }
    if (glossaryUri != null) {
      node.put("glossaryId", extractEntityIdFromUri(glossaryUri));
    }
    if (glossaryName != null) {
      // Used by the UI as the hierarchy combo (group container) label so a
      // glossary name is shown even when the caller cannot see the parent
      // Glossary in the glossaries listing.
      node.put("group", glossaryName);
    }
    node.put("isolated", !hasRelations);

    return node;
  }

  private static boolean isBlank(String s) {
    return s == null || s.isBlank();
  }

  private static String firstNonBlank(String a, String b) {
    if (!isBlank(a)) return a;
    if (!isBlank(b)) return b;
    return null;
  }

  /**
   * Resolve a glossary's user-facing label from the entity repository.
   * Returns null if {@code glossaryId} is null, the entity is gone, or the
   * lookup fails — callers should treat this as a best-effort fallback.
   */
  private String lookupGlossaryDisplayName(UUID glossaryId) {
    if (glossaryId == null) {
      return null;
    }
    try {
      var glossaryRepo = Entity.getEntityRepository(Entity.GLOSSARY);
      var glossary =
          (Glossary)
              glossaryRepo.get(
                  null, glossaryId, glossaryRepo.getFields(""), Include.NON_DELETED, false);
      return firstNonBlank(glossary.getDisplayName(), glossary.getName());
    } catch (Exception e) {
      LOG.debug("Could not resolve display name for glossary {}: {}", glossaryId, e.getMessage());
      return null;
    }
  }

  private String formatGlossaryRelationType(String relationUri) {
    String relation = extractPredicateName(relationUri);
    return formatRelationTypeName(relation);
  }

  private String formatRelationTypeName(String relationType) {
    if (relationType == null) {
      return "Related To";
    }

    // Look up display name from settings
    try {
      org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
          org.openmetadata.service.resources.settings.SettingsCache.getSetting(
              org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
              org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

      if (settings != null && settings.getRelationTypes() != null) {
        for (var configuredType : settings.getRelationTypes()) {
          // Match by name (case-insensitive)
          if (configuredType.getName().equalsIgnoreCase(relationType)) {
            return configuredType.getDisplayName();
          }
          // Also check if this is an RDF predicate local name that maps to a configured type
          if (configuredType.getRdfPredicate() != null) {
            String predicateLocalName =
                extractLocalName(configuredType.getRdfPredicate().toString());
            if (predicateLocalName != null && predicateLocalName.equalsIgnoreCase(relationType)) {
              return configuredType.getDisplayName();
            }
          }
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not load settings for display name lookup: {}", e.getMessage());
    }

    // Fallback: format the relation type name nicely
    return formatRelationshipLabel(relationType);
  }

  private String extractLocalName(String uri) {
    if (uri == null) return null;
    if (uri.contains("#")) {
      return uri.substring(uri.lastIndexOf('#') + 1);
    } else if (uri.contains("/")) {
      return uri.substring(uri.lastIndexOf('/') + 1);
    }
    return uri;
  }

  static List<GlossaryTerm> filterTermsByGlossaryTermId(
      List<GlossaryTerm> terms, UUID glossaryTermId, UUID glossaryId) {
    if (glossaryTermId == null) {
      return terms;
    }

    GlossaryTerm selectedTerm =
        terms.stream().filter(term -> glossaryTermId.equals(term.getId())).findFirst().orElse(null);
    if (selectedTerm == null || !isGlossaryTermInGlossary(selectedTerm, glossaryId)) {
      return List.of();
    }

    Set<UUID> visibleTermIds = new LinkedHashSet<>();
    visibleTermIds.add(glossaryTermId);

    for (GlossaryTerm term : terms) {
      UUID termId = term.getId();
      if (termId == null) {
        continue;
      }

      if (glossaryTermId.equals(termId)) {
        addDirectGlossaryTermIds(term, visibleTermIds);
      } else if (hasDirectRelationToGlossaryTerm(term, glossaryTermId)) {
        visibleTermIds.add(termId);
      }
    }

    return terms.stream().filter(term -> visibleTermIds.contains(term.getId())).toList();
  }

  private static boolean isGlossaryTermInGlossary(GlossaryTerm term, UUID glossaryId) {
    if (glossaryId == null) {
      return true;
    }
    return term.getGlossary() != null && glossaryId.equals(term.getGlossary().getId());
  }

  private static void addDirectGlossaryTermIds(GlossaryTerm term, Set<UUID> visibleTermIds) {
    if (term.getRelatedTerms() != null) {
      for (var relatedTerm : term.getRelatedTerms()) {
        if (relatedTerm.getTerm() != null && relatedTerm.getTerm().getId() != null) {
          visibleTermIds.add(relatedTerm.getTerm().getId());
        }
      }
    }
    if (term.getParent() != null && term.getParent().getId() != null) {
      visibleTermIds.add(term.getParent().getId());
    }
    if (term.getChildren() != null) {
      for (EntityReference child : term.getChildren()) {
        if (child.getId() != null) {
          visibleTermIds.add(child.getId());
        }
      }
    }
  }

  private static boolean hasDirectRelationToGlossaryTerm(GlossaryTerm term, UUID glossaryTermId) {
    if (term.getRelatedTerms() != null) {
      for (var relatedTerm : term.getRelatedTerms()) {
        if (relatedTerm.getTerm() != null && glossaryTermId.equals(relatedTerm.getTerm().getId())) {
          return true;
        }
      }
    }
    if (term.getParent() != null && glossaryTermId.equals(term.getParent().getId())) {
      return true;
    }
    if (term.getChildren() != null) {
      for (EntityReference child : term.getChildren()) {
        if (glossaryTermId.equals(child.getId())) {
          return true;
        }
      }
    }
    return false;
  }

  static boolean isIncidentToGlossaryTermId(
      UUID sourceTermId, UUID targetTermId, UUID glossaryTermId) {
    return glossaryTermId == null
        || glossaryTermId.equals(sourceTermId)
        || glossaryTermId.equals(targetTermId);
  }

  /**
   * Fallback method to get glossary terms from database when RDF store is empty or returns no results.
   */
  private String getGlossaryTermGraphFromDatabase(
      UUID glossaryId, UUID glossaryTermId, int limit, int offset, boolean includeIsolated) {
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode edges =
        JsonUtils.getObjectMapper().createArrayNode();

    try {
      // Reuse the exact code path the /v1/glossaryTerms?glossary=<id> listing
      // takes: resolve the glossary's FQN, then drive listAfter with the
      // `parent` filter. ListFilter.getParentCondition translates that into a
      // fqnHash LIKE '<glossaryFqnHash>.%' predicate (see
      // ListFilter.getFqnPrefixCondition) which is an indexed prefix scan
      // scoped to that glossary — never the full table. The previous
      // implementation called listAll() and filtered by glossary.id in a Java
      // loop, which loaded every term in the deployment into memory.
      var glossaryTermRepository =
          (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      var listFilter = new ListFilter(null);
      if (glossaryId != null && glossaryTermId == null) {
        var glossaryRepo = Entity.getEntityRepository(Entity.GLOSSARY);
        var glossary =
            (Glossary)
                glossaryRepo.get(
                    null, glossaryId, glossaryRepo.getFields(""), Include.NON_DELETED, false);
        listFilter.addQueryParam("parent", glossary.getFullyQualifiedName());
      }
      List<GlossaryTerm> terms = new ArrayList<>();
      var fetched =
          glossaryTermRepository.listAll(
              glossaryTermRepository.getFields("relatedTerms,parent,children,glossary"),
              listFilter);
      for (var entity : fetched) {
        terms.add((GlossaryTerm) entity);
      }
      if (glossaryTermId != null) {
        terms = filterTermsByGlossaryTermId(terms, glossaryTermId, glossaryId);
      }

      Set<String> addedNodes = new HashSet<>();
      Set<String> termsWithRelations = new HashSet<>();
      Set<String> edgeKeys = new HashSet<>();
      int count = 0;

      for (var term : terms) {
        if (count >= limit) break;

        String termId = term.getId().toString();

        boolean hasRelations =
            (term.getRelatedTerms() != null && !term.getRelatedTerms().isEmpty())
                || (term.getChildren() != null && !term.getChildren().isEmpty())
                || term.getParent() != null;

        if (!includeIsolated && !hasRelations) {
          continue;
        }

        if (!addedNodes.contains(termId)) {
          com.fasterxml.jackson.databind.node.ObjectNode node =
              JsonUtils.getObjectMapper().createObjectNode();
          node.put("id", termId);
          node.put("label", term.getDisplayName() != null ? term.getDisplayName() : term.getName());
          node.put("type", hasRelations ? "glossaryTerm" : "glossaryTermIsolated");
          node.put("fullyQualifiedName", term.getFullyQualifiedName());
          node.put("isolated", !hasRelations);
          if (term.getDescription() != null) {
            node.put("description", term.getDescription());
          }
          nodes.add(node);
          addedNodes.add(termId);
          count++;
        }

        if (hasRelations) {
          termsWithRelations.add(termId);

          // Add related term edges
          if (term.getRelatedTerms() != null) {
            for (var relatedTerm : term.getRelatedTerms()) {
              var relatedTermRef = relatedTerm.getTerm();
              if (relatedTermRef == null || relatedTermRef.getId() == null) continue;

              if (!isIncidentToGlossaryTermId(
                  term.getId(), relatedTermRef.getId(), glossaryTermId)) {
                continue;
              }

              String relatedId = relatedTermRef.getId().toString();
              String relationType =
                  relatedTerm.getRelationType() != null
                      ? relatedTerm.getRelationType()
                      : "relatedTo";
              termsWithRelations.add(relatedId);

              String edgeKey =
                  termId.compareTo(relatedId) < 0
                      ? termId + "-" + relationType + "-" + relatedId
                      : relatedId + "-" + relationType + "-" + termId;

              if (!edgeKeys.contains(edgeKey)) {
                edgeKeys.add(edgeKey);
                String formattedLabel = formatRelationTypeName(relationType);
                LOG.info(
                    "DB Edge: {} -> {}, rawType={}, formattedLabel={}",
                    termId,
                    relatedId,
                    relationType,
                    formattedLabel);
                com.fasterxml.jackson.databind.node.ObjectNode edge =
                    JsonUtils.getObjectMapper().createObjectNode();
                edge.put("from", termId);
                edge.put("to", relatedId);
                edge.put("label", formattedLabel);
                edge.put("relationType", relationType);
                edges.add(edge);

                // Add related term node if not already added
                if (!addedNodes.contains(relatedId) && count < limit) {
                  com.fasterxml.jackson.databind.node.ObjectNode relatedNode =
                      JsonUtils.getObjectMapper().createObjectNode();
                  relatedNode.put("id", relatedId);
                  String relatedLabel =
                      relatedTermRef.getDisplayName() != null
                          ? relatedTermRef.getDisplayName()
                          : (relatedTermRef.getName() != null
                              ? relatedTermRef.getName()
                              : relatedId);
                  relatedNode.put("label", relatedLabel);
                  relatedNode.put("type", "glossaryTerm");
                  if (relatedTermRef.getFullyQualifiedName() != null) {
                    relatedNode.put("fullyQualifiedName", relatedTermRef.getFullyQualifiedName());
                  }
                  relatedNode.put("isolated", false);
                  nodes.add(relatedNode);
                  addedNodes.add(relatedId);
                  count++;
                }
              }
            }
          }

          // Add parent edge
          if (term.getParent() != null && term.getParent().getId() != null) {
            UUID parentId = term.getParent().getId();
            if (isIncidentToGlossaryTermId(term.getId(), parentId, glossaryTermId)) {
              String parentIdValue = parentId.toString();
              String edgeKey = parentIdValue + "-parent-" + termId;
              if (!edgeKeys.contains(edgeKey)) {
                edgeKeys.add(edgeKey);
                com.fasterxml.jackson.databind.node.ObjectNode edge =
                    JsonUtils.getObjectMapper().createObjectNode();
                edge.put("from", parentIdValue);
                edge.put("to", termId);
                edge.put("label", "Parent Of");
                edge.put("relationType", "parentOf");
                edges.add(edge);
              }
            }
          }
        }
      }

      graphData.set("nodes", nodes);
      graphData.set("edges", edges);
      graphData.put("totalNodes", addedNodes.size());
      graphData.put("totalEdges", edges.size());
      graphData.put("source", "database");

      return JsonUtils.pojoToJson(graphData);

    } catch (Exception e) {
      LOG.error("Error getting glossary terms from database", e);
      // Return empty graph
      graphData.set("nodes", nodes);
      graphData.set("edges", edges);
      graphData.put("totalNodes", 0);
      graphData.put("totalEdges", 0);
      graphData.put("error", "An internal error occurred while building the graph");
      return JsonUtils.pojoToJson(graphData);
    }
  }

  private String extractPredicateName(String predicateUri) {
    // Map standard vocabulary predicates back to our relation type names
    if (predicateUri != null) {
      // SKOS predicates
      if (predicateUri.endsWith("#exactMatch") || predicateUri.endsWith("/exactMatch")) {
        return "synonym";
      }
      if (predicateUri.endsWith("#broader") || predicateUri.endsWith("/broader")) {
        return "broader";
      }
      if (predicateUri.endsWith("#narrower") || predicateUri.endsWith("/narrower")) {
        return "narrower";
      }
      if (predicateUri.endsWith("#related") || predicateUri.endsWith("/related")) {
        return "related";
      }
      // RDFS predicates
      if (predicateUri.endsWith("#seeAlso") || predicateUri.endsWith("/seeAlso")) {
        return "seeAlso";
      }
      if (predicateUri.endsWith("#subClassOf") || predicateUri.endsWith("/subClassOf")) {
        return "broader"; // treat rdfs:subClassOf as broader
      }
      // PROV-O predicates
      if (predicateUri.endsWith("#wasDerivedFrom") || predicateUri.endsWith("/wasDerivedFrom")) {
        return "calculatedFrom"; // map prov:wasDerivedFrom back to calculatedFrom
      }
      if (predicateUri.endsWith("#wasInfluencedBy") || predicateUri.endsWith("/wasInfluencedBy")) {
        return "usedToCalculate"; // map prov:wasInfluencedBy back to usedToCalculate
      }
    }

    // Look up the configured relation type whose rdfPredicate matches this
    // URI exactly. Customers can configure custom types with arbitrary
    // predicate IRIs where the local name does NOT match the type name —
    // e.g. operator-defined `enrolledIn` mapped to
    // `https://acme.com/ns#enrolls`. Without this lookup the graph endpoint
    // would surface `enrolls` as the relationType (the URI's local name)
    // instead of `enrolledIn` (the user's chosen type name), and round-trip
    // assertions like "the type I sent on POST /relations equals the type
    // the graph returns" would fail.
    //
    // Uses a per-thread cached IRI→typeName map so a single graph response
    // pays the settings-load + map-build cost ONCE, not once per edge.
    // parseGlossaryTermGraphResults can iterate hundreds-to-thousands of
    // edges; the previous implementation was O(edges × relationTypes) with
    // a string-concat + regex pass per iteration. The cache is cleared at
    // the top of parseGlossaryTermGraphResults so settings updates between
    // requests take effect.
    if (predicateUri != null) {
      java.util.Map<String, String> map = predicateNameCache.get();
      if (map != null) {
        String name = map.get(predicateUri);
        if (name != null) {
          return name;
        }
      }
    }

    // Extract local name from URI as a final fallback (built-in om:* predicates
    // that aren't in the hardcoded mapping above land here)
    if (predicateUri.contains("#")) {
      return predicateUri.substring(predicateUri.lastIndexOf('#') + 1);
    } else if (predicateUri.contains("/")) {
      return predicateUri.substring(predicateUri.lastIndexOf('/') + 1);
    }
    return predicateUri;
  }

  private String extractEntityTypeFromUri(String entityUri) {
    // Extract entity type from URI like https://open-metadata.org/entity/table/uuid
    if (entityUri.contains("/entity/")) {
      String[] parts = entityUri.split("/entity/")[1].split("/");
      if (parts.length >= 1) {
        return parts[0];
      }
    }
    return "entity";
  }

  private com.fasterxml.jackson.databind.node.ObjectNode createNodeFromUri(String entityUri) {
    com.fasterxml.jackson.databind.node.ObjectNode node =
        JsonUtils.getObjectMapper().createObjectNode();

    String entityId = extractEntityIdFromUri(entityUri);
    String entityType = extractEntityTypeFromUri(entityUri);

    node.put("id", entityUri);
    node.put("entityId", entityId);
    node.put("type", entityType);
    node.put("group", entityType.toLowerCase());

    // Set temporary label - will be replaced with actual entity name
    node.put("label", entityId);

    return node;
  }

  private String extractEntityIdFromUri(String entityUri) {
    // Extract entity ID from URI like https://open-metadata.org/entity/table/uuid
    if (entityUri.contains("/entity/")) {
      String[] parts = entityUri.split("/entity/")[1].split("/");
      if (parts.length >= 2) {
        return parts[1];
      }
    }
    return entityUri.substring(entityUri.lastIndexOf('/') + 1);
  }

  private void enhanceNodesWithEntityDetails(
      java.util.Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap) {
    for (java.util.Map.Entry<String, com.fasterxml.jackson.databind.node.ObjectNode> entry :
        nodeMap.entrySet()) {
      com.fasterxml.jackson.databind.node.ObjectNode node = entry.getValue();
      String entityId = node.get("entityId").asText();
      String entityType = node.get("type").asText();

      try {
        EntityInterface entity = Entity.getEntity(entityType, UUID.fromString(entityId), "*", null);
        node.put(
            "label", entity.getDisplayName() != null ? entity.getDisplayName() : entity.getName());
        node.put("name", entity.getName());
        node.put("fullyQualifiedName", entity.getFullyQualifiedName());

        if (entity.getDescription() != null && !entity.getDescription().isEmpty()) {
          node.put("description", entity.getDescription());
        }

        if (entity.getTags() != null && !entity.getTags().isEmpty()) {
          com.fasterxml.jackson.databind.node.ArrayNode tagsArray =
              JsonUtils.getObjectMapper().createArrayNode();
          entity
              .getTags()
              .forEach(
                  tag -> {
                    com.fasterxml.jackson.databind.node.ObjectNode tagNode =
                        JsonUtils.getObjectMapper().createObjectNode();
                    tagNode.put("tagFQN", tag.getTagFQN());
                    tagNode.put("name", tag.getLabelType() + "." + tag.getTagFQN());
                    tagsArray.add(tagNode);
                  });
          node.set("tags", tagsArray);
        }

        StringBuilder titleBuilder = new StringBuilder();
        titleBuilder
            .append("<div style='padding: 8px; min-width: 200px;'>")
            .append("<div style='font-weight: 600; margin-bottom: 4px;'>")
            .append(entity.getDisplayName() != null ? entity.getDisplayName() : entity.getName())
            .append("</div>")
            .append("<div style='font-size: 12px; color: #8c8c8c; margin-bottom: 4px;'>")
            .append("Type: ")
            .append(entityType)
            .append("</div>")
            .append("<div style='font-size: 11px; color: #999; margin-bottom: 4px;'>")
            .append(entity.getFullyQualifiedName())
            .append("</div>");

        if (entity.getDescription() != null && !entity.getDescription().isEmpty()) {
          titleBuilder
              .append("<div style='font-size: 12px; margin-top: 4px;'>")
              .append(entity.getDescription())
              .append("</div>");
        }

        titleBuilder.append("</div>");
        node.put("title", titleBuilder.toString());

      } catch (Exception e) {
        LOG.warn("Failed to fetch entity details for {}: {}", entityId, e.getMessage());
        node.put("label", entityType + ": " + entityId);
      }
    }
  }

  /**
   * Re-orient lineage relation labels relative to the focal node. The raw stored
   * relation `(A, B, upstream)` means "A is upstream of B" — but in a graph view
   * centered on focal F, an edge {@code F → X} means X is *downstream* of F, not
   * upstream. Without this re-orientation, every outgoing lineage edge from the
   * focal would carry the misleading "Upstream" label even though it really
   * represents downstream flow.
   *
   * <p>Returns the input relation untouched for non-lineage relations and for
   * edges that don't touch the focal (e.g. multi-hop neighbours).
   */
  private String relativeRelationLabel(EdgeInfo edge, String focalUri) {
    if (focalUri == null || edge.relation == null) {
      return edge.relation;
    }
    String rel = edge.relation.toLowerCase(Locale.ROOT);
    boolean focalIsSource = focalUri.equals(edge.fromUri);
    boolean focalIsTarget = focalUri.equals(edge.toUri);
    if (!focalIsSource && !focalIsTarget) {
      return edge.relation;
    }
    return switch (rel) {
      case "upstream" -> focalIsSource ? "downstream" : "upstream";
      case "downstream" -> focalIsSource ? "upstream" : "downstream";
      default -> edge.relation;
    };
  }

  private String formatRelationshipLabel(String relationship) {
    return switch (relationship.toLowerCase()) {
      case "contains" -> "Contains";
      case "uses" -> "Uses";
      case "relatedto" -> "Related To";
      case "ownedby" -> "Owned By";
      case "belongsto" -> "Belongs To";
      case "derivedfrom" -> "Derived From";
      case "upstream" -> "Upstream";
      case "downstream" -> "Downstream";
      case "taggedwith" -> "Tagged With";
      case "classifiedas" -> "Classified As";
      case "indomain" -> "In Domain";
      case "hascolumn" -> "Has Column";
      case "hastable" -> "Has Table";
      case "hasglossaryterm" -> "Has Glossary Term";
      case "termreference" -> "Term Reference";
      case "synonymof" -> "Synonym Of";
      case "antonymof" -> "Antonym Of";
      case "ispartof" -> "Is Part Of";
      case "hasdataproduct" -> "Has Data Product";
      case "producedby" -> "Produced By";
      case "consumedby" -> "Consumed By";
      case "processedby" -> "Processed By";
      case "hasdatabase" -> "Has Database";
      case "hasschema" -> "Has Schema";
      case "hastopic" -> "Has Topic";
      case "hascontainer" -> "Has Container";
      case "hasmodel" -> "Has Model";
      case "hasstoredprocedure" -> "Has Stored Procedure";
      case "hasindex" -> "Has Index";
      default ->
      // Convert camelCase to Title Case
      relationship.replaceAll("([a-z])([A-Z])", "$1 $2").substring(0, 1).toUpperCase()
          + relationship.replaceAll("([a-z])([A-Z])", "$1 $2").substring(1);
    };
  }

  private EntityGraphTraversalResult traverseEntityGraph(String rootUri, int depth) {
    Set<String> visitedNodes = new HashSet<>();
    Set<String> currentLevelNodes = new HashSet<>();
    Set<String> discoveredNodes = new HashSet<>();
    Set<String> edgeKeys = new HashSet<>();
    List<EdgeInfo> allEdges = new ArrayList<>();

    currentLevelNodes.add(rootUri);
    visitedNodes.add(rootUri);
    discoveredNodes.add(rootUri);

    for (int currentDepth = 0;
        currentDepth < depth && !currentLevelNodes.isEmpty();
        currentDepth++) {
      String sparql = buildEntityGraphBatchQuery(currentLevelNodes);
      String results = storageService.executeSparqlQuery(sparql, "application/sparql-results+json");

      Set<String> nextLevelNodes = new HashSet<>();
      if (results != null && !results.trim().isEmpty()) {
        allEdges.addAll(
            parseEntityGraphEdgesFromResults(
                results, visitedNodes, nextLevelNodes, discoveredNodes, edgeKeys));
      }

      nextLevelNodes.removeAll(visitedNodes);
      visitedNodes.addAll(nextLevelNodes);
      currentLevelNodes = nextLevelNodes;
    }

    return new EntityGraphTraversalResult(discoveredNodes, allEdges);
  }

  private String buildEntityGraphBatchQuery(Set<String> nodeUris) {
    String entityPrefix = escapeSparqlStringLiteral(config.getBaseUri().toString() + "entity/");
    String valuesClause =
        nodeUris.stream()
            .sorted()
            .map(this::escapeSparqlUri)
            .map(uri -> "<" + uri + ">")
            .collect(java.util.stream.Collectors.joining(" "));

    return "PREFIX om: <https://open-metadata.org/ontology/> "
        + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
        + "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> "
        + "SELECT DISTINCT ?subject ?predicate ?object WHERE { "
        + "  { "
        + "    VALUES ?frontier { "
        + valuesClause
        + " } "
        + "    GRAPH ?g { "
        + "      ?frontier ?predicate ?object . "
        + "      FILTER(isIRI(?object) && "
        + "             STRSTARTS(STR(?object), \""
        + entityPrefix
        + "\") && "
        + "             ?predicate != rdf:type && "
        + "             ?predicate != rdfs:label) "
        + "    } "
        + "    BIND(?frontier AS ?subject) "
        + "  } UNION { "
        + "    VALUES ?frontier { "
        + valuesClause
        + " } "
        + "    GRAPH ?g { "
        + "      ?subject ?predicate ?frontier . "
        + "      FILTER(isIRI(?subject) && "
        + "             STRSTARTS(STR(?subject), \""
        + entityPrefix
        + "\") && "
        + "             ?predicate != rdf:type && "
        + "             ?predicate != rdfs:label) "
        + "    } "
        + "    BIND(?frontier AS ?object) "
        + "  } "
        + "} LIMIT 5000";
  }

  private String escapeSparqlUri(String uri) {
    if (uri == null || uri.isBlank()) {
      throw new IllegalArgumentException("Invalid URI for SPARQL: " + uri);
    }

    if (uri.contains("<") || uri.contains(">") || uri.chars().anyMatch(Character::isWhitespace)) {
      throw new IllegalArgumentException("Invalid URI for SPARQL: " + uri);
    }

    try {
      java.net.URI parsedUri = java.net.URI.create(uri);
      if (!parsedUri.isAbsolute()) {
        throw new IllegalArgumentException("Invalid URI for SPARQL: " + uri);
      }
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("Invalid URI for SPARQL: " + uri, e);
    }

    return uri;
  }

  private String escapeSparqlStringLiteral(String value) {
    return value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t");
  }

  private List<EdgeInfo> parseEntityGraphEdgesFromResults(
      String sparqlResults,
      Set<String> visitedNodes,
      Set<String> nextLevelNodes,
      Set<String> discoveredNodes,
      Set<String> edgeKeys) {
    List<EdgeInfo> edges = new ArrayList<>();
    com.fasterxml.jackson.databind.JsonNode resultsJson = JsonUtils.readTree(sparqlResults);

    if (resultsJson.has("results") && resultsJson.get("results").has("bindings")) {
      for (com.fasterxml.jackson.databind.JsonNode binding :
          resultsJson.get("results").get("bindings")) {
        String subjectUri =
            binding.has("subject") ? binding.get("subject").get("value").asText() : null;
        String objectUri =
            binding.has("object") ? binding.get("object").get("value").asText() : null;
        String predicate =
            binding.has("predicate") ? binding.get("predicate").get("value").asText() : null;

        if (!isEntityUri(subjectUri) || !isEntityUri(objectUri)) {
          continue;
        }

        String relationType = extractEntityRelationType(predicate);
        if (relationType == null || relationType.isBlank()) {
          continue;
        }

        String fromUri = subjectUri;
        String toUri = objectUri;
        String canonicalPredicate = predicate;
        if (isReverseDirectionPredicate(predicate)) {
          fromUri = objectUri;
          toUri = subjectUri;
          // Predicate must travel with the canonicalized direction; otherwise the
          // EdgeInfo would carry e.g. <upstream> prov:wasDerivedFrom <downstream>,
          // which is the wrong direction by PROV-O semantics. Substitute the
          // forward-direction equivalent.
          canonicalPredicate = forwardEquivalentPredicate(predicate);
          // Re-derive relationType from the canonical predicate so it matches
          // the new (from, to) orientation. Otherwise prov:wasInfluencedBy gives
          // relationType=downstream + predicate=om:UPSTREAM, which is internally
          // inconsistent and would also miss dedup against an existing UPSTREAM
          // edge written with the same subject/object.
          relationType = extractEntityRelationType(canonicalPredicate);
          if (relationType == null || relationType.isBlank()) {
            continue;
          }
        }

        String edgeKey = fromUri + "|" + relationType + "|" + toUri;
        if (!edgeKeys.add(edgeKey)) {
          continue;
        }

        EdgeInfo edge = new EdgeInfo(fromUri, toUri, relationType, canonicalPredicate);
        edges.add(edge);
        discoveredNodes.add(subjectUri);
        discoveredNodes.add(objectUri);

        if (!visitedNodes.contains(subjectUri)) {
          nextLevelNodes.add(subjectUri);
        }
        if (!visitedNodes.contains(objectUri)) {
          nextLevelNodes.add(objectUri);
        }
      }
    }

    return edges;
  }

  private static class EdgeInfo {
    final String fromUri;
    final String toUri;
    final String relation;
    final String predicateUri;

    EdgeInfo(String fromUri, String toUri, String relation, String predicateUri) {
      this.fromUri = fromUri;
      this.toUri = toUri;
      this.relation = relation;
      this.predicateUri = predicateUri;
    }
  }

  private FilteredEntityGraph applyGraphFilters(
      String rootUri,
      Set<String> nodeUris,
      List<EdgeInfo> edges,
      Set<String> entityTypeFilters,
      Set<String> relationshipTypeFilters) {
    if ((entityTypeFilters == null || entityTypeFilters.isEmpty())
        && (relationshipTypeFilters == null || relationshipTypeFilters.isEmpty())) {
      return new FilteredEntityGraph(new HashSet<>(nodeUris), edges);
    }

    Set<String> normalizedEntityFilters = new HashSet<>();
    if (entityTypeFilters != null) {
      entityTypeFilters.stream()
          .map(this::normalizeEntityTypeFilter)
          .filter(value -> !value.isBlank())
          .forEach(normalizedEntityFilters::add);
    }

    Set<String> normalizedRelationshipFilters = new HashSet<>();
    if (relationshipTypeFilters != null) {
      relationshipTypeFilters.stream()
          .map(this::normalizeRelationTypeFilter)
          .filter(value -> !value.isBlank())
          .forEach(normalizedRelationshipFilters::add);
    }

    Set<String> allowedNodes = new HashSet<>();
    for (String nodeUri : nodeUris) {
      if (rootUri.equals(nodeUri)
          || normalizedEntityFilters.isEmpty()
          || normalizedEntityFilters.contains(
              normalizeEntityTypeFilter(extractEntityTypeFromUri(nodeUri)))) {
        allowedNodes.add(nodeUri);
      }
    }

    List<EdgeInfo> filteredEdges = new ArrayList<>();
    Set<String> connectedNodes = new HashSet<>();
    connectedNodes.add(rootUri);

    for (EdgeInfo edge : edges) {
      boolean relationshipAllowed =
          normalizedRelationshipFilters.isEmpty()
              || normalizedRelationshipFilters.contains(normalizeRelationTypeFilter(edge.relation));
      if (!relationshipAllowed) {
        continue;
      }

      if (!allowedNodes.contains(edge.fromUri) || !allowedNodes.contains(edge.toUri)) {
        continue;
      }

      filteredEdges.add(edge);
      connectedNodes.add(edge.fromUri);
      connectedNodes.add(edge.toUri);
    }

    Set<String> filteredNodes = new HashSet<>();
    for (String nodeUri : allowedNodes) {
      if (rootUri.equals(nodeUri) || connectedNodes.contains(nodeUri)) {
        filteredNodes.add(nodeUri);
      }
    }
    filteredNodes.add(rootUri);

    return new FilteredEntityGraph(filteredNodes, filteredEdges);
  }

  private List<FilterOptionInfo> buildEntityTypeFilterOptions(Set<String> nodeUris) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (String nodeUri : nodeUris) {
      String entityType = extractEntityTypeFromUri(nodeUri);
      counts.merge(entityType, 1, Integer::sum);
    }
    return buildFilterOptions(counts);
  }

  private List<FilterOptionInfo> buildRelationshipFilterOptions(List<EdgeInfo> edges) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (EdgeInfo edge : edges) {
      counts.merge(edge.relation, 1, Integer::sum);
    }
    return buildFilterOptions(counts);
  }

  private List<FilterOptionInfo> buildFilterOptions(Map<String, Integer> counts) {
    return counts.entrySet().stream()
        .map(
            entry ->
                new FilterOptionInfo(
                    entry.getKey(), formatRelationshipLabel(entry.getKey()), entry.getValue()))
        .sorted(
            Comparator.comparingInt(FilterOptionInfo::count)
                .reversed()
                .thenComparing(FilterOptionInfo::label))
        .toList();
  }

  private Model buildEntityGraphExportModel(Set<String> nodeUris, List<EdgeInfo> edges) {
    Model model = ModelFactory.createDefaultModel();
    configureEntityGraphPrefixes(model);

    Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap = new HashMap<>();
    List<String> orderedNodeUris = nodeUris.stream().sorted().toList();

    for (String nodeUri : orderedNodeUris) {
      com.fasterxml.jackson.databind.node.ObjectNode node = createNodeFromUri(nodeUri);
      nodeMap.put(nodeUri, node);
    }

    enhanceNodesWithEntityDetails(nodeMap);

    for (String nodeUri : orderedNodeUris) {
      addEntityGraphNodeToModel(model, nodeUri, nodeMap.get(nodeUri));
    }

    for (EdgeInfo edge : edges) {
      if (edge.predicateUri == null || edge.predicateUri.isBlank()) {
        continue;
      }

      Resource fromResource = model.createResource(edge.fromUri);
      Resource toResource = model.createResource(edge.toUri);
      Property predicate = model.createProperty(edge.predicateUri);
      fromResource.addProperty(predicate, toResource);
    }

    return model;
  }

  private void configureEntityGraphPrefixes(Model model) {
    model.setNsPrefix("om", "https://open-metadata.org/ontology/");
    model.setNsPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    model.setNsPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
    model.setNsPrefix("dcat", "http://www.w3.org/ns/dcat#");
    model.setNsPrefix("prov", "http://www.w3.org/ns/prov#");
    model.setNsPrefix("foaf", "http://xmlns.com/foaf/0.1/");
    model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");
    model.setNsPrefix("dprod", "https://ekgf.github.io/dprod/");
  }

  private void addEntityGraphNodeToModel(
      Model model, String nodeUri, com.fasterxml.jackson.databind.node.ObjectNode node) {
    Resource resource = model.createResource(nodeUri);
    String entityType =
        node != null
            ? node.path("type").asText(extractEntityTypeFromUri(nodeUri))
            : extractEntityTypeFromUri(nodeUri);
    String rdfTypeUri = resolvePrefixedUri(RdfUtils.getRdfType(entityType));

    if (rdfTypeUri != null) {
      resource.addProperty(
          model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
          model.createResource(rdfTypeUri));
    }

    if (node == null) {
      return;
    }

    addLiteralIfPresent(
        resource,
        model.createProperty("http://www.w3.org/2000/01/rdf-schema#", "label"),
        node.path("label").asText(null));
    addLiteralIfPresent(
        resource,
        model.createProperty("https://open-metadata.org/ontology/", "name"),
        node.path("name").asText(null));
    addLiteralIfPresent(
        resource,
        model.createProperty("https://open-metadata.org/ontology/", "fullyQualifiedName"),
        node.path("fullyQualifiedName").asText(null));
    addLiteralIfPresent(
        resource,
        model.createProperty("https://open-metadata.org/ontology/", "description"),
        node.path("description").asText(null));
  }

  private void addLiteralIfPresent(Resource resource, Property property, String value) {
    if (value != null && !value.isBlank()) {
      resource.addProperty(property, value);
    }
  }

  private String resolvePrefixedUri(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }

    int separatorIndex = value.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex == value.length() - 1) {
      return value;
    }

    String prefix = value.substring(0, separatorIndex);
    String localName = value.substring(separatorIndex + 1);

    return switch (prefix) {
      case "om" -> "https://open-metadata.org/ontology/" + localName;
      case "rdf" -> "http://www.w3.org/1999/02/22-rdf-syntax-ns#" + localName;
      case "rdfs" -> "http://www.w3.org/2000/01/rdf-schema#" + localName;
      case "dcat" -> "http://www.w3.org/ns/dcat#" + localName;
      case "prov" -> "http://www.w3.org/ns/prov#" + localName;
      case "foaf" -> "http://xmlns.com/foaf/0.1/" + localName;
      case "skos" -> "http://www.w3.org/2004/02/skos/core#" + localName;
      case "dprod" -> "https://ekgf.github.io/dprod/" + localName;
      default -> value;
    };
  }

  public static String normalizeEntityGraphExportFormat(String format) {
    if (format == null || format.isBlank()) {
      return "TURTLE";
    }

    return switch (format.trim().toLowerCase(Locale.ROOT)) {
      case "jsonld", "json-ld" -> "JSON-LD";
      case "turtle", "ttl" -> "TURTLE";
      default -> throw new IllegalArgumentException("Unsupported export format");
    };
  }

  private String convertEdgesToGraphData(
      String rootUri,
      Set<String> nodeUris,
      List<EdgeInfo> edges,
      List<FilterOptionInfo> entityTypeOptions,
      List<FilterOptionInfo> relationshipTypeOptions) {
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode graphEdges =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ObjectNode filterOptions =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode entityTypeFilterOptions =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode relationshipTypeFilterOptions =
        JsonUtils.getObjectMapper().createArrayNode();

    Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap = new HashMap<>();

    List<String> orderedNodeUris =
        nodeUris.stream()
            .sorted(
                Comparator.comparing((String uri) -> !rootUri.equals(uri))
                    .thenComparing(this::extractEntityTypeFromUri)
                    .thenComparing(uri -> uri))
            .toList();

    for (String nodeUri : orderedNodeUris) {
      com.fasterxml.jackson.databind.node.ObjectNode node = createNodeFromUri(nodeUri);
      nodes.add(node);
      nodeMap.put(nodeUri, node);
    }

    for (EdgeInfo edge : edges) {
      com.fasterxml.jackson.databind.node.ObjectNode graphEdge =
          JsonUtils.getObjectMapper().createObjectNode();
      graphEdge.put("from", edge.fromUri);
      graphEdge.put("to", edge.toUri);
      // Label edges relative to the focal node so the user sees the right semantics:
      //   focal → X (focal is upstream of X)  → "Downstream"
      //   X → focal (X is upstream of focal)  → "Upstream"
      // Edges that don't touch the focal keep the raw relation label.
      String displayRelation = relativeRelationLabel(edge, rootUri);
      graphEdge.put("label", formatRelationshipLabel(displayRelation));
      graphEdge.put("relationType", displayRelation);
      graphEdge.put("arrows", "to");
      graphEdges.add(graphEdge);
    }

    for (FilterOptionInfo filterOption : entityTypeOptions) {
      entityTypeFilterOptions.add(createFilterOptionNode(filterOption));
    }

    for (FilterOptionInfo filterOption : relationshipTypeOptions) {
      relationshipTypeFilterOptions.add(createFilterOptionNode(filterOption));
    }

    enhanceNodesWithEntityDetails(nodeMap);

    graphData.set("nodes", nodes);
    graphData.set("edges", graphEdges);
    graphData.put("totalNodes", nodes.size());
    graphData.put("totalEdges", graphEdges.size());
    graphData.put("source", "rdf");

    filterOptions.set("entityTypes", entityTypeFilterOptions);
    filterOptions.set("relationshipTypes", relationshipTypeFilterOptions);
    graphData.set("filterOptions", filterOptions);

    return JsonUtils.pojoToJson(graphData);
  }

  private com.fasterxml.jackson.databind.node.ObjectNode createFilterOptionNode(
      FilterOptionInfo filterOption) {
    com.fasterxml.jackson.databind.node.ObjectNode option =
        JsonUtils.getObjectMapper().createObjectNode();
    option.put("id", filterOption.id());
    option.put("label", filterOption.label());
    option.put("count", filterOption.count());
    return option;
  }

  private boolean isEntityUri(String uri) {
    if (uri == null || !uri.startsWith(config.getBaseUri().toString() + "entity/")) {
      return false;
    }
    String[] parts = uri.split("/entity/")[1].split("/");
    return parts.length >= 2 && !parts[0].isBlank() && !parts[1].isBlank();
  }

  private String extractEntityRelationType(String predicateUri) {
    if (predicateUri == null || predicateUri.isBlank()) {
      return null;
    }

    String localName = extractUriLocalName(predicateUri);
    if (localName == null || localName.isBlank()) {
      return null;
    }

    String normalized = localName.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
    return switch (normalized) {
      case "used" -> "uses";
      case "wasderivedfrom", "upstream" -> "upstream";
      case "wasinfluencedby", "downstream" -> "downstream";
      case "wasgeneratedby" -> "processedBy";
      default -> toCanonicalIdentifier(localName);
    };
  }

  private boolean isReverseDirectionPredicate(String predicateUri) {
    String localName = extractUriLocalName(predicateUri);
    if (localName == null || localName.isBlank()) {
      return false;
    }
    String normalized = localName.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
    return normalized.equals("wasderivedfrom") || normalized.equals("wasinfluencedby");
  }

  /**
   * Map a reverse-direction predicate (PROV-O) to its forward-direction OpenMetadata
   * equivalent so the canonicalized edge in {@link #parseEntityGraphEdgesFromResults}
   * carries a predicate that matches its (from, to) orientation.
   *
   * <p>Both `prov:wasDerivedFrom` and `prov:wasInfluencedBy` are reverse-direction
   * causation predicates: in `B wasDerivedFrom A` / `B wasInfluencedBy A`, A is
   * the source and B is the effect. After we flip subject/object so the edge
   * reads source→target, the canonical forward predicate is `om:UPSTREAM` in
   * both cases. (OM does not store a separate `om:DOWNSTREAM` URI — downstream
   * is derived by reading the same UPSTREAM edge from the other side.)
   */
  private String forwardEquivalentPredicate(String reversePredicateUri) {
    String localName = extractUriLocalName(reversePredicateUri);
    if (localName == null) {
      return reversePredicateUri;
    }
    String normalized = localName.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
    return switch (normalized) {
      case "wasderivedfrom", "wasinfluencedby" -> "https://open-metadata.org/ontology/UPSTREAM";
      default -> reversePredicateUri;
    };
  }

  private String normalizeEntityTypeFilter(String entityType) {
    return entityType == null ? "" : entityType.trim().toLowerCase(Locale.ROOT);
  }

  private String normalizeRelationTypeFilter(String relationType) {
    String canonical = toCanonicalIdentifier(relationType);
    return canonical == null ? "" : canonical.toLowerCase(Locale.ROOT);
  }

  private String extractUriLocalName(String uri) {
    if (uri == null || uri.isBlank()) {
      return null;
    }
    if (uri.contains("#")) {
      return uri.substring(uri.lastIndexOf('#') + 1);
    }
    if (uri.contains("/")) {
      return uri.substring(uri.lastIndexOf('/') + 1);
    }
    return uri;
  }

  private String toCanonicalIdentifier(String value) {
    String localName = extractUriLocalName(value);
    if (localName == null || localName.isBlank()) {
      return null;
    }

    if (localName.equals(localName.toUpperCase(Locale.ROOT))) {
      return localName.toLowerCase(Locale.ROOT);
    }

    if (localName.matches("[a-z]+([A-Z][a-z0-9]+)+")) {
      return Character.toLowerCase(localName.charAt(0)) + localName.substring(1);
    }

    String spaced =
        localName.replaceAll("([a-z0-9])([A-Z])", "$1 $2").replace('_', ' ').replace('-', ' ');
    String[] parts = spaced.trim().split("\\s+");
    if (parts.length == 0) {
      return localName;
    }

    StringBuilder builder = new StringBuilder(parts[0].toLowerCase(Locale.ROOT));
    for (int i = 1; i < parts.length; i++) {
      if (parts[i].isBlank()) {
        continue;
      }
      String normalizedPart = parts[i].toLowerCase(Locale.ROOT);
      builder
          .append(Character.toUpperCase(normalizedPart.charAt(0)))
          .append(normalizedPart.substring(1));
    }
    return builder.toString();
  }

  private record EntityGraphTraversalResult(Set<String> nodeUris, List<EdgeInfo> edges) {}

  private record FilteredEntityGraph(Set<String> nodeUris, List<EdgeInfo> edges) {}

  private record FilterOptionInfo(String id, String label, int count) {}

  public void executeSparqlUpdate(String update) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    storageService.executeSparqlUpdate(update);
  }

  /**
   * Load a Turtle file directly into a named graph
   */
  public void loadTurtleFile(InputStream turtleStream, String graphUri) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    storageService.loadTurtleFile(turtleStream, graphUri);
  }

  public RdfStatistics getStatistics() {
    if (!isEnabled()) {
      return new RdfStatistics(false, 0, 0, null);
    }

    return new RdfStatistics(
        true,
        storageService.getTripleCount(),
        storageService.getAllGraphs().size(),
        config.getStorageType().toString());
  }

  public void bulkSyncEntities(String entityType, List<? extends EntityInterface> entities) {
    if (!isEnabled()) {
      return;
    }

    try {
      LOG.info(
          "Starting bulk sync for entity type: {} with {} entities", entityType, entities.size());

      for (EntityInterface entity : entities) {
        try {
          createOrUpdate(entity);
        } catch (Exception e) {
          LOG.error("Failed to sync entity {} of type {}", entity.getId(), entityType, e);
        }
      }

      LOG.info("Completed bulk sync for entity type: {}", entityType);
    } catch (Exception e) {
      LOG.error("Failed bulk sync for entity type: {}", entityType, e);
    }
  }

  /**
   * Add a glossary term relation to RDF store. This creates typed semantic relationships between
   * glossary terms using appropriate RDF predicates based on the relation type.
   *
   * @param fromTermId The source glossary term ID
   * @param toTermId The target glossary term ID
   * @param relationType The type of relation (e.g., 'synonym', 'broader', 'relatedTo')
   */
  public void addGlossaryTermRelation(UUID fromTermId, UUID toTermId, String relationType) {
    if (!isEnabled()) {
      return;
    }

    try {
      Model model = ModelFactory.createDefaultModel();
      model.setNsPrefix("om", "https://open-metadata.org/ontology/");
      model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");

      String fromUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + fromTermId;
      String toUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + toTermId;

      Resource fromResource = model.createResource(fromUri);
      Resource toResource = model.createResource(toUri);

      Property predicate = getGlossaryTermRelationPredicate(relationType, model);
      fromResource.addProperty(predicate, toResource);

      java.io.StringWriter writer = new java.io.StringWriter();
      model.write(writer, "N-TRIPLES");
      String triples = writer.toString();

      if (!triples.isEmpty()) {
        String insertQuery = "INSERT DATA { GRAPH <" + KNOWLEDGE_GRAPH + "> { " + triples + " } }";

        storageService.executeSparqlUpdate(insertQuery);
        LOG.debug("Added glossary term relation {} -> {} ({})", fromTermId, toTermId, relationType);
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to add glossary term relation {} -> {} ({})",
          fromTermId,
          toTermId,
          relationType,
          e);
    }
  }

  /**
   * Remove a glossary term relation from RDF store.
   *
   * @param fromTermId The source glossary term ID
   * @param toTermId The target glossary term ID
   * @param relationType The type of relation (e.g., 'synonym', 'broader', 'relatedTo')
   */
  public void removeGlossaryTermRelation(UUID fromTermId, UUID toTermId, String relationType) {
    if (!isEnabled()) {
      return;
    }

    try {
      String fromUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + fromTermId;
      String toUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + toTermId;
      String predicateUri = getGlossaryTermRelationPredicateUri(relationType);

      // Delete BOTH directions. The add path runs through
      // EntityRepository.addRelationship which writes the reverse direction
      // for bidirectional relationships, so a one-sided delete leaves a
      // stale "<to> om:<predicate> <from>" triple — visible as a lingering
      // edge in the relations graph after the user removed the relation.
      String sparqlUpdate =
          String.format(
              "DELETE WHERE { GRAPH <%s> { <%s> <%s> <%s> } };"
                  + "DELETE WHERE { GRAPH <%s> { <%s> <%s> <%s> } }",
              KNOWLEDGE_GRAPH,
              fromUri,
              predicateUri,
              toUri,
              KNOWLEDGE_GRAPH,
              toUri,
              predicateUri,
              fromUri);

      storageService.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Removed glossary term relation {} -> {} ({})", fromTermId, toTermId, relationType);
    } catch (Exception e) {
      LOG.error(
          "Failed to remove glossary term relation {} -> {} ({})",
          fromTermId,
          toTermId,
          relationType,
          e);
    }
  }

  private String getGlossaryTermRelationPredicateUri(String relationType) {
    if (relationType == null) {
      relationType = "relatedTo";
    }

    return switch (relationType.toLowerCase()) {
      case "relatedto" -> "https://open-metadata.org/ontology/relatedTo";
      case "synonym" -> "https://open-metadata.org/ontology/synonym";
      case "typeof", "type" -> "https://open-metadata.org/ontology/typeOf";
      case "hastypes" -> "https://open-metadata.org/ontology/hasTypes";
      case "componentof" -> "https://open-metadata.org/ontology/componentOf";
      case "composedof" -> "https://open-metadata.org/ontology/composedOf";
      case "calculatedfrom" -> "https://open-metadata.org/ontology/calculatedFrom";
      case "usedtocalculate" -> "https://open-metadata.org/ontology/usedToCalculate";
      case "seealso" -> "https://open-metadata.org/ontology/seeAlso";
      case "broader" -> "http://www.w3.org/2004/02/skos/core#broader";
      case "narrower" -> "http://www.w3.org/2004/02/skos/core#narrower";
      case "related" -> "http://www.w3.org/2004/02/skos/core#related";
      default -> "https://open-metadata.org/ontology/" + relationType;
    };
  }

  /**
   * Clear all glossary term relations from RDF store. This should be called before re-indexing to
   * remove stale relations with potentially wrong predicates.
   */
  public void clearAllGlossaryTermRelations() {
    if (!isEnabled()) {
      return;
    }

    try {
      // The IN list must cover every predicate that could have been written by
      // bulkAddGlossaryTermRelations / addGlossaryTermRelation. Those paths
      // consult GlossaryTermRelationSettings to override the default URIs, so
      // pulling that settings list here keeps the cleanup in sync with what
      // was actually inserted. Without it, custom predicates would leak past
      // the cleanup and accumulate across reindex runs.
      Set<String> predicateUris = new LinkedHashSet<>(DEFAULT_GLOSSARY_TERM_RELATION_PREDICATES);
      try {
        GlossaryTermRelationSettings settings =
            SettingsCache.getSetting(
                SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, GlossaryTermRelationSettings.class);
        if (settings != null && settings.getRelationTypes() != null) {
          for (var configuredType : settings.getRelationTypes()) {
            java.net.URI rdfPredicate = configuredType.getRdfPredicate();
            if (rdfPredicate != null) {
              predicateUris.add(expandPredicateCurie(rdfPredicate.toString()));
            }
          }
        }
      } catch (Exception e) {
        LOG.debug("Could not load GlossaryTermRelationSettings for cleanup", e);
      }

      StringBuilder filterIn = new StringBuilder();
      boolean first = true;
      for (String predicateUri : predicateUris) {
        if (!first) {
          filterIn.append(", ");
        }
        first = false;
        filterIn.append('<').append(predicateUri).append('>');
      }

      String deleteQuery =
          String.format(
              "DELETE WHERE { "
                  + "GRAPH <%s> { "
                  + "?term1 ?relationType ?term2 . "
                  + "FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) "
                  + "FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) "
                  + "FILTER(?relationType IN (%s)) "
                  + "} "
                  + "}",
              KNOWLEDGE_GRAPH, filterIn);

      storageService.executeSparqlUpdate(deleteQuery);
      LOG.info("Cleared all glossary term relations from RDF store");
    } catch (Exception e) {
      // Rethrow so the indexer can surface the failure rather than proceeding
      // with stale glossary relations still in the graph — the caller decides
      // whether to abort or continue.
      LOG.error("Failed to clear glossary term relations from RDF", e);
      throw new RuntimeException("Failed to clear glossary term relations from RDF", e);
    }
  }

  /**
   * Bulk add glossary term relations to RDF store.
   */
  public void bulkAddGlossaryTermRelations(List<GlossaryTermRelationData> relations) {
    if (!isEnabled() || relations.isEmpty()) {
      return;
    }

    try {
      Model model = ModelFactory.createDefaultModel();
      model.setNsPrefix("om", "https://open-metadata.org/ontology/");
      model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");

      for (GlossaryTermRelationData relation : relations) {
        String fromUri =
            config.getBaseUri().toString() + "entity/glossaryTerm/" + relation.fromTermId();
        String toUri =
            config.getBaseUri().toString() + "entity/glossaryTerm/" + relation.toTermId();

        Resource fromResource = model.createResource(fromUri);
        Resource toResource = model.createResource(toUri);

        Property predicate = getGlossaryTermRelationPredicate(relation.relationType(), model);
        LOG.debug(
            "RDF Indexing: {} -> {} with predicate {} (relationType={})",
            relation.fromTermId(),
            relation.toTermId(),
            predicate.getURI(),
            relation.relationType());
        fromResource.addProperty(predicate, toResource);
      }

      java.io.StringWriter writer = new java.io.StringWriter();
      model.write(writer, "N-TRIPLES");
      String triples = writer.toString();

      LOG.debug("Generated N-Triples:\n{}", triples);

      if (!triples.isEmpty()) {
        String insertQuery = "INSERT DATA { GRAPH <" + KNOWLEDGE_GRAPH + "> { " + triples + " } }";

        storageService.executeSparqlUpdate(insertQuery);
        LOG.debug("Bulk added {} glossary term relations to RDF store", relations.size());
      }
    } catch (Exception e) {
      LOG.error("Failed to bulk add glossary term relations to RDF", e);
      throw new RuntimeException("Failed to bulk add glossary term relations to RDF", e);
    }
  }

  private Property getGlossaryTermRelationPredicate(String relationType, Model model) {
    LOG.debug(
        "getGlossaryTermRelationPredicate: Looking up predicate for relationType='{}'",
        relationType);
    if (relationType == null) {
      LOG.debug(
          "getGlossaryTermRelationPredicate: relationType is null, defaulting to 'relatedTo'");
      relationType = "relatedTo";
    }

    // Look up the relation type from settings to get the configured RDF predicate
    try {
      org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
          org.openmetadata.service.resources.settings.SettingsCache.getSetting(
              org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
              org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

      if (settings != null && settings.getRelationTypes() != null) {
        LOG.debug(
            "getGlossaryTermRelationPredicate: Found {} relation types in settings",
            settings.getRelationTypes().size());
        for (var configuredType : settings.getRelationTypes()) {
          if (configuredType.getName().equalsIgnoreCase(relationType)) {
            java.net.URI rdfPredicateUri = configuredType.getRdfPredicate();
            LOG.debug(
                "getGlossaryTermRelationPredicate: Matched '{}' to configured type '{}' with rdfPredicate='{}'",
                relationType,
                configuredType.getName(),
                rdfPredicateUri);
            if (rdfPredicateUri != null) {
              Property prop = createPropertyFromUri(rdfPredicateUri.toString(), model);
              LOG.debug(
                  "getGlossaryTermRelationPredicate: Created property with URI='{}'",
                  prop.getURI());
              return prop;
            }
            break;
          }
        }
        LOG.debug(
            "getGlossaryTermRelationPredicate: No match found for '{}' in configured types",
            relationType);
      } else {
        LOG.debug("getGlossaryTermRelationPredicate: Settings or relationTypes is null");
      }
    } catch (Exception e) {
      LOG.debug(
          "getGlossaryTermRelationPredicate: Could not load settings, error: {}", e.getMessage());
    }

    // Fall back to default: use OpenMetadata ontology namespace with the relation type name
    Property defaultProp =
        model.createProperty("https://open-metadata.org/ontology/", relationType);
    LOG.debug(
        "getGlossaryTermRelationPredicate: Using default predicate URI='{}'", defaultProp.getURI());
    return defaultProp;
  }

  // Mirror createPropertyFromUri's CURIE expansion but return a full URI as
  // a string, so clearAllGlossaryTermRelations can build a SPARQL FILTER list.
  // Kept private and intentionally tracking the same prefixes
  // createPropertyFromUri handles (skos:, om:, rdfs:, owl:, prov:); if a new
  // prefix is added there, mirror it here so cleanup stays in sync.
  //
  // Throw on null/empty rather than defaulting silently. The cleanup path
  // already guards on the caller side; if a future caller forgets, a
  /**
   * Resolve a {@code GlossaryTermRelationSettings.RelationType} to its full
   * canonical predicate IRI string. Single source of truth for the
   * settings-driven URI shape used by both the reader (graph query filter,
   * predicate-name cache) and any future writer-side helper that needs the
   * IRI as a String (not a Jena {@code Property}).
   *
   * <p>Returns {@code null} if neither {@code rdfPredicate} nor {@code name}
   * is usable — callers must skip the type instead of fabricating a URI.
   */
  private static String resolveConfiguredTypeUri(java.net.URI rdfPredicate, String name) {
    if (rdfPredicate != null) {
      return expandPredicateCurie(rdfPredicate.toString());
    }
    if (name != null && !name.isBlank()) {
      return "https://open-metadata.org/ontology/" + name;
    }
    return null;
  }

  // misconfigured "rdfPredicate: null" entry would silently target relatedTo
  // and skip cleaning the real predicate — better to fail loudly.
  private static String expandPredicateCurie(String uri) {
    if (uri == null || uri.isEmpty()) {
      throw new IllegalArgumentException("expandPredicateCurie requires a non-empty URI");
    }
    String trimmed = uri.trim();
    if (trimmed.startsWith("skos:") && trimmed.length() > 5) {
      return "http://www.w3.org/2004/02/skos/core#" + trimmed.substring(5);
    }
    if (trimmed.startsWith("om:") && trimmed.length() > 3) {
      return "https://open-metadata.org/ontology/" + trimmed.substring(3);
    }
    if (trimmed.startsWith("rdfs:") && trimmed.length() > 5) {
      return "http://www.w3.org/2000/01/rdf-schema#" + trimmed.substring(5);
    }
    if (trimmed.startsWith("owl:") && trimmed.length() > 4) {
      return "http://www.w3.org/2002/07/owl#" + trimmed.substring(4);
    }
    if (trimmed.startsWith("prov:") && trimmed.length() > 5) {
      return "http://www.w3.org/ns/prov#" + trimmed.substring(5);
    }
    // Full URIs pass through unchanged. Anything else — bare local names like
    // `customRel` — is treated as a local name in the OM ontology, mirroring
    // createPropertyFromUri's default branch which writes the same value as
    // `https://open-metadata.org/ontology/<localName>`. Otherwise the cleanup
    // FILTER would target the bare string while the writer stored the full URI.
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return "https://open-metadata.org/ontology/" + trimmed;
  }

  private Property createPropertyFromUri(String uri, Model model) {
    if (uri == null || uri.isEmpty()) {
      return model.createProperty("https://open-metadata.org/ontology/", "relatedTo");
    }

    String trimmedUri = uri.trim();

    // Handle common prefix shortcuts (CURIE format)
    if (trimmedUri.startsWith("skos:") && trimmedUri.length() > 5) {
      return model.createProperty("http://www.w3.org/2004/02/skos/core#", trimmedUri.substring(5));
    } else if (trimmedUri.startsWith("om:") && trimmedUri.length() > 3) {
      return model.createProperty("https://open-metadata.org/ontology/", trimmedUri.substring(3));
    } else if (trimmedUri.startsWith("rdfs:") && trimmedUri.length() > 5) {
      return model.createProperty("http://www.w3.org/2000/01/rdf-schema#", trimmedUri.substring(5));
    } else if (trimmedUri.startsWith("owl:") && trimmedUri.length() > 4) {
      return model.createProperty("http://www.w3.org/2002/07/owl#", trimmedUri.substring(4));
    } else if (trimmedUri.startsWith("prov:") && trimmedUri.length() > 5) {
      return model.createProperty("http://www.w3.org/ns/prov#", trimmedUri.substring(5));
    }

    // Handle full URIs
    if (trimmedUri.contains("#")) {
      int hashIndex = trimmedUri.lastIndexOf('#');
      String localName = trimmedUri.substring(hashIndex + 1);
      if (!localName.isEmpty()) {
        return model.createProperty(trimmedUri.substring(0, hashIndex + 1), localName);
      }
    }

    if (trimmedUri.startsWith("http://") || trimmedUri.startsWith("https://")) {
      // Full HTTP URI - find last path segment as local name
      int lastSlash = trimmedUri.lastIndexOf('/');
      if (lastSlash > 7 && lastSlash < trimmedUri.length() - 1) {
        String localName = trimmedUri.substring(lastSlash + 1);
        return model.createProperty(trimmedUri.substring(0, lastSlash + 1), localName);
      }
      // URI ends with / or has no path - use as-is
      return model.createProperty(trimmedUri);
    }

    // Default: treat as local name in OpenMetadata ontology
    return model.createProperty("https://open-metadata.org/ontology/", trimmedUri);
  }

  public record GlossaryTermRelationData(UUID fromTermId, UUID toTermId, String relationType) {}

  /**
   * Export a glossary with all its terms and relationships as an ontology. Uses SKOS vocabulary for
   * semantic interoperability.
   */
  public String exportGlossaryAsOntology(UUID glossaryId, String format, boolean includeRelations)
      throws IOException {
    Model model = ModelFactory.createDefaultModel();

    model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");
    model.setNsPrefix("om", "https://open-metadata.org/ontology/");
    model.setNsPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
    model.setNsPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    model.setNsPrefix("dct", "http://purl.org/dc/terms/");
    model.setNsPrefix("sh", "http://www.w3.org/ns/shacl#");

    Property rdfType = model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type");
    Property skosConceptScheme =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "ConceptScheme");
    Property skosConcept = model.createProperty("http://www.w3.org/2004/02/skos/core#", "Concept");
    Property skosPrefLabel =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "prefLabel");
    Property skosDefinition =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "definition");
    Property skosInScheme =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "inScheme");
    Property skosTopConcept =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "hasTopConcept");
    Property skosBroader = model.createProperty("http://www.w3.org/2004/02/skos/core#", "broader");
    Property skosNarrower =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "narrower");
    Property skosRelated = model.createProperty("http://www.w3.org/2004/02/skos/core#", "related");
    Property dctCreated = model.createProperty("http://purl.org/dc/terms/", "created");
    Property dctModified = model.createProperty("http://purl.org/dc/terms/", "modified");
    Property rdfsLabel = model.createProperty("http://www.w3.org/2000/01/rdf-schema#", "label");

    try {
      Glossary glossary = Entity.getEntity("glossary", glossaryId, "*", null);

      String glossaryUri = config.getBaseUri().toString() + "glossary/" + glossaryId;
      Resource glossaryResource = model.createResource(glossaryUri);
      glossaryResource.addProperty(rdfType, skosConceptScheme);
      glossaryResource.addProperty(
          rdfsLabel,
          glossary.getDisplayName() != null ? glossary.getDisplayName() : glossary.getName());
      if (glossary.getDescription() != null) {
        glossaryResource.addProperty(skosDefinition, glossary.getDescription());
      }

      var glossaryTermRepository = Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      var listFilter = new ListFilter(null);
      listFilter.addQueryParam("glossary", glossaryId.toString());

      var terms =
          glossaryTermRepository.listAll(
              glossaryTermRepository.getFields("relatedTerms,parent,children,synonyms"),
              listFilter);

      Map<UUID, Resource> termResources = new HashMap<>();

      for (var entity : terms) {
        var term = (GlossaryTerm) entity;
        String termUri = config.getBaseUri().toString() + "glossaryTerm/" + term.getId();
        Resource termResource = model.createResource(termUri);

        termResource.addProperty(rdfType, skosConcept);
        termResource.addProperty(
            skosPrefLabel, term.getDisplayName() != null ? term.getDisplayName() : term.getName());
        termResource.addProperty(skosInScheme, glossaryResource);

        if (term.getDescription() != null) {
          termResource.addProperty(skosDefinition, term.getDescription());
        }

        if (term.getSynonyms() != null) {
          Property skosAltLabel =
              model.createProperty("http://www.w3.org/2004/02/skos/core#", "altLabel");
          for (String synonym : term.getSynonyms()) {
            termResource.addProperty(skosAltLabel, synonym);
          }
        }

        if (term.getParent() == null) {
          glossaryResource.addProperty(skosTopConcept, termResource);
        }

        termResources.put(term.getId(), termResource);
      }

      if (includeRelations) {
        for (var entity : terms) {
          var term = (GlossaryTerm) entity;
          Resource termResource = termResources.get(term.getId());

          if (term.getParent() != null && term.getParent().getId() != null) {
            Resource parentResource = termResources.get(term.getParent().getId());
            if (parentResource != null) {
              termResource.addProperty(skosBroader, parentResource);
              parentResource.addProperty(skosNarrower, termResource);
            }
          }

          if (term.getRelatedTerms() != null) {
            for (var relation : term.getRelatedTerms()) {
              if (relation.getTerm() != null && relation.getTerm().getId() != null) {
                Resource relatedResource = termResources.get(relation.getTerm().getId());
                if (relatedResource == null) {
                  String relatedUri =
                      config.getBaseUri().toString() + "glossaryTerm/" + relation.getTerm().getId();
                  relatedResource = model.createResource(relatedUri);
                }

                String relationType = relation.getRelationType();
                Property relationProp = getSkosRelationProperty(relationType, model);
                termResource.addProperty(relationProp, relatedResource);
              }
            }
          }
        }
        addRelationCardinalityShapes(model);
      }

      java.io.StringWriter writer = new java.io.StringWriter();
      String rdfFormat =
          switch (format.toLowerCase()) {
            case "rdfxml", "xml" -> "RDF/XML";
            case "ntriples", "nt" -> "N-TRIPLES";
            case "jsonld", "json-ld" -> "JSON-LD";
            default -> "TURTLE";
          };

      model.write(writer, rdfFormat);
      return writer.toString();

    } catch (Exception e) {
      LOG.error("Error exporting glossary {} as ontology", glossaryId, e);
      throw new IOException("Failed to export glossary as ontology", e);
    }
  }

  private Property getSkosRelationProperty(String relationType, Model model) {
    if (relationType == null) {
      return model.createProperty("http://www.w3.org/2004/02/skos/core#", "related");
    }

    return switch (relationType.toLowerCase()) {
      case "broader" -> model.createProperty("http://www.w3.org/2004/02/skos/core#", "broader");
      case "narrower" -> model.createProperty("http://www.w3.org/2004/02/skos/core#", "narrower");
      case "synonym" -> model.createProperty("http://www.w3.org/2004/02/skos/core#", "exactMatch");
      case "relatedto", "related" -> model.createProperty(
          "http://www.w3.org/2004/02/skos/core#", "related");
      case "seealso" -> model.createProperty("http://www.w3.org/2000/01/rdf-schema#", "seeAlso");
      default -> {
        try {
          org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
              org.openmetadata.service.resources.settings.SettingsCache.getSetting(
                  org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
                  org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

          if (settings != null && settings.getRelationTypes() != null) {
            for (var configuredType : settings.getRelationTypes()) {
              if (configuredType.getName().equalsIgnoreCase(relationType)) {
                java.net.URI rdfPredicateUri = configuredType.getRdfPredicate();
                if (rdfPredicateUri != null) {
                  yield createPropertyFromUri(rdfPredicateUri.toString(), model);
                }
                break;
              }
            }
          }
        } catch (Exception e) {
          LOG.debug("Could not load relation settings for type {}", relationType);
        }
        yield model.createProperty("https://open-metadata.org/ontology/", relationType);
      }
    };
  }

  private void addRelationCardinalityShapes(Model model) {
    try {
      org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
          org.openmetadata.service.resources.settings.SettingsCache.getSetting(
              org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
              org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

      if (settings == null || settings.getRelationTypes() == null) {
        return;
      }

      String shNs = "http://www.w3.org/ns/shacl#";
      String rdfNs = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
      String skosNs = "http://www.w3.org/2004/02/skos/core#";

      Property rdfType = model.createProperty(rdfNs, "type");
      Property shTargetClass = model.createProperty(shNs, "targetClass");
      Property shProperty = model.createProperty(shNs, "property");
      Property shPath = model.createProperty(shNs, "path");
      Property shMaxCount = model.createProperty(shNs, "maxCount");
      Property shInversePath = model.createProperty(shNs, "inversePath");

      Resource shape = null;

      for (var relationType : settings.getRelationTypes()) {
        Integer sourceMax = relationType.getSourceMax();
        Integer targetMax = relationType.getTargetMax();
        RelationCardinality cardinality = relationType.getCardinality();

        if (cardinality != null && cardinality != RelationCardinality.CUSTOM) {
          switch (cardinality) {
            case ONE_TO_ONE -> {
              sourceMax = 1;
              targetMax = 1;
            }
            case ONE_TO_MANY -> {
              sourceMax = 1;
              targetMax = null;
            }
            case MANY_TO_ONE -> {
              sourceMax = null;
              targetMax = 1;
            }
            case MANY_TO_MANY -> {
              sourceMax = null;
              targetMax = null;
            }
            default -> {
              // No-op for unknown values.
            }
          }
        }

        if (sourceMax == null && targetMax == null) {
          continue;
        }

        if (shape == null) {
          String shapeUri =
              config.getBaseUri().toString() + "shapes/glossaryTermRelationCardinality";
          shape = model.createResource(shapeUri);
          shape.addProperty(rdfType, model.createResource(shNs + "NodeShape"));
          shape.addProperty(shTargetClass, model.createResource(skosNs + "Concept"));
        }

        Property relationProp = getSkosRelationProperty(relationType.getName(), model);

        if (sourceMax != null) {
          Resource propertyShape = model.createResource();
          shape.addProperty(shProperty, propertyShape);
          propertyShape.addProperty(shPath, relationProp);
          propertyShape.addProperty(shMaxCount, model.createTypedLiteral(sourceMax));
        }

        if (targetMax != null) {
          Resource propertyShape = model.createResource();
          shape.addProperty(shProperty, propertyShape);
          Resource inversePath = model.createResource();
          inversePath.addProperty(shInversePath, relationProp);
          propertyShape.addProperty(shPath, inversePath);
          propertyShape.addProperty(shMaxCount, model.createTypedLiteral(targetMax));
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not add glossary term cardinality shapes", e);
    }
  }

  public void clearAll() {
    if (!isEnabled()) {
      return;
    }

    try {
      LOG.info("Clearing all data from RDF store");
      storageService.executeSparqlUpdate("CLEAR ALL");
      LOG.info("Successfully cleared all data from RDF store");
    } catch (Exception e) {
      LOG.error("Failed to clear RDF store", e);
      throw new RuntimeException("Failed to clear RDF store", e);
    }
  }

  /**
   * Trigger a backend storage compaction to physically reclaim disk space after
   * large deletes. See {@link
   * org.openmetadata.service.rdf.storage.RdfStorageInterface#compactStorage()}
   * for why this is necessary on TDB2: {@code CLEAR ALL} only marks triples as
   * deleted in TDB2's free-list — the on-disk dataset never shrinks until the
   * compaction admin endpoint is called explicitly. Failures are swallowed at
   * the storage layer; this is a best-effort housekeeping call.
   */
  public void compactStorage() {
    if (!isEnabled()) {
      return;
    }
    LOG.info("Compacting RDF storage to reclaim disk space");
    storageService.compactStorage();
  }

  /**
   * Diagnostic method to dump all glossary term relations stored in RDF. Returns a map with
   * predicate URIs as keys and counts as values, plus sample triples.
   */
  public String debugGlossaryTermRelations() {
    if (!isEnabled()) {
      return "{\"error\": \"RDF not enabled\"}";
    }

    try {
      // Query to get all predicates used between glossary terms
      String predicateQuery =
          "PREFIX om: <https://open-metadata.org/ontology/> "
              + "SELECT ?predicate (COUNT(*) as ?count) WHERE { "
              + "  GRAPH ?g { "
              + "    ?term1 ?predicate ?term2 . "
              + "    FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) "
              + "    FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) "
              + "  } "
              + "} GROUP BY ?predicate ORDER BY DESC(?count)";

      String predicateResults =
          storageService.executeSparqlQuery(predicateQuery, "application/sparql-results+json");

      // Query to get sample triples (first 20)
      String sampleQuery =
          "PREFIX om: <https://open-metadata.org/ontology/> "
              + "SELECT ?term1 ?predicate ?term2 WHERE { "
              + "  GRAPH ?g { "
              + "    ?term1 ?predicate ?term2 . "
              + "    FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) "
              + "    FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) "
              + "  } "
              + "} LIMIT 20";

      String sampleResults =
          storageService.executeSparqlQuery(sampleQuery, "application/sparql-results+json");

      // Build response
      com.fasterxml.jackson.databind.node.ObjectNode response =
          JsonUtils.getObjectMapper().createObjectNode();

      // Parse predicate counts
      com.fasterxml.jackson.databind.node.ArrayNode predicates =
          JsonUtils.getObjectMapper().createArrayNode();
      com.fasterxml.jackson.databind.JsonNode predResultsJson =
          JsonUtils.readTree(predicateResults);
      if (predResultsJson.has("results") && predResultsJson.get("results").has("bindings")) {
        for (com.fasterxml.jackson.databind.JsonNode binding :
            predResultsJson.get("results").get("bindings")) {
          com.fasterxml.jackson.databind.node.ObjectNode predInfo =
              JsonUtils.getObjectMapper().createObjectNode();
          predInfo.put(
              "predicate",
              binding.has("predicate") ? binding.get("predicate").get("value").asText() : "null");
          predInfo.put(
              "count", binding.has("count") ? binding.get("count").get("value").asInt() : 0);
          predicates.add(predInfo);
        }
      }
      response.set("predicateCounts", predicates);

      // Parse sample triples
      com.fasterxml.jackson.databind.node.ArrayNode samples =
          JsonUtils.getObjectMapper().createArrayNode();
      com.fasterxml.jackson.databind.JsonNode sampleResultsJson = JsonUtils.readTree(sampleResults);
      if (sampleResultsJson.has("results") && sampleResultsJson.get("results").has("bindings")) {
        for (com.fasterxml.jackson.databind.JsonNode binding :
            sampleResultsJson.get("results").get("bindings")) {
          com.fasterxml.jackson.databind.node.ObjectNode triple =
              JsonUtils.getObjectMapper().createObjectNode();
          triple.put(
              "term1",
              binding.has("term1")
                  ? extractEntityIdFromUri(binding.get("term1").get("value").asText())
                  : "null");
          triple.put(
              "predicate",
              binding.has("predicate") ? binding.get("predicate").get("value").asText() : "null");
          triple.put(
              "term2",
              binding.has("term2")
                  ? extractEntityIdFromUri(binding.get("term2").get("value").asText())
                  : "null");
          samples.add(triple);
        }
      }
      response.set("sampleTriples", samples);

      return JsonUtils.pojoToJson(response);
    } catch (Exception e) {
      LOG.error("Error debugging glossary term relations", e);
      com.fasterxml.jackson.databind.node.ObjectNode errorNode =
          JsonUtils.getObjectMapper().createObjectNode();
      errorNode.put("error", "An internal error occurred while debugging glossary relations");
      return JsonUtils.pojoToJson(errorNode);
    }
  }

  public void close() {
    if (storageService != null) {
      storageService.close();
    }
  }

  public static class RdfStatistics {
    public final boolean enabled;
    public final long tripleCount;
    public final int graphCount;
    public final String storageType;

    public RdfStatistics(boolean enabled, long tripleCount, int graphCount, String storageType) {
      this.enabled = enabled;
      this.tripleCount = tripleCount;
      this.graphCount = graphCount;
      this.storageType = storageType;
    }
  }
}

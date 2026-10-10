package org.openmetadata.service.rdf;

import static java.util.Map.entry;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toUnmodifiableMap;
import static java.util.stream.Collectors.toUnmodifiableSet;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.riot.out.NodeFmtLib;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

/**
 * Experiment for candidate L of docs/adr/2026-09-14-authorized-sparql.md: copy only admitted facts
 * from the knowledge graph into a fresh request-local model.
 *
 * <p>Retrieval reads {@code GRAPH <knowledge>} by subject: visible catalog resources first, then
 * the nodes they own. A fact is admitted when the caller holds the operation that governs its
 * predicate on the owning resource, and its object is a literal, an approved type, or a node the
 * caller may see. Anything without a mapping fails the whole build.
 */
public final class SanitizedModelBuilder {
  public static final String BASE = "https://open-metadata.org/";
  public static final String KNOWLEDGE = BASE + "graph/knowledge";
  public static final String OM = BASE + "ontology/";
  private static final String TYPE = RDF.type.getURI();
  private static final String LABEL = RDFS.label.getURI();
  private static final String FQN = OM + "fullyQualifiedName";
  private static final String DESCRIPTION = "http://purl.org/dc/terms/description";
  private static final String MODIFIED = "http://purl.org/dc/terms/modified";
  private static final String VERSION = "http://www.w3.org/ns/dcat#version";
  private static final String HAS_VERSION = "http://purl.org/dc/terms/hasVersion";
  private static final String IS_DELETED = OM + "isDeleted";
  private static final String CONTAINS = OM + "contains";
  private static final String BELONGS_TO_SERVICE = OM + "belongsToService";
  private static final String BELONGS_TO_DATABASE = OM + "belongsToDatabase";
  private static final String BELONGS_TO_SCHEMA = OM + "belongsToSchema";
  private static final String HAS_SERVICE_TYPE = OM + "hasServiceType";
  private static final String ENTITY_STATUS = OM + "entityStatus";
  private static final String INVALIDATED_AT = "http://www.w3.org/ns/prov#invalidatedAtTime";
  static final String CONSISTENCY_FAILURE = "Consistency failure: ";
  static final String SCOPE_ERROR = "Scope error: ";
  private static final Pattern ENTITY_IRI =
      Pattern.compile(Pattern.quote(BASE + "entity/") + "([^/]+)/([^/]+)");
  private static final Pattern CANONICAL_UUID =
      Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
  public static final int MAX_REFERENCE_LOOKUPS = 1_000;
  private static final int SUBJECTS_PER_QUERY = 100;
  private static final int MAX_OWNERSHIP_DEPTH = 8;

  /** View operation per field: EntityResource, TableResource and LineageResource. */
  enum ViewField {
    /**
     * Attributes returned by a GET without a fields parameter, which requires only VIEW_BASIC. They
     * are neither stripped from storage nor cleared on read by the entity's repository.
     */
    CORE,
    TAGS,
    COLUMNS,
    DOMAINS,
    EXTENSION,
    LINEAGE,
    /**
     * Child membership of a container: {@code tables} on a schema and {@code databaseSchemas} on a
     * database, both registered as VIEW_BASIC view operations. The child must also be independently
     * readable, so a hidden child contributes no membership.
     */
    CHILDREN;

    MetadataOperation operation() {
      return MetadataOperation.VIEW_BASIC;
    }
  }

  enum NodeKind {
    TABLE(ViewField.CORE),
    TAG(ViewField.CORE),
    DOMAIN(ViewField.CORE),
    DATABASE_SERVICE(ViewField.CORE),
    DATABASE(ViewField.CORE),
    DATABASE_SCHEMA(ViewField.CORE),
    COLUMN(ViewField.COLUMNS),
    EXTENSION(ViewField.EXTENSION),
    EXTENSION_PROPERTY(ViewField.EXTENSION);

    private final ViewField field;

    NodeKind(final ViewField field) {
      this.field = field;
    }
  }

  /**
   * Attributes every container returns from a GET without a fields parameter. The label and FQN are
   * also copied onto the container node by each referencing table's projection; the fact's subject
   * is the container, so the container's own permission governs the copy too.
   */
  private static final Map<String, ViewField> CONTAINER_CORE =
      Map.ofEntries(
          entry(TYPE, ViewField.CORE),
          entry(LABEL, ViewField.CORE),
          entry(FQN, ViewField.CORE),
          entry(DESCRIPTION, ViewField.CORE),
          entry(MODIFIED, ViewField.CORE),
          entry(VERSION, ViewField.CORE),
          entry(HAS_VERSION, ViewField.CORE),
          entry(ENTITY_STATUS, ViewField.CORE),
          entry(IS_DELETED, ViewField.CORE));

  private static Map<String, ViewField> containerFields(final Map<String, ViewField> own) {
    final Map<String, ViewField> fields = new HashMap<>(CONTAINER_CORE);
    fields.putAll(own);
    return Map.copyOf(fields);
  }

  private static final Map<NodeKind, Map<String, ViewField>> FIELD_BY_PREDICATE =
      Map.of(
          NodeKind.TABLE,
          Map.ofEntries(
              entry(TYPE, ViewField.CORE),
              entry(LABEL, ViewField.CORE),
              entry(FQN, ViewField.CORE),
              entry(DESCRIPTION, ViewField.CORE),
              entry(MODIFIED, ViewField.CORE),
              entry(VERSION, ViewField.CORE),
              entry(HAS_VERSION, ViewField.CORE),
              entry(HAS_SERVICE_TYPE, ViewField.CORE),
              entry(ENTITY_STATUS, ViewField.CORE),
              entry(OM + "processedLineage", ViewField.CORE),
              entry(IS_DELETED, ViewField.CORE),
              entry(BELONGS_TO_SERVICE, ViewField.CORE),
              entry(BELONGS_TO_DATABASE, ViewField.CORE),
              entry(BELONGS_TO_SCHEMA, ViewField.CORE),
              entry(OM + "hasTag", ViewField.TAGS),
              entry(OM + "domains", ViewField.DOMAINS),
              entry(OM + "hasColumn", ViewField.COLUMNS),
              entry(OM + "hasExtension", ViewField.EXTENSION),
              entry(OM + "upstream", ViewField.LINEAGE),
              entry(OM + "downstream", ViewField.LINEAGE),
              entry("http://www.w3.org/ns/prov#wasDerivedFrom", ViewField.LINEAGE)),
          NodeKind.TAG,
          Map.of(
              TYPE,
              ViewField.CORE,
              LABEL,
              ViewField.CORE,
              FQN,
              ViewField.CORE,
              DESCRIPTION,
              ViewField.CORE,
              MODIFIED,
              ViewField.CORE,
              VERSION,
              ViewField.CORE,
              OM + "tagFQN",
              ViewField.CORE,
              OM + "tagSource",
              ViewField.CORE),
          NodeKind.DOMAIN,
          Map.ofEntries(
              entry(TYPE, ViewField.CORE),
              entry(LABEL, ViewField.CORE),
              entry(FQN, ViewField.CORE),
              entry(DESCRIPTION, ViewField.CORE),
              entry(MODIFIED, ViewField.CORE),
              entry(VERSION, ViewField.CORE),
              entry(HAS_VERSION, ViewField.CORE),
              entry(OM + "domainType", ViewField.CORE),
              entry(ENTITY_STATUS, ViewField.CORE),
              entry(IS_DELETED, ViewField.CORE)),
          NodeKind.DATABASE_SERVICE,
          containerFields(Map.of(OM + "serviceType", ViewField.CORE)),
          NodeKind.DATABASE,
          containerFields(
              Map.of(
                  HAS_SERVICE_TYPE, ViewField.CORE,
                  BELONGS_TO_SERVICE, ViewField.CORE,
                  CONTAINS, ViewField.CHILDREN)),
          NodeKind.DATABASE_SCHEMA,
          containerFields(
              Map.of(
                  HAS_SERVICE_TYPE, ViewField.CORE,
                  BELONGS_TO_SERVICE, ViewField.CORE,
                  BELONGS_TO_DATABASE, ViewField.CORE,
                  CONTAINS, ViewField.CHILDREN)),
          NodeKind.COLUMN,
          Map.of(
              TYPE,
              ViewField.COLUMNS,
              LABEL,
              ViewField.COLUMNS,
              FQN,
              ViewField.COLUMNS,
              OM + "columnDataType",
              ViewField.COLUMNS,
              OM + "hasChildColumn",
              ViewField.COLUMNS),
          NodeKind.EXTENSION,
          Map.of(TYPE, ViewField.EXTENSION, OM + "hasExtensionProperty", ViewField.EXTENSION),
          NodeKind.EXTENSION_PROPERTY,
          Map.of(
              TYPE,
              ViewField.EXTENSION,
              OM + "extensionKey",
              ViewField.EXTENSION,
              OM + "extensionValue",
              ViewField.EXTENSION));

  /**
   * Containment predicates whose object must be another entity. The owned-node predicates in {@link
   * #OWNED_CHILD_BY_PREDICATE} reject a literal through {@code requireIri}; every remaining
   * relationship predicate still admits one, and closing that shape is a separate, unreviewed
   * change.
   */
  private static final Set<String> ENTITY_OBJECT_PREDICATES =
      Set.of(CONTAINS, BELONGS_TO_SERVICE, BELONGS_TO_DATABASE, BELONGS_TO_SCHEMA);

  private static final Map<String, NodeKind> OWNED_CHILD_BY_PREDICATE =
      Map.of(
          OM + "hasColumn", NodeKind.COLUMN,
          OM + "hasChildColumn", NodeKind.COLUMN,
          OM + "hasExtension", NodeKind.EXTENSION,
          OM + "hasExtensionProperty", NodeKind.EXTENSION_PROPERTY);

  private static final Set<String> TYPE_VOCABULARY =
      Set.of(
          OM + "Table",
          OM + "Tag",
          OM + "Domain",
          OM + "Column",
          OM + "Extension",
          OM + "ExtensionProperty",
          OM + "DatabaseService",
          OM + "Database",
          OM + "DatabaseSchema",
          "http://www.w3.org/ns/dcat#Catalog",
          "http://www.w3.org/ns/dcat#DataService",
          "http://www.w3.org/ns/dcat#Dataset",
          "http://www.w3.org/2004/02/skos/core#Concept",
          "http://www.w3.org/2004/02/skos/core#Collection",
          "http://www.w3.org/ns/prov#Entity");

  /** Every predicate some node kind maps, so a test reads the map instead of copying it. */
  public static Set<String> mappedPredicates() {
    final Set<String> predicates = new HashSet<>();
    FIELD_BY_PREDICATE.values().forEach(fields -> predicates.addAll(fields.keySet()));
    return Set.copyOf(predicates);
  }

  /** The type terms a fact may carry, exposed for the same reason. */
  public static Set<String> approvedTypes() {
    return TYPE_VOCABULARY;
  }

  private final KnowledgeSource source;
  private final Map<String, CatalogResource> catalogByIri;
  private final ReferenceStates references;
  private final CallerPermissions permissions;
  private final int tripleBudget;

  /**
   * @param catalog the candidates: catalog entities loaded as non-deleted, whether or not the caller
   *     may read them
   * @param references deletion state, from the catalog, of entities that facts reference but that
   *     are not candidates
   */
  public SanitizedModelBuilder(
      final KnowledgeSource source,
      final List<CatalogResource> catalog,
      final ReferenceStates references,
      final CallerPermissions permissions,
      final int tripleBudget) {
    this.source = source;
    this.catalogByIri =
        catalog.stream().collect(toUnmodifiableMap(CatalogResource::iri, identity()));
    this.references = references;
    this.permissions = permissions;
    this.tripleBudget = tripleBudget;
  }

  public SanitizedModel build() {
    final Retrieval retrieval = new Retrieval(tripleBudget);
    Map<Resource, Governance> frontier = visibleResources();
    for (int depth = 0; !frontier.isEmpty(); depth++) {
      requireOwnershipDepth(depth);
      retrieval.govern(frontier);
      frontier = ownedChildren(fetch(List.copyOf(frontier.keySet()), retrieval), retrieval);
    }
    final Map<String, ReferenceState> referenced = resolveReferences(retrieval);
    return new SanitizedModel(admit(retrieval, referenced), retrieval.triples, retrieval.queries);
  }

  /**
   * One bounded catalog lookup for every referenced entity that is not a candidate. References come
   * from all retrieved facts, including facts the mapping later rejects, so an over-limit or invalid
   * reference fails the build before any mapping violation is reported.
   */
  private Map<String, ReferenceState> resolveReferences(final Retrieval retrieval) {
    final Set<String> iris = new TreeSet<>();
    for (RDFNode object : retrieval.facts.listObjects().toList()) {
      if (isNonCandidateEntity(object, retrieval)) {
        iris.add(object.asResource().getURI());
      }
    }
    if (iris.size() > MAX_REFERENCE_LOOKUPS) {
      throw new RetrievalBudgetExceededException(
          "More than %d referenced entities outside the candidates; no answer is computed from a partial lookup"
              .formatted(MAX_REFERENCE_LOOKUPS));
    }
    final Set<EntityIri> validated =
        iris.stream().map(this::requireValidReference).collect(toUnmodifiableSet());
    return validated.isEmpty() ? Map.of() : references.resolve(validated);
  }

  /** A reference must name a registered entity type and a canonical UUID before it is looked up. */
  private EntityIri requireValidReference(final String iri) {
    final Matcher parts = ENTITY_IRI.matcher(iri);
    if (!parts.matches() || !references.entityTypes().contains(parts.group(1))) {
      throw new FactAdmissionException(
          CONSISTENCY_FAILURE
              + "reference %s does not name a registered entity type".formatted(iri));
    }
    if (!CANONICAL_UUID.matcher(parts.group(2)).matches()) {
      throw new FactAdmissionException(
          CONSISTENCY_FAILURE + "reference %s does not carry a canonical entity id".formatted(iri));
    }
    return new EntityIri(iri, parts.group(1), UUID.fromString(parts.group(2)));
  }

  private boolean isNonCandidateEntity(final RDFNode object, final Retrieval retrieval) {
    return object.isURIResource()
        && ENTITY_IRI.matcher(object.asResource().getURI()).matches()
        && !catalogByIri.containsKey(object.asResource().getURI())
        && retrieval.governanceOf(object).isEmpty();
  }

  private Map<Resource, Governance> visibleResources() {
    final Map<Resource, Governance> visible = new LinkedHashMap<>();
    for (CatalogResource resource : catalogByIri.values()) {
      if (permissions.allows(resource, MetadataOperation.VIEW_BASIC)) {
        visible.put(
            ResourceFactory.createResource(resource.iri()),
            new Governance(resource, kindOf(resource)));
      }
    }
    return visible;
  }

  private static void requireOwnershipDepth(final int depth) {
    if (depth > MAX_OWNERSHIP_DEPTH) {
      throw new FactAdmissionException("Owned-node closure is deeper than " + MAX_OWNERSHIP_DEPTH);
    }
  }

  private Model fetch(final List<Resource> subjects, final Retrieval retrieval) {
    final Model page = ModelFactory.createDefaultModel();
    for (int start = 0; start < subjects.size(); start += SUBJECTS_PER_QUERY) {
      final List<Resource> chunk =
          subjects.subList(start, Math.min(start + SUBJECTS_PER_QUERY, subjects.size()));
      page.add(retrieval.accept(source.construct(subjectFactsQuery(chunk, retrieval.remaining()))));
    }
    return page;
  }

  private static String subjectFactsQuery(final List<Resource> subjects, final int remaining) {
    final String values =
        subjects.stream().map(subject -> NodeFmtLib.strNT(subject.asNode())).collect(joining(" "));
    return "CONSTRUCT { ?s ?p ?o } WHERE { VALUES ?s { %s } GRAPH <%s> { ?s ?p ?o } } LIMIT %d"
        .formatted(values, KNOWLEDGE, remaining + 1L);
  }

  private Map<Resource, Governance> ownedChildren(final Model page, final Retrieval retrieval) {
    final Map<Resource, Governance> children = new LinkedHashMap<>();
    for (Statement statement : page.listStatements().toList()) {
      final NodeKind childKind = OWNED_CHILD_BY_PREDICATE.get(statement.getPredicate().getURI());
      if (childKind != null) {
        final CatalogResource owner = retrieval.requireGovernance(statement.getSubject()).owner();
        final Resource child = requireIri(statement.getObject());
        claimOwnership(child, new Governance(owner, childKind), children, retrieval);
      }
    }
    return children;
  }

  /**
   * Accepts a structured-node claim only if it agrees with every earlier claim, so ownership never
   * depends on statement or wave order. Already governed nodes are not fetched again.
   */
  private void claimOwnership(
      final Resource child,
      final Governance claim,
      final Map<Resource, Governance> wave,
      final Retrieval retrieval) {
    if (catalogByIri.containsKey(child.getURI())) {
      throw ownershipConflict(child, "catalog resource", claim);
    }
    final Governance earlier = retrieval.governanceOf(child).orElse(wave.get(child));
    if (earlier != null && !earlier.equals(claim)) {
      throw ownershipConflict(child, earlier.toString(), claim);
    }
    if (retrieval.governanceOf(child).isEmpty()) {
      wave.putIfAbsent(child, claim);
    }
  }

  private static FactAdmissionException ownershipConflict(
      final Resource child, final String earlier, final Governance claim) {
    return new FactAdmissionException(
        "Ownership conflict for %s: already %s, claimed as %s"
            .formatted(child.getURI(), earlier, claim));
  }

  private static Resource requireIri(final RDFNode node) {
    if (!node.isURIResource()) {
      throw new FactAdmissionException("Owned node " + node + " cannot be retrieved by identity");
    }
    return node.asResource();
  }

  private Model admit(final Retrieval retrieval, final Map<String, ReferenceState> referenced) {
    final Model sanitized = ModelFactory.createDefaultModel();
    final Set<String> violations = new TreeSet<>();
    for (Statement statement : retrieval.facts.listStatements().toList()) {
      try {
        if (isAdmitted(statement, retrieval, referenced)) {
          sanitized.add(statement);
        }
      } catch (FactAdmissionException violation) {
        violations.add(violation.getMessage());
      }
    }
    requireNoViolations(violations);
    return sanitized;
  }

  /** Reports every unmapped fact at once, so the mapping gap is reviewable in one failure. */
  private static void requireNoViolations(final Set<String> violations) {
    if (!violations.isEmpty()) {
      throw new FactAdmissionException(String.join("\n", violations));
    }
  }

  private boolean isAdmitted(
      final Statement statement,
      final Retrieval retrieval,
      final Map<String, ReferenceState> referenced) {
    final Governance subject = retrieval.requireGovernance(statement.getSubject());
    requireCandidateNotDeleted(statement, subject);
    final ViewField field = requireField(subject.kind(), statement.getPredicate().getURI());
    return permissions.allows(subject.owner(), field.operation())
        && isAdmittedObject(statement, retrieval, referenced);
  }

  /** Candidates were loaded as non-deleted, so RDF saying otherwise is not a fact to admit. */
  private static void requireCandidateNotDeleted(
      final Statement statement, final Governance subject) {
    final String predicate = statement.getPredicate().getURI();
    final boolean deletedInProjection =
        INVALIDATED_AT.equals(predicate)
            || (IS_DELETED.equals(predicate) && !isFalse(statement.getObject()));
    if (deletedInProjection && subject.owner().iri().equals(statement.getSubject().getURI())) {
      throw new FactAdmissionException(
          CONSISTENCY_FAILURE
              + "candidate %s is deleted in the RDF projection".formatted(subject.owner().iri()));
    }
  }

  private static boolean isFalse(final RDFNode node) {
    return node.isLiteral()
        && XSDDatatype.XSDboolean.equals(node.asLiteral().getDatatype())
        && !node.asLiteral().getBoolean();
  }

  private static ViewField requireField(final NodeKind kind, final String predicate) {
    final ViewField field = FIELD_BY_PREDICATE.get(kind).get(predicate);
    if (field == null) {
      throw new FactAdmissionException(
          "No permission mapping for predicate %s on %s".formatted(predicate, kind));
    }
    return field;
  }

  private boolean isAdmittedObject(
      final Statement statement,
      final Retrieval retrieval,
      final Map<String, ReferenceState> referenced) {
    final RDFNode object = statement.getObject();
    final String predicate = statement.getPredicate().getURI();
    if (ENTITY_OBJECT_PREDICATES.contains(predicate)) {
      requireEntityObject(predicate, object);
      return isVisible(object, retrieval, referenced);
    }
    return object.isLiteral()
        || (statement.getPredicate().equals(RDF.type)
            ? isTypeVocabulary(object)
            : isVisible(object, retrieval, referenced));
  }

  /**
   * A literal is admitted on sight once its predicate is mapped, so a containment predicate whose
   * object is a literal would carry the target past its permission check. It is a disagreement
   * between the projection and the contract, not a fact to admit.
   */
  private static void requireEntityObject(final String predicate, final RDFNode object) {
    if (!object.isURIResource() || !ENTITY_IRI.matcher(object.asResource().getURI()).matches()) {
      throw new FactAdmissionException(
          CONSISTENCY_FAILURE
              + "%s must reference an entity, but names %s".formatted(predicate, object));
    }
  }

  private static boolean isTypeVocabulary(final RDFNode type) {
    if (!type.isURIResource() || !TYPE_VOCABULARY.contains(type.asResource().getURI())) {
      throw new FactAdmissionException("Type " + type + " is not an approved vocabulary term");
    }
    return true;
  }

  private boolean isVisible(
      final RDFNode object,
      final Retrieval retrieval,
      final Map<String, ReferenceState> referenced) {
    final Optional<Governance> governance =
        retrieval.governanceOf(object).or(() -> candidateGovernance(object));
    return governance
        .map(known -> permissions.allows(known.owner(), known.kind().field.operation()))
        .orElseGet(() -> isAdmittedReference(object, referenced));
  }

  private Optional<Governance> candidateGovernance(final RDFNode object) {
    return Optional.ofNullable(
            object.isURIResource() ? catalogByIri.get(object.asResource().getURI()) : null)
        .map(resource -> new Governance(resource, kindOf(resource)));
  }

  /**
   * Non-deleted scope for a referenced catalog entity that is not a candidate. A deleted target
   * leaves the dataset together with the edges to it. A missing one means the projection disagrees
   * with the catalog. A live one is dropped only when the caller may not read it: absence from the
   * candidates is not denial, so a readable one means the candidates were incomplete.
   */
  private boolean isAdmittedReference(
      final RDFNode object, final Map<String, ReferenceState> referenced) {
    final String iri = requireCatalogEntityIri(object);
    return switch (referenced.getOrDefault(iri, new ReferenceState.Missing())) {
      case ReferenceState.Deleted deleted -> false;
      case ReferenceState.Missing missing -> throw new FactAdmissionException(
          CONSISTENCY_FAILURE + "referenced entity %s does not exist".formatted(iri));
      case ReferenceState.Live live -> requireUnreadable(live.resource());
      case ReferenceState.Inconsistent inconsistent -> throw new FactAdmissionException(
          CONSISTENCY_FAILURE + "reference %s: %s".formatted(iri, inconsistent.reason()));
    };
  }

  private static String requireCatalogEntityIri(final RDFNode object) {
    if (!object.isURIResource() || !ENTITY_IRI.matcher(object.asResource().getURI()).matches()) {
      throw new FactAdmissionException(
          "Object " + object + " is neither a catalog resource nor a retrieved owned node");
    }
    return object.asResource().getURI();
  }

  private boolean requireUnreadable(final CatalogResource resource) {
    if (permissions.allows(resource, MetadataOperation.VIEW_BASIC)) {
      throw new FactAdmissionException(
          SCOPE_ERROR + "%s is readable but not a candidate".formatted(resource.iri()));
    }
    return false;
  }

  private static NodeKind kindOf(final CatalogResource resource) {
    return switch (resource.type()) {
      case Entity.TABLE -> NodeKind.TABLE;
      case Entity.TAG -> NodeKind.TAG;
      case Entity.DOMAIN -> NodeKind.DOMAIN;
      case Entity.DATABASE_SERVICE -> NodeKind.DATABASE_SERVICE;
      case Entity.DATABASE -> NodeKind.DATABASE;
      case Entity.DATABASE_SCHEMA -> NodeKind.DATABASE_SCHEMA;
      default -> throw new FactAdmissionException("No mapping for resource " + resource.type());
    };
  }

  public interface KnowledgeSource {
    Model construct(String sparql);
  }

  public interface CallerPermissions {
    boolean allows(CatalogResource resource, MetadataOperation operation);
  }

  /**
   * The catalog's view of referenced entities that are not candidates. The result is keyed by IRI; a
   * reference it leaves out counts as missing.
   */
  public interface ReferenceStates {
    Set<String> entityTypes();

    Map<String, ReferenceState> resolve(Set<EntityIri> references);
  }

  /** A catalog entity IRI already checked for a registered type and a canonical id. */
  public record EntityIri(String iri, String type, UUID id) {}

  public sealed interface ReferenceState {
    record Live(CatalogResource resource) implements ReferenceState {}

    record Deleted() implements ReferenceState {}

    record Missing() implements ReferenceState {}

    /** The catalog answered, but in a form that does not establish the entity's deletion state. */
    record Inconsistent(String reason) implements ReferenceState {}
  }

  /** Policy attributes the catalog (not the RDF projection) holds for one resource. */
  public record CatalogResource(String type, UUID id, List<TagLabel> tags)
      implements ResourceContextInterface {
    String iri() {
      return BASE + "entity/" + type + "/" + id;
    }

    @Override
    public String getResource() {
      return type;
    }

    @Override
    public List<EntityReference> getOwners() {
      return null;
    }

    @Override
    public List<TagLabel> getTags() {
      return tags;
    }

    @Override
    public EntityInterface getEntity() {
      return null;
    }

    @Override
    public List<EntityReference> getDomains() {
      return null;
    }
  }

  public record SanitizedModel(Model model, int retrievedTriples, int retrievalQueries) {}

  private record Governance(CatalogResource owner, NodeKind kind) {}

  /** Request-local working set, bounded by the triple budget. */
  private static final class Retrieval {
    private final Model facts = ModelFactory.createDefaultModel();
    private final Map<Resource, Governance> governance = new HashMap<>();
    private final int budget;
    private int triples;
    private int queries;

    private Retrieval(final int budget) {
      this.budget = budget;
    }

    private int remaining() {
      return budget - triples;
    }

    private Model accept(final Model page) {
      queries++;
      triples += (int) Math.min(page.size(), Integer.MAX_VALUE);
      if (triples > budget) {
        throw new RetrievalBudgetExceededException(
            "Retrieval exceeded %d triples; no answer is computed from a partial model"
                .formatted(budget));
      }
      facts.add(page);
      return page;
    }

    private void govern(final Map<Resource, Governance> nodes) {
      governance.putAll(nodes);
    }

    private Optional<Governance> governanceOf(final RDFNode node) {
      return node.isResource()
          ? Optional.ofNullable(governance.get(node.asResource()))
          : Optional.empty();
    }

    private Governance requireGovernance(final Resource subject) {
      return governanceOf(subject)
          .orElseThrow(() -> new FactAdmissionException("Ungoverned subject " + subject));
    }
  }

  public static final class FactAdmissionException extends IllegalStateException {
    FactAdmissionException(final String message) {
      super(message);
    }
  }

  public static final class RetrievalBudgetExceededException extends IllegalStateException {
    RetrievalBudgetExceededException(final String message) {
      super(message);
    }
  }
}

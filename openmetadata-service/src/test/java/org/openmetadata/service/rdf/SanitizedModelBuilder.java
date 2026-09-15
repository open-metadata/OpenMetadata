package org.openmetadata.service.rdf;

import static java.util.Map.entry;
import static java.util.function.Function.identity;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toUnmodifiableMap;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
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
final class SanitizedModelBuilder {
  static final String BASE = "https://open-metadata.org/";
  static final String KNOWLEDGE = BASE + "graph/knowledge";
  private static final String OM = BASE + "ontology/";
  private static final String TYPE = RDF.type.getURI();
  private static final String LABEL = RDFS.label.getURI();
  private static final String FQN = OM + "fullyQualifiedName";
  private static final String DESCRIPTION = "http://purl.org/dc/terms/description";
  private static final String MODIFIED = "http://purl.org/dc/terms/modified";
  private static final String VERSION = "http://www.w3.org/ns/dcat#version";
  private static final int SUBJECTS_PER_QUERY = 100;
  private static final int MAX_OWNERSHIP_DEPTH = 8;

  /** View operation per field: EntityResource, TableResource and LineageResource. */
  enum ViewField {
    CORE,
    TAGS,
    COLUMNS,
    DOMAINS,
    EXTENSION,
    LINEAGE;

    MetadataOperation operation() {
      return MetadataOperation.VIEW_BASIC;
    }
  }

  enum NodeKind {
    TABLE(ViewField.CORE),
    TAG(ViewField.CORE),
    DOMAIN(ViewField.CORE),
    COLUMN(ViewField.COLUMNS),
    EXTENSION(ViewField.EXTENSION),
    EXTENSION_PROPERTY(ViewField.EXTENSION);

    private final ViewField field;

    NodeKind(final ViewField field) {
      this.field = field;
    }
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
          Map.of(TYPE, ViewField.CORE, LABEL, ViewField.CORE, FQN, ViewField.CORE),
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
          OM + "Column",
          OM + "Extension",
          OM + "ExtensionProperty",
          "http://www.w3.org/ns/dcat#Dataset",
          "http://www.w3.org/2004/02/skos/core#Concept",
          "http://www.w3.org/ns/prov#Entity");

  private final KnowledgeSource source;
  private final Map<String, CatalogResource> catalogByIri;
  private final CallerPermissions permissions;
  private final int tripleBudget;

  SanitizedModelBuilder(
      final KnowledgeSource source,
      final List<CatalogResource> catalog,
      final CallerPermissions permissions,
      final int tripleBudget) {
    this.source = source;
    this.catalogByIri =
        catalog.stream().collect(toUnmodifiableMap(CatalogResource::iri, identity()));
    this.permissions = permissions;
    this.tripleBudget = tripleBudget;
  }

  SanitizedModel build() {
    final Retrieval retrieval = new Retrieval(tripleBudget);
    Map<Resource, Governance> frontier = visibleResources();
    for (int depth = 0; !frontier.isEmpty(); depth++) {
      requireOwnershipDepth(depth);
      retrieval.govern(frontier);
      frontier = ownedChildren(fetch(List.copyOf(frontier.keySet()), retrieval), retrieval);
    }
    return new SanitizedModel(admit(retrieval), retrieval.triples, retrieval.queries);
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

  private Model admit(final Retrieval retrieval) {
    final Model sanitized = ModelFactory.createDefaultModel();
    final Set<String> violations = new TreeSet<>();
    for (Statement statement : retrieval.facts.listStatements().toList()) {
      try {
        if (isAdmitted(statement, retrieval)) {
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

  private boolean isAdmitted(final Statement statement, final Retrieval retrieval) {
    final Governance subject = retrieval.requireGovernance(statement.getSubject());
    final ViewField field = requireField(subject.kind(), statement.getPredicate().getURI());
    return permissions.allows(subject.owner(), field.operation())
        && isAdmittedObject(statement, retrieval);
  }

  private static ViewField requireField(final NodeKind kind, final String predicate) {
    final ViewField field = FIELD_BY_PREDICATE.get(kind).get(predicate);
    if (field == null) {
      throw new FactAdmissionException(
          "No permission mapping for predicate %s on %s".formatted(predicate, kind));
    }
    return field;
  }

  private boolean isAdmittedObject(final Statement statement, final Retrieval retrieval) {
    final RDFNode object = statement.getObject();
    return object.isLiteral()
        || (statement.getPredicate().equals(RDF.type)
            ? isTypeVocabulary(object)
            : isVisible(object, retrieval));
  }

  private static boolean isTypeVocabulary(final RDFNode type) {
    if (!type.isURIResource() || !TYPE_VOCABULARY.contains(type.asResource().getURI())) {
      throw new FactAdmissionException("Type " + type + " is not an approved vocabulary term");
    }
    return true;
  }

  private boolean isVisible(final RDFNode object, final Retrieval retrieval) {
    final Governance governance =
        retrieval.governanceOf(object).orElseGet(() -> catalogGovernance(object));
    return permissions.allows(governance.owner(), governance.kind().field.operation());
  }

  private Governance catalogGovernance(final RDFNode object) {
    final CatalogResource resource =
        object.isURIResource() ? catalogByIri.get(object.asResource().getURI()) : null;
    if (resource == null) {
      throw new FactAdmissionException(
          "Object " + object + " is neither a catalog resource nor a retrieved owned node");
    }
    return new Governance(resource, kindOf(resource));
  }

  private static NodeKind kindOf(final CatalogResource resource) {
    return switch (resource.type()) {
      case Entity.TABLE -> NodeKind.TABLE;
      case Entity.TAG -> NodeKind.TAG;
      case Entity.DOMAIN -> NodeKind.DOMAIN;
      default -> throw new FactAdmissionException("No mapping for resource " + resource.type());
    };
  }

  interface KnowledgeSource {
    Model construct(String sparql);
  }

  interface CallerPermissions {
    boolean allows(CatalogResource resource, MetadataOperation operation);
  }

  /** Policy attributes the catalog (not the RDF projection) holds for one resource. */
  record CatalogResource(String type, UUID id, List<TagLabel> tags)
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

  record SanitizedModel(Model model, int retrievedTriples, int retrievalQueries) {}

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

  static final class FactAdmissionException extends IllegalStateException {
    FactAdmissionException(final String message) {
      super(message);
    }
  }

  static final class RetrievalBudgetExceededException extends IllegalStateException {
    RetrievalBudgetExceededException(final String message) {
      super(message);
    }
  }
}

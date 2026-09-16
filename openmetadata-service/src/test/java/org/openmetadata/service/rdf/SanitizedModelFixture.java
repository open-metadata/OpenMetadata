package org.openmetadata.service.rdf;

import static java.util.stream.Collectors.toMap;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.rdf.SanitizedModelBuilder.CallerPermissions;
import org.openmetadata.service.rdf.SanitizedModelBuilder.CatalogResource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.EntityIri;
import org.openmetadata.service.rdf.SanitizedModelBuilder.KnowledgeSource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.ReferenceState;
import org.openmetadata.service.rdf.SanitizedModelBuilder.ReferenceStates;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.PolicyContextFixture;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

/**
 * Tables A, B, C, D with {@code A om:upstream B}, {@code B om:upstream C}, {@code A om:upstream D},
 * projected by the production translator and lineage writer. B carries the restricted tag, so the
 * caller's real policy rules hide it.
 */
final class SanitizedModelFixture {
  static final String BASE = SanitizedModelBuilder.BASE;
  static final String KNOWLEDGE = SanitizedModelBuilder.KNOWLEDGE;
  static final String RESTRICTED_TAG = "Restricted.Secret";
  static final String SHARED_TAG = "PII.Sensitive";
  static final UUID TABLE_A = UUID.fromString("a0000000-0000-4000-8000-000000000000");
  static final UUID TABLE_B = UUID.fromString("b0000000-0000-4000-8000-000000000000");
  static final UUID TABLE_C = UUID.fromString("c0000000-0000-4000-8000-000000000000");
  static final UUID TABLE_D = UUID.fromString("d0000000-0000-4000-8000-000000000000");
  static final UUID RESTRICTED_TAG_ID = UUID.fromString("e0000000-0000-4000-8000-000000000001");
  static final UUID SHARED_TAG_ID = UUID.fromString("e0000000-0000-4000-8000-000000000002");
  static final UUID DOMAIN_VISIBLE = UUID.fromString("f0000000-0000-4000-8000-000000000001");
  static final UUID DOMAIN_RESTRICTED = UUID.fromString("f0000000-0000-4000-8000-000000000002");
  static final UUID TABLE_DELETED = UUID.fromString("de000000-0000-4000-8000-000000000000");
  static final UUID TABLE_OUTSIDE_READABLE =
      UUID.fromString("0a000000-0000-4000-8000-000000000001");
  static final UUID TABLE_OUTSIDE_RESTRICTED =
      UUID.fromString("0a000000-0000-4000-8000-000000000002");

  /** Entity types the fixture's catalog registers; a reference naming any other type is invalid. */
  static final Set<String> REGISTERED_TYPES = Set.of(Entity.TABLE, Entity.TAG, Entity.DOMAIN);

  static final String HIDDEN_COLUMN_PREFIX = BASE + "entity/column/service.db.schema.secret_b.";

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final JsonLdTranslator TRANSLATOR = RdfSchemaFixture.translator();
  private static final RdfRepository LINEAGE_WRITER = lineageWriter();

  private SanitizedModelFixture() {}

  static Dataset store() {
    final Dataset store = DatasetFactory.create();
    final Model knowledge = store.getNamedModel(KNOWLEDGE);
    knowledge.add(tag(RESTRICTED_TAG_ID, RESTRICTED_TAG));
    knowledge.add(tag(SHARED_TAG_ID, SHARED_TAG));
    knowledge.add(project(Entity.TABLE, TABLE_A, withExtension(table("orders", SHARED_TAG))));
    knowledge.add(project(Entity.TABLE, TABLE_B, table("secret_b", RESTRICTED_TAG, SHARED_TAG)));
    knowledge.add(project(Entity.TABLE, TABLE_C, table("customers")));
    knowledge.add(project(Entity.TABLE, TABLE_D, table("payments")));
    addUpstream(store, TABLE_A, TABLE_B);
    addUpstream(store, TABLE_B, TABLE_C);
    addUpstream(store, TABLE_A, TABLE_D);
    return store;
  }

  static void addUpstream(final Dataset store, final UUID output, final UUID source) {
    store
        .getNamedModel(KNOWLEDGE)
        .add(LINEAGE_WRITER.buildLineageModel(Entity.TABLE, source, Entity.TABLE, output, null));
  }

  static void addLineageDetails(final Dataset store, final UUID output, final UUID source) {
    final LineageDetails details = new LineageDetails().withSqlQuery("SELECT id FROM source");
    store
        .getNamedModel(KNOWLEDGE)
        .add(LINEAGE_WRITER.buildLineageModel(Entity.TABLE, source, Entity.TABLE, output, details));
  }

  /** OpenMetadata always sets labelType and state; the mapper writes them onto the shared tag. */
  static void addTagApplicationState(final Dataset store) {
    final ObjectNode fields = table("customers");
    fields
        .putArray("tags")
        .add(tagLabel(SHARED_TAG).put("labelType", "Manual").put("state", "Confirmed"));
    store.getNamedModel(KNOWLEDGE).add(project(Entity.TABLE, TABLE_C, fields));
  }

  /**
   * Scalar attributes a GET without a fields parameter returns: on visible A and hidden B, and on a
   * visible domain and a restricted one.
   */
  static void addScalarAttributes(final Dataset store) {
    final Model knowledge = store.getNamedModel(KNOWLEDGE);
    knowledge.add(
        project(
            Entity.TABLE,
            TABLE_A,
            withScalarAttributes(withExtension(table("orders", SHARED_TAG)))));
    knowledge.add(
        project(
            Entity.TABLE,
            TABLE_B,
            withScalarAttributes(table("secret_b", RESTRICTED_TAG, SHARED_TAG))));
    knowledge.add(project(Entity.DOMAIN, DOMAIN_VISIBLE, domain("Finance")));
    knowledge.add(project(Entity.DOMAIN, DOMAIN_RESTRICTED, domain("Secret")));
  }

  /** The soft-delete flag as a non-deleted candidate carries it. */
  static void addDeletedFlag(final Dataset store) {
    final ObjectNode fields = table("customers");
    fields.put("deleted", false);
    store.getNamedModel(KNOWLEDGE).add(project(Entity.TABLE, TABLE_C, fields));
  }

  /** Soft-deleted table E keeps its projection, and {@code A om:upstream E} remains. */
  static void addDeletedUpstream(final Dataset store) {
    final ObjectNode fields = table("retired_e");
    fields.put("deleted", true);
    store.getNamedModel(KNOWLEDGE).add(project(Entity.TABLE, TABLE_DELETED, fields));
    addUpstream(store, TABLE_A, TABLE_DELETED);
  }

  /** Candidate C as projected after a soft delete that the candidate load did not see. */
  static void markCandidateDeletedInProjection(final Dataset store) {
    final ObjectNode fields = table("customers");
    fields.put("deleted", true);
    store.getNamedModel(KNOWLEDGE).add(project(Entity.TABLE, TABLE_C, fields));
  }

  static String domainIri(final UUID id) {
    return BASE + "entity/domain/" + id;
  }

  static String tableIri(final UUID id) {
    return BASE + "entity/table/" + id;
  }

  static String tagIri(final UUID id) {
    return BASE + "entity/tag/" + id;
  }

  static List<CatalogResource> catalog() {
    return List.of(
        new CatalogResource(Entity.TABLE, TABLE_A, labels(SHARED_TAG)),
        new CatalogResource(Entity.TABLE, TABLE_B, labels(RESTRICTED_TAG, SHARED_TAG)),
        new CatalogResource(Entity.TABLE, TABLE_C, List.of()),
        new CatalogResource(Entity.TABLE, TABLE_D, List.of()),
        new CatalogResource(Entity.TAG, RESTRICTED_TAG_ID, List.of()),
        new CatalogResource(Entity.TAG, SHARED_TAG_ID, List.of()));
  }

  /** The catalog plus both domains; the restricted domain carries the restricted tag. */
  static List<CatalogResource> catalogWithDomains() {
    return Stream.concat(
            catalog().stream(),
            Stream.of(
                new CatalogResource(Entity.DOMAIN, DOMAIN_VISIBLE, List.of()),
                new CatalogResource(Entity.DOMAIN, DOMAIN_RESTRICTED, labels(RESTRICTED_TAG))))
        .toList();
  }

  /**
   * Catalog state of entities outside the candidates: E is soft-deleted, one live table is
   * readable, one carries the restricted tag. Anything else is unknown, so the builder treats it as
   * missing.
   */
  static ReferenceStates references() {
    final Map<String, ReferenceState> known =
        Map.of(
            tableIri(TABLE_DELETED),
            new ReferenceState.Deleted(),
            tableIri(TABLE_OUTSIDE_READABLE),
            new ReferenceState.Live(
                new CatalogResource(Entity.TABLE, TABLE_OUTSIDE_READABLE, List.of())),
            tableIri(TABLE_OUTSIDE_RESTRICTED),
            new ReferenceState.Live(
                new CatalogResource(
                    Entity.TABLE, TABLE_OUTSIDE_RESTRICTED, labels(RESTRICTED_TAG))));
    return referenceStates(
        references ->
            references.stream()
                .filter(reference -> known.containsKey(reference.iri()))
                .collect(toMap(EntityIri::iri, reference -> known.get(reference.iri()))));
  }

  static ReferenceStates referenceStates(
      final Function<Set<EntityIri>, Map<String, ReferenceState>> resolver) {
    return new FixtureReferences(REGISTERED_TYPES, resolver);
  }

  private record FixtureReferences(
      Set<String> entityTypes, Function<Set<EntityIri>, Map<String, ReferenceState>> resolver)
      implements ReferenceStates {
    @Override
    public Map<String, ReferenceState> resolve(final Set<EntityIri> references) {
      return resolver.apply(references);
    }
  }

  static KnowledgeSource local(final Dataset store) {
    return sparql -> {
      try (QueryExecution execution = QueryExecution.dataset(store).query(sparql).build()) {
        return execution.execConstruct();
      }
    };
  }

  /** Data-consumer style grant plus a tag-conditioned deny, evaluated by OpenMetadata's engine. */
  static CallerPermissions restrictedTablesHidden() {
    return evaluatedBy(List.of(allowViewAll(), denyRestrictedTables()));
  }

  static CallerPermissions restrictedTablesAndTagsHidden() {
    return evaluatedBy(List.of(allowViewAll(), denyRestrictedTables(), denyTags()));
  }

  static CallerPermissions restrictedTablesAndDomainsHidden() {
    return evaluatedBy(List.of(allowViewAll(), denyRestrictedTables(), denyRestrictedDomains()));
  }

  private static CallerPermissions evaluatedBy(final List<Rule> rules) {
    final List<PolicyContext> policies = List.of(PolicyContextFixture.policy("Caller", rules));
    final SubjectContext caller = mock(SubjectContext.class);
    when(caller.user()).thenReturn(new User().withName("caller"));
    when(caller.getPolicies(any())).thenAnswer(invocation -> policies.iterator());
    return (resource, operation) -> isPermitted(caller, resource, operation);
  }

  private static boolean isPermitted(
      final SubjectContext caller,
      final CatalogResource resource,
      final MetadataOperation operation) {
    try {
      PolicyEvaluator.hasPermission(
          caller, resource, new OperationContext(resource.type(), operation));
      return true;
    } catch (AuthorizationException denied) {
      return false;
    }
  }

  private static Rule allowViewAll() {
    return new Rule()
        .withName("ViewAll")
        .withResources(List.of(Entity.ALL_RESOURCES))
        .withOperations(List.of(MetadataOperation.VIEW_ALL))
        .withEffect(Rule.Effect.ALLOW);
  }

  private static Rule denyRestrictedTables() {
    return new Rule()
        .withName("HideRestrictedTables")
        .withResources(List.of(Entity.TABLE))
        .withOperations(List.of(MetadataOperation.VIEW_ALL))
        .withEffect(Rule.Effect.DENY)
        .withCondition("matchAnyTag('" + RESTRICTED_TAG + "')");
  }

  private static Rule denyRestrictedDomains() {
    return new Rule()
        .withName("HideRestrictedDomains")
        .withResources(List.of(Entity.DOMAIN))
        .withOperations(List.of(MetadataOperation.VIEW_ALL))
        .withEffect(Rule.Effect.DENY)
        .withCondition("matchAnyTag('" + RESTRICTED_TAG + "')");
  }

  private static Rule denyTags() {
    return new Rule()
        .withName("HideTags")
        .withResources(List.of(Entity.TAG))
        .withOperations(List.of(MetadataOperation.VIEW_ALL))
        .withEffect(Rule.Effect.DENY);
  }

  private static List<TagLabel> labels(final String... fqns) {
    return List.of(fqns).stream()
        .map(fqn -> new TagLabel().withTagFQN(fqn).withSource(TagLabel.TagSource.CLASSIFICATION))
        .toList();
  }

  private static Model tag(final UUID id, final String fqn) {
    final ObjectNode fields = JSON.createObjectNode();
    fields.put("name", fqn.substring(fqn.indexOf('.') + 1));
    fields.put("fullyQualifiedName", fqn);
    fields.put("description", "Tag " + fqn);
    return project(Entity.TAG, id, fields);
  }

  private static ObjectNode table(final String name, final String... tagFqns) {
    final String fqn = "service.db.schema." + name;
    final ObjectNode fields = JSON.createObjectNode();
    fields.put("name", name);
    fields.put("fullyQualifiedName", fqn);
    final ObjectNode column = fields.putArray("columns").addObject();
    column.put("name", "id").put("fullyQualifiedName", fqn + ".id").put("dataType", "BIGINT");
    for (String tagFqn : tagFqns) {
      fields.withArray("tags").add(tagLabel(tagFqn));
    }
    return fields;
  }

  private static ObjectNode withScalarAttributes(final ObjectNode fields) {
    fields.put("serviceType", "Postgres");
    fields.put("entityStatus", "Approved");
    fields.put("processedLineage", true);
    fields.put("version", 0.1);
    fields.put("updatedAt", 1000L);
    return fields;
  }

  private static ObjectNode domain(final String name) {
    final ObjectNode fields = JSON.createObjectNode();
    fields.put("name", name);
    fields.put("fullyQualifiedName", name);
    fields.put("description", "Domain " + name);
    fields.put("domainType", "Aggregate");
    fields.put("entityStatus", "Approved");
    fields.put("version", 0.1);
    fields.put("updatedAt", 1000L);
    return fields;
  }

  private static ObjectNode withExtension(final ObjectNode fields) {
    fields.putObject("extension").put("costCenter", "finance");
    return fields;
  }

  private static ObjectNode tagLabel(final String fqn) {
    final UUID id = RESTRICTED_TAG.equals(fqn) ? RESTRICTED_TAG_ID : SHARED_TAG_ID;
    final ObjectNode label = JSON.createObjectNode();
    label.put("tagFQN", fqn).put("source", "Classification");
    label.put("name", fqn.substring(fqn.indexOf('.') + 1));
    label.put("href", BASE + "api/v1/tags/" + id);
    return label;
  }

  private static Model project(final String type, final UUID id, final ObjectNode fields) {
    fields.put("id", id.toString());
    final RdfSchemaFixture.FixtureEntity entity = new RdfSchemaFixture.FixtureEntity(type, fields);
    entity.setId(id);
    entity.setName(fields.get("name").asText());
    entity.setFullyQualifiedName(fields.get("fullyQualifiedName").asText());
    entity.setDeleted(fields.path("deleted").asBoolean(false));
    return TRANSLATOR.toRdf(entity);
  }

  private static RdfRepository lineageWriter() {
    final CollectionDAO.RelationshipTypeDAO types = mock(CollectionDAO.RelationshipTypeDAO.class);
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
        mock(RdfStorageInterface.class),
        null,
        () -> new RelationshipTypeResolver(types));
  }
}

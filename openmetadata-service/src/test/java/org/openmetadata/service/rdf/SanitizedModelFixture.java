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
import org.openmetadata.schema.type.Relationship;
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
  static final UUID SERVICE_ID = UUID.fromString("5e000000-0000-4000-8000-000000000001");
  static final UUID DATABASE_ID = UUID.fromString("5e000000-0000-4000-8000-000000000002");
  static final UUID SCHEMA_VISIBLE = UUID.fromString("5e000000-0000-4000-8000-000000000003");
  static final UUID SCHEMA_RESTRICTED = UUID.fromString("5e000000-0000-4000-8000-000000000004");
  static final UUID TABLE_IN_RESTRICTED_SCHEMA =
      UUID.fromString("5e000000-0000-4000-8000-000000000005");

  private static final UUID PIPELINE_ID = UUID.fromString("5e000000-0000-4000-8000-000000000006");

  /** Entity types the fixture's catalog registers; a reference naming any other type is invalid. */
  static final Set<String> REGISTERED_TYPES =
      Set.of(
          Entity.TABLE,
          Entity.TAG,
          Entity.DOMAIN,
          Entity.DATABASE_SERVICE,
          Entity.DATABASE,
          Entity.DATABASE_SCHEMA);

  static final String HIDDEN_COLUMN_PREFIX = BASE + "entity/column/service.db.schema.secret_b.";

  private static final String SERVICE_NAME = "service";
  private static final String DATABASE_NAME = "db";
  private static final String SCHEMA_NAME = "schema";
  private static final String RESTRICTED_SCHEMA_NAME = "vault";
  private static final String SERVICE_TYPE = "Postgres";

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

  /**
   * The containers around the tables: one service, one database and two schemas, one of which the
   * caller may not read. A and hidden B sit in the readable schema; a readable table sits in the
   * unreadable one. The container facts this slice keeps rejecting are added by the overlays below,
   * so the admitted case can be exercised on its own — this projection is deliberately partial.
   */
  static void addContainers(final Dataset store) {
    final Model knowledge = store.getNamedModel(KNOWLEDGE);
    knowledge.add(project(Entity.DATABASE_SERVICE, SERVICE_ID, service()));
    knowledge.add(project(Entity.DATABASE, DATABASE_ID, database()));
    knowledge.add(project(Entity.DATABASE_SCHEMA, SCHEMA_VISIBLE, schema(SCHEMA_NAME)));
    knowledge.add(
        project(
            Entity.DATABASE_SCHEMA,
            SCHEMA_RESTRICTED,
            schema(RESTRICTED_SCHEMA_NAME, RESTRICTED_TAG)));
    knowledge.add(
        project(
            Entity.TABLE,
            TABLE_A,
            contained(withExtension(table("orders", SHARED_TAG)), SCHEMA_VISIBLE, SCHEMA_NAME)));
    knowledge.add(
        project(
            Entity.TABLE,
            TABLE_B,
            contained(table("secret_b", RESTRICTED_TAG, SHARED_TAG), SCHEMA_VISIBLE, SCHEMA_NAME)));
    knowledge.add(
        project(
            Entity.TABLE,
            TABLE_IN_RESTRICTED_SCHEMA,
            contained(
                tableIn(RESTRICTED_SCHEMA_NAME, "keys"),
                SCHEMA_RESTRICTED,
                RESTRICTED_SCHEMA_NAME)));
    addContains(store, Entity.DATABASE, DATABASE_ID, Entity.DATABASE_SCHEMA, SCHEMA_VISIBLE);
    addContains(store, Entity.DATABASE, DATABASE_ID, Entity.DATABASE_SCHEMA, SCHEMA_RESTRICTED);
    addContains(store, Entity.DATABASE_SCHEMA, SCHEMA_VISIBLE, Entity.TABLE, TABLE_A);
    addContains(store, Entity.DATABASE_SCHEMA, SCHEMA_VISIBLE, Entity.TABLE, TABLE_B);
    addContains(
        store, Entity.DATABASE_SCHEMA, SCHEMA_RESTRICTED, Entity.TABLE, TABLE_IN_RESTRICTED_SCHEMA);
  }

  /** The child list a container also projects as one opaque literal, hidden children included. */
  static void addChildMembershipLists(final Dataset store) {
    final ObjectNode schema = schema(SCHEMA_NAME);
    schema
        .putArray("tables")
        .add(reference(Entity.TABLE, TABLE_B, "secret_b", schemaFqn(SCHEMA_NAME) + ".secret_b"));
    final ObjectNode database = database();
    database
        .putArray("databaseSchemas")
        .add(
            reference(
                Entity.DATABASE_SCHEMA,
                SCHEMA_RESTRICTED,
                RESTRICTED_SCHEMA_NAME,
                schemaFqn(RESTRICTED_SCHEMA_NAME)));
    final Model knowledge = store.getNamedModel(KNOWLEDGE);
    knowledge.add(project(Entity.DATABASE_SCHEMA, SCHEMA_VISIBLE, schema));
    knowledge.add(project(Entity.DATABASE, DATABASE_ID, database));
  }

  /** The stored connection config, which REST masks for every non-bot caller. */
  static void addServiceConnection(final Dataset store) {
    final ObjectNode service = service();
    service
        .putObject("connection")
        .putObject("config")
        .put("hostPort", "db.internal:5432")
        .put("username", "ingestion");
    projectService(store, service);
  }

  /** The last connection test, which can carry host names and failure detail. */
  static void addServiceTestConnectionResult(final Dataset store) {
    final ObjectNode service = service();
    service
        .putObject("testConnectionResult")
        .put("status", "Failed")
        .putArray("steps")
        .addObject()
        .put("name", "CheckAccess")
        .put("message", "could not connect to db.internal:5432 as ingestion");
    projectService(store, service);
  }

  /** The ingestion pipelines of a service, projected as one opaque literal. */
  static void addServicePipelines(final Dataset store) {
    final ObjectNode service = service();
    service
        .putArray("pipelines")
        .add(
            reference(
                Entity.INGESTION_PIPELINE, PIPELINE_ID, "metadata", SERVICE_NAME + ".metadata"));
    projectService(store, service);
  }

  private static void projectService(final Dataset store, final ObjectNode service) {
    store.getNamedModel(KNOWLEDGE).add(project(Entity.DATABASE_SERVICE, SERVICE_ID, service));
  }

  /** A service has no field of its own governing which databases it contains. */
  static void addServiceMembership(final Dataset store) {
    addContains(store, Entity.DATABASE_SERVICE, SERVICE_ID, Entity.DATABASE, DATABASE_ID);
  }

  /** A container field a GET has to ask for by name, which no reviewed mapping covers. */
  static void addSchemaProfilerConfig(final Dataset store) {
    final ObjectNode schema = schema(SCHEMA_NAME);
    schema.putObject("databaseSchemaProfilerConfig").put("profileSample", 50);
    store.getNamedModel(KNOWLEDGE).add(project(Entity.DATABASE_SCHEMA, SCHEMA_VISIBLE, schema));
  }

  /** The containment edge the relationship hook writes from the parent, with its own predicate. */
  static void addContains(
      final Dataset store,
      final String fromType,
      final UUID fromId,
      final String toType,
      final UUID toId) {
    final Model knowledge = store.getNamedModel(KNOWLEDGE);
    knowledge.add(
        knowledge.createResource(entityIri(fromType, fromId)),
        knowledge.createProperty(
            RdfRepository.getRelationshipPredicateUri(Relationship.CONTAINS.value())),
        knowledge.createResource(entityIri(toType, toId)));
  }

  /** Candidate C as projected after a soft delete that the candidate load did not see. */
  static void markCandidateDeletedInProjection(final Dataset store) {
    final ObjectNode fields = table("customers");
    fields.put("deleted", true);
    store.getNamedModel(KNOWLEDGE).add(project(Entity.TABLE, TABLE_C, fields));
  }

  static String entityIri(final String type, final UUID id) {
    return BASE + "entity/" + type + "/" + id;
  }

  static String domainIri(final UUID id) {
    return entityIri(Entity.DOMAIN, id);
  }

  static String tableIri(final UUID id) {
    return entityIri(Entity.TABLE, id);
  }

  static String tagIri(final UUID id) {
    return entityIri(Entity.TAG, id);
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

  /** The catalog plus the containers; the restricted schema carries the restricted tag. */
  static List<CatalogResource> catalogWithContainers() {
    return Stream.concat(
            catalog().stream(),
            Stream.of(
                new CatalogResource(Entity.DATABASE_SERVICE, SERVICE_ID, List.of()),
                new CatalogResource(Entity.DATABASE, DATABASE_ID, List.of()),
                new CatalogResource(Entity.DATABASE_SCHEMA, SCHEMA_VISIBLE, List.of()),
                new CatalogResource(
                    Entity.DATABASE_SCHEMA, SCHEMA_RESTRICTED, labels(RESTRICTED_TAG)),
                new CatalogResource(Entity.TABLE, TABLE_IN_RESTRICTED_SCHEMA, List.of())))
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
    return evaluatedBy(List.of(allowViewAll(), denyRestricted(Entity.TABLE)));
  }

  static CallerPermissions restrictedTablesAndTagsHidden() {
    return evaluatedBy(List.of(allowViewAll(), denyRestricted(Entity.TABLE), denyTags()));
  }

  static CallerPermissions restrictedTablesAndDomainsHidden() {
    return evaluatedBy(
        List.of(allowViewAll(), denyRestricted(Entity.TABLE), denyRestricted(Entity.DOMAIN)));
  }

  static CallerPermissions restrictedTablesAndSchemasHidden() {
    return evaluatedBy(
        List.of(
            allowViewAll(), denyRestricted(Entity.TABLE), denyRestricted(Entity.DATABASE_SCHEMA)));
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

  private static Rule denyRestricted(final String resource) {
    return new Rule()
        .withName("HideRestricted-" + resource)
        .withResources(List.of(resource))
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
    return tableIn(SCHEMA_NAME, name, tagFqns);
  }

  private static ObjectNode tableIn(
      final String schemaName, final String name, final String... tagFqns) {
    final String fqn = schemaFqn(schemaName) + "." + name;
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

  private static String databaseFqn() {
    return SERVICE_NAME + "." + DATABASE_NAME;
  }

  private static String schemaFqn(final String schemaName) {
    return databaseFqn() + "." + schemaName;
  }

  private static ObjectNode service() {
    final ObjectNode fields = container(SERVICE_NAME, SERVICE_NAME);
    fields.put("serviceType", SERVICE_TYPE);
    return fields;
  }

  private static ObjectNode database() {
    final ObjectNode fields = container(DATABASE_NAME, databaseFqn());
    fields.put("serviceType", SERVICE_TYPE);
    fields.set("service", serviceReference());
    return fields;
  }

  private static ObjectNode schema(final String name, final String... tagFqns) {
    final ObjectNode fields = container(name, schemaFqn(name));
    fields.put("serviceType", SERVICE_TYPE);
    fields.set("service", serviceReference());
    fields.set("database", reference(Entity.DATABASE, DATABASE_ID, DATABASE_NAME, databaseFqn()));
    for (String tagFqn : tagFqns) {
      fields.withArray("tags").add(tagLabel(tagFqn));
    }
    return fields;
  }

  /** The scalar attributes a container returns from a GET without a fields parameter. */
  private static ObjectNode container(final String name, final String fullyQualifiedName) {
    final ObjectNode fields = JSON.createObjectNode();
    fields.put("name", name);
    fields.put("fullyQualifiedName", fullyQualifiedName);
    fields.put("description", "Container " + name);
    fields.put("entityStatus", "Approved");
    fields.put("deleted", false);
    fields.put("version", 0.1);
    fields.put("updatedAt", 1000L);
    return fields;
  }

  /** The container references a table returns from a GET without a fields parameter. */
  private static ObjectNode contained(
      final ObjectNode fields, final UUID schemaId, final String schemaName) {
    fields.set("service", serviceReference());
    fields.set("database", reference(Entity.DATABASE, DATABASE_ID, DATABASE_NAME, databaseFqn()));
    fields.set(
        "databaseSchema",
        reference(Entity.DATABASE_SCHEMA, schemaId, schemaName, schemaFqn(schemaName)));
    return fields;
  }

  private static ObjectNode serviceReference() {
    return reference(Entity.DATABASE_SERVICE, SERVICE_ID, SERVICE_NAME, SERVICE_NAME);
  }

  private static ObjectNode reference(
      final String type, final UUID id, final String name, final String fullyQualifiedName) {
    final ObjectNode reference = JSON.createObjectNode();
    reference.put("id", id.toString());
    reference.put("type", type);
    reference.put("name", name);
    reference.put("fullyQualifiedName", fullyQualifiedName);
    return reference;
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

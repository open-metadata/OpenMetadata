package org.openmetadata.service.rdf;

import static java.util.stream.Collectors.toUnmodifiableSet;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.sparql.exec.http.QueryExecutionHTTP;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.SanitizedModelBuilder.CallerPermissions;
import org.openmetadata.service.rdf.SanitizedModelBuilder.CatalogResource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.FactAdmissionException;
import org.openmetadata.service.rdf.SanitizedModelBuilder.KnowledgeSource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.SanitizedModel;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.CatalogPrincipal;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Candidate L against OpenMetadata's own read authorization on real catalog resources: a user with
 * the built-in {@code DomainOnlyAccessRole} may read tables in their domain only.
 *
 * <p>Authorization and model building are separate tests. The first compares the user's REST reads
 * with in-process decisions made the way a REST GET makes them, inside one simulated request per
 * phase, across domain and role changes. The second is a fail-closed regression: it proves that
 * live facts without a reviewed permission mapping reject the build, not that a model can be built.
 *
 * <p>Decisions and timings are appended to {@code target/rdf-authorization-diagnostics.jsonl}. They
 * are diagnostics for this fixture, not latency evidence.
 *
 * <p>The generic integration profiles include every IT but start no Fuseki, so the class runs only
 * with {@code enableRdf=true}. A class-level condition is used because Failsafe reports it as
 * skipped tests, whereas an aborted {@code @BeforeAll} assumption is reported as no tests at all.
 */
@EnabledIfSystemProperty(
    named = "enableRdf",
    matches = "true",
    disabledReason = "RDF is disabled for this run; use the postgres-rdf-tests profile")
@ExtendWith(TestNamespaceExtension.class)
class RdfAuthorizationAlignmentIT {
  private static final String DOMAIN_ONLY_ACCESS_ROLE = "DomainOnlyAccessRole";
  private static final String OM = "https://open-metadata.org/ontology/";
  private static final String NO_REQUESTED_FIELDS = "";
  private static final String NO_INCLUDE_RELATIONS_PARAM = null;

  /** UserRepository computes inheritedRoles only when roles are requested in the same read. */
  private static final String CALLER_ROLE_FIELDS = "roles,inheritedRoles";

  private static final int TRIPLE_BUDGET = 20_000;
  private static final long REQUEST_TIMEOUT_SECONDS = 30;
  private static final long SIMULATED_REQUEST_TIMEOUT_SECONDS = 120;
  private static final Duration PROJECTION_TIMEOUT = Duration.ofSeconds(90);
  private static final Path DIAGNOSTICS = Path.of("target", "rdf-authorization-diagnostics.jsonl");
  private static final String UNMAPPED_PREDICATE = "No permission mapping for predicate ";
  private static final String UNAPPROVED_TYPE = " is not an approved vocabulary term";

  /**
   * Deferred facts that must keep rejecting the build until reviewed: domain membership and domain
   * lineage reference other assets, container links reference other entities, and the soft-delete
   * flag depends on undecided include semantics.
   */
  private static final Set<String> DEFERRED_FACT_VIOLATIONS =
      Set.of(
          UNMAPPED_PREDICATE + OM + "has on DOMAIN",
          UNMAPPED_PREDICATE + OM + "upstream on DOMAIN",
          UNMAPPED_PREDICATE + OM + "belongsToSchema on TABLE",
          UNMAPPED_PREDICATE + OM + "isDeleted on TABLE");

  /** Scalar attributes and types the builder now maps; live facts using them must be admitted. */
  private static final Set<String> MAPPED_SCALAR_TERMS =
      Set.of(
          "http://purl.org/dc/terms/description",
          "http://purl.org/dc/terms/modified",
          "http://purl.org/dc/terms/hasVersion",
          "http://www.w3.org/ns/dcat#version",
          OM + "hasServiceType",
          OM + "entityStatus",
          OM + "processedLineage",
          OM + "domainType",
          OM + "Domain",
          "http://www.w3.org/2004/02/skos/core#Collection");

  private final Authorizer authorizer = new DefaultAuthorizer();

  @Test
  void authorizationFollowsDomainAndRoleChanges(final TestNamespace namespace) {
    final Fixture fixture = createFixture(namespace);
    final Role domainOnly = fixture.caller().domainOnlyRole();
    final Role tableDeny = createTableDenyRole(SdkClients.adminClient(), namespace);
    final Set<Table> withoutB = Set.of(fixture.a(), fixture.c(), fixture.d());
    final Set<Table> allTables = Set.copyOf(fixture.tables());
    assertAll(
        () -> verifyAfterRoles(fixture, "initial", withoutB, domainOnly),
        () ->
            verifyAfterDomainMove(fixture, "b-visible-domain", fixture.visibleDomain(), allTables),
        () -> verifyAfterDomainMove(fixture, "b-hidden-again", fixture.hiddenDomain(), withoutB),
        () -> verifyAfterRoles(fixture, "explicit-deny-assigned", Set.of(), domainOnly, tableDeny),
        () -> verifyAfterRoles(fixture, "explicit-deny-removed", withoutB, domainOnly),
        () -> verifyAfterRoles(fixture, "domain-deny-role-removed", allTables));
  }

  /**
   * Fail-closed regression, not model construction: API-created tables and domains project facts the
   * builder has no reviewed permission mapping for, so building the model inside one request must be
   * rejected as a whole, with every gap reported and no ownership or retrieval error hiding them.
   * This proves unsupported live facts are rejected; it does not show that a sanitized model can be
   * built from live projections.
   */
  @Test
  void sanitizedModelBuildRejectsUnmappedLiveFacts(final TestNamespace namespace) {
    final Fixture fixture = createFixture(namespace);
    awaitProjectedFacts(fixture);
    final FactAdmissionException rejection =
        assertThrows(FactAdmissionException.class, () -> inFreshRequest(() -> buildModel(fixture)));
    final Set<String> violations = Set.copyOf(rejection.getMessage().lines().toList());
    assertAll(
        () ->
            assertTrue(
                violations.containsAll(DEFERRED_FACT_VIOLATIONS),
                "deferred facts must be rejected: " + violations),
        () ->
            assertTrue(
                violations.stream().noneMatch(RdfAuthorizationAlignmentIT::namesMappedScalarTerm),
                "mapped scalar attributes must be admitted: " + violations),
        () ->
            assertTrue(
                violations.stream().allMatch(RdfAuthorizationAlignmentIT::isMappingGap),
                "every violation must be a mapping gap: " + violations));
  }

  private static boolean namesMappedScalarTerm(final String violation) {
    return MAPPED_SCALAR_TERMS.stream()
        .anyMatch(
            term ->
                violation.startsWith(UNMAPPED_PREDICATE + term + " on ")
                    || violation.equals("Type " + term + UNAPPROVED_TYPE));
  }

  private static boolean isMappingGap(final String violation) {
    return violation.startsWith(UNMAPPED_PREDICATE) || violation.endsWith(UNAPPROVED_TYPE);
  }

  /** Live projection is asynchronous, so wait for every fact the asserted violations depend on. */
  private static void awaitProjectedFacts(final Fixture fixture) {
    final String visibleDomain = domainIri(fixture.visibleDomain());
    awaitProjection("<%s> a <%sDomain>".formatted(visibleDomain, OM));
    awaitProjection("<%s> <%shas> ?asset".formatted(visibleDomain, OM));
    awaitProjection("<%s> <%supstream> ?domain".formatted(visibleDomain, OM));
    awaitProjection("<%s> <%sbelongsToSchema> ?schema".formatted(tableIri(fixture.a()), OM));
    awaitProjection(
        "<%s> <%supstream> <%s>".formatted(tableIri(fixture.a()), OM, tableIri(fixture.d())));
  }

  private void verifyAfterDomainMove(
      final Fixture fixture, final String phase, final Domain domain, final Set<Table> visible) {
    setDomain(fixture.b(), domain);
    verifyDecisions(fixture, phase, visible);
  }

  private void verifyAfterRoles(
      final Fixture fixture, final String phase, final Set<Table> visible, final Role... roles) {
    assignRoles(fixture, roles);
    verifyDecisions(fixture, phase, visible);
  }

  private void verifyDecisions(
      final Fixture fixture, final String phase, final Set<Table> visible) {
    final Map<String, Boolean> expected = fixture.decisions(visible::contains);
    final Map<String, Boolean> rest =
        timed(phase, "rest", () -> fixture.decisions(table -> restCanView(fixture, table)));
    final Map<String, Boolean> freshRequest =
        timed(
            phase,
            "fresh-request",
            () ->
                inFreshRequest(() -> fixture.decisions(table -> canViewAsRestGet(fixture, table))));
    recordDecisionDiagnostics(fixture, phase, Map.of("expected", expected, "rest", rest));
    assertEquals(expected, rest, phase + ": REST decisions");
    assertEquals(rest, freshRequest, phase + ": fresh-request decisions must match REST");
  }

  /**
   * Diagnostic only, never asserted: the same checks on the long-lived JUnit thread, whose
   * request-scoped entity cache no request filter resets between phases, and with the cache-backed
   * context shape the first run used.
   */
  private void recordDecisionDiagnostics(
      final Fixture fixture,
      final String phase,
      final Map<String, Map<String, Boolean>> reference) {
    final Map<String, Object> cells = new LinkedHashMap<>(reference);
    cells.put(
        "freshRequestRestShaped",
        inFreshRequest(() -> fixture.decisions(table -> canViewAsRestGet(fixture, table))));
    cells.put(
        "freshRequestCacheShaped",
        inFreshRequest(() -> fixture.decisions(table -> canViewCacheShaped(fixture, table))));
    cells.put(
        "reusedThreadRestShaped", fixture.decisions(table -> canViewAsRestGet(fixture, table)));
    cells.put(
        "reusedThreadCacheShaped", fixture.decisions(table -> canViewCacheShaped(fixture, table)));
    record(phase, "decisions", cells);
  }

  private boolean restCanView(final Fixture fixture, final Table table) {
    boolean viewable = true;
    try {
      fixture.userClient().tables().get(table.getId().toString());
    } catch (ForbiddenException denied) {
      viewable = false;
    }
    return viewable;
  }

  private boolean canViewAsRestGet(final Fixture fixture, final Table table) {
    return isPermittedAsRestGet(
        fixture.securityContext(), Entity.TABLE, table.getId(), MetadataOperation.VIEW_BASIC);
  }

  /** Shaped like {@code EntityResource.getInternal} serving an SDK get without a fields parameter. */
  private boolean isPermittedAsRestGet(
      final SecurityContext caller,
      final String type,
      final UUID id,
      final MetadataOperation operation) {
    final Fields fields = Entity.getEntityRepository(type).getFields(NO_REQUESTED_FIELDS);
    final RelationIncludes relationIncludes =
        new RelationIncludes(Include.NON_DELETED, NO_INCLUDE_RELATIONS_PARAM);
    return isPermitted(
        caller,
        new OperationContext(type, operation),
        new ResourceContext<>(type, id, null, Include.NON_DELETED, fields, relationIncludes));
  }

  /** The context the first run used: no requested fields, so the entity may load from caches. */
  private boolean canViewCacheShaped(final Fixture fixture, final Table table) {
    return isPermitted(
        fixture.securityContext(),
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(Entity.TABLE, table.getId(), null));
  }

  private boolean isPermitted(
      final SecurityContext caller,
      final OperationContext operation,
      final ResourceContextInterface resource) {
    boolean permitted = true;
    try {
      authorizer.authorize(caller, operation, resource);
    } catch (AuthorizationException denied) {
      permitted = false;
    }
    return permitted;
  }

  /**
   * Runs one simulated API request on a new thread, so request-scoped thread-local state starts
   * empty as it does behind OpenMetadata's request filters, without invalidating any cache.
   */
  private static <T> T inFreshRequest(final Supplier<T> request) {
    final Callable<T> task = request::get;
    final ExecutorService requestThread = Executors.newSingleThreadExecutor();
    try {
      return requestThread.submit(task).get(SIMULATED_REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
    } catch (ExecutionException failure) {
      throw rethrowable(failure.getCause());
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted during a simulated request", interrupted);
    } catch (TimeoutException timeout) {
      throw new IllegalStateException(
          "Simulated request exceeded " + SIMULATED_REQUEST_TIMEOUT_SECONDS + " s", timeout);
    } finally {
      requestThread.shutdownNow();
    }
  }

  private static RuntimeException rethrowable(final Throwable cause) {
    if (cause instanceof Error error) {
      throw error;
    }
    return cause instanceof RuntimeException runtime ? runtime : new IllegalStateException(cause);
  }

  private SanitizedModel buildModel(final Fixture fixture) {
    final CallerPermissions permissions =
        (resource, operation) ->
            isPermittedAsRestGet(
                fixture.securityContext(), resource.type(), resource.id(), operation);
    return new SanitizedModelBuilder(suiteFuseki(), fixture.catalog(), permissions, TRIPLE_BUDGET)
        .build();
  }

  private static KnowledgeSource suiteFuseki() {
    final String endpoint = TestSuiteBootstrap.getFusekiQueryEndpoint();
    return sparql -> {
      try (QueryExecution execution =
          QueryExecutionHTTP.service(endpoint)
              .query(sparql)
              .timeout(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
              .build()) {
        return execution.execConstruct();
      }
    };
  }

  private static void awaitProjection(final String triplePattern) {
    final String ask =
        "ASK { GRAPH <%s> { %s } }".formatted(SanitizedModelBuilder.KNOWLEDGE, triplePattern);
    Awaitility.await("RDF projection of " + triplePattern)
        .atMost(PROJECTION_TIMEOUT)
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> askRemote(ask));
  }

  private static boolean askRemote(final String ask) {
    try (QueryExecution execution =
        QueryExecutionHTTP.service(TestSuiteBootstrap.getFusekiQueryEndpoint())
            .query(ask)
            .timeout(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()) {
      return execution.execAsk();
    }
  }

  private static void setDomain(final Table table, final Domain domain) {
    final ArrayNode patch = JsonUtils.getObjectMapper().createArrayNode();
    patch
        .addObject()
        .put("op", "replace")
        .put("path", "/domains")
        .set("value", JsonUtils.valueToTree(List.of(domain.getEntityReference())));
    SdkClients.adminClient().tables().patch(table.getId(), patch);
  }

  private static void assignRoles(final Fixture fixture, final Role... roles) {
    final List<EntityReference> references =
        Arrays.stream(roles).map(Role::getEntityReference).toList();
    final ArrayNode patch = JsonUtils.getObjectMapper().createArrayNode();
    patch
        .addObject()
        .put("op", "replace")
        .put("path", "/roles")
        .set("value", JsonUtils.valueToTree(references));
    SdkClients.adminClient().users().patch(fixture.user().getId(), patch);
    requireCallerRoles(fixture, references);
  }

  /**
   * A decision change is attributable to the assigned roles only while the caller has no admin
   * bypass and inherits the same roles as when the fixture was created.
   */
  private static void requireCallerRoles(
      final Fixture fixture, final List<EntityReference> assigned) {
    final User current =
        SdkClients.adminClient().users().get(fixture.user().getId().toString(), CALLER_ROLE_FIELDS);
    assertFalse(Boolean.TRUE.equals(current.getIsAdmin()), "the caller must not be an admin");
    assertEquals(roleIds(assigned), roleIds(current.getRoles()), "assigned roles");
    assertEquals(
        fixture.caller().inheritedRoleIds(),
        roleIds(current.getInheritedRoles()),
        "inherited roles");
  }

  private static Set<UUID> roleIds(final List<EntityReference> roles) {
    return listOrEmpty(roles).stream().map(EntityReference::getId).collect(toUnmodifiableSet());
  }

  /** An unconditional deny overrides every allow, so no other role can mask the revocation. */
  private static Role createTableDenyRole(
      final OpenMetadataClient admin, final TestNamespace namespace) {
    final Rule denyTables =
        new Rule()
            .withName("denyAllTableOperations")
            .withDescription("Revokes table access for the RDF authorization fixture")
            .withEffect(Rule.Effect.DENY)
            .withOperations(List.of(MetadataOperation.ALL))
            .withResources(List.of(Entity.TABLE));
    final Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(namespace.prefix("tableDenyPolicy"))
                    .withDescription("RDF authorization revocation fixture")
                    .withRules(List.of(denyTables)));
    return admin
        .roles()
        .create(
            new CreateRole()
                .withName(namespace.prefix("tableDenyRole"))
                .withDescription("RDF authorization revocation fixture")
                .withPolicies(List.of(policy.getFullyQualifiedName())));
  }

  private static void record(final String phase, final String step, final Map<String, ?> values) {
    final Map<String, Object> line = new LinkedHashMap<>();
    line.put("phase", phase);
    line.put("step", step);
    line.putAll(values);
    try {
      Files.createDirectories(DIAGNOSTICS.getParent());
      Files.writeString(
          DIAGNOSTICS,
          JsonUtils.pojoToJson(line) + System.lineSeparator(),
          StandardCharsets.UTF_8,
          StandardOpenOption.CREATE,
          StandardOpenOption.APPEND);
    } catch (IOException failure) {
      throw new UncheckedIOException("Cannot record diagnostics to " + DIAGNOSTICS, failure);
    }
  }

  private static <T> T timed(final String phase, final String step, final Supplier<T> work) {
    final long start = System.nanoTime();
    final T result = work.get();
    record(phase, step, Map.of("millis", (System.nanoTime() - start) / 1_000_000.0));
    return result;
  }

  private static String tableIri(final Table table) {
    return SanitizedModelBuilder.BASE + "entity/table/" + table.getId();
  }

  private static String domainIri(final Domain domain) {
    return SanitizedModelBuilder.BASE + "entity/domain/" + domain.getId();
  }

  private static Fixture createFixture(final TestNamespace namespace) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Domain visible = createDomain(admin, namespace.prefix("visible"));
    final Domain hidden = createDomain(admin, namespace.prefix("hidden"));
    final Caller caller = createCaller(admin, visible);
    final DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(
            namespace, DatabaseServiceTestFactory.createPostgres(namespace));
    final LineageTables tables =
        new LineageTables(
            createTable(admin, schema, namespace.prefix("a"), visible),
            createTable(admin, schema, namespace.prefix("b"), hidden),
            createTable(admin, schema, namespace.prefix("c"), visible),
            createTable(admin, schema, namespace.prefix("d"), visible));
    addUpstream(admin, tables.a(), tables.b());
    addUpstream(admin, tables.b(), tables.c());
    addUpstream(admin, tables.a(), tables.d());
    return new Fixture(caller, visible, hidden, tables);
  }

  private static Domain createDomain(final OpenMetadataClient admin, final String name) {
    return admin
        .domains()
        .create(
            new CreateDomain()
                .withName(name)
                .withDomainType(CreateDomain.DomainType.AGGREGATE)
                .withDescription("RDF authorization alignment fixture"));
  }

  private static Caller createCaller(final OpenMetadataClient admin, final Domain domain) {
    final Role domainOnly = admin.roles().getByName(DOMAIN_ONLY_ACCESS_ROLE);
    final String name = "rdfauthz_" + UUID.randomUUID().toString().substring(0, 8);
    final User created =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.openmetadata.org")
                    .withRoles(List.of(domainOnly.getId()))
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    final User withRoles = admin.users().get(created.getId().toString(), CALLER_ROLE_FIELDS);
    return new Caller(created, domainOnly, roleIds(withRoles.getInheritedRoles()));
  }

  private static Table createTable(
      final OpenMetadataClient admin,
      final DatabaseSchema schema,
      final String name,
      final Domain domain) {
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  /** {@code output om:upstream source}: data flows from source into output. */
  private static void addUpstream(
      final OpenMetadataClient admin, final Table output, final Table source) {
    admin
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(source.getEntityReference())
                        .withToEntity(output.getEntityReference())));
  }

  private record Caller(User user, Role domainOnlyRole, Set<UUID> inheritedRoleIds) {}

  /** Lineage {@code A <- B <- C} and {@code A <- D}, with B in the hidden domain. */
  private record LineageTables(Table a, Table b, Table c, Table d) {}

  private record Fixture(
      Caller caller, Domain visibleDomain, Domain hiddenDomain, LineageTables lineage) {
    User user() {
      return caller.user();
    }

    Table a() {
      return lineage.a();
    }

    Table b() {
      return lineage.b();
    }

    Table c() {
      return lineage.c();
    }

    Table d() {
      return lineage.d();
    }

    List<Table> tables() {
      return List.of(a(), b(), c(), d());
    }

    /** Decisions keyed by the fixture label rather than the namespaced table name. */
    Map<String, Boolean> decisions(final Predicate<Table> decision) {
      final Map<String, Boolean> result = new LinkedHashMap<>();
      result.put("a", decision.test(a()));
      result.put("b", decision.test(b()));
      result.put("c", decision.test(c()));
      result.put("d", decision.test(d()));
      return result;
    }

    String tableIri(final Table table) {
      return RdfAuthorizationAlignmentIT.tableIri(table);
    }

    OpenMetadataClient userClient() {
      return SdkClients.createClient(user().getEmail(), user().getEmail(), new String[] {});
    }

    SecurityContext securityContext() {
      return new CatalogSecurityContext(
          new CatalogPrincipal(user().getName(), user().getEmail()),
          "https",
          CatalogSecurityContext.OPENID_AUTH,
          Set.of());
    }

    List<CatalogResource> catalog() {
      return List.of(
          resource(Entity.TABLE, a().getId()),
          resource(Entity.TABLE, b().getId()),
          resource(Entity.TABLE, c().getId()),
          resource(Entity.TABLE, d().getId()),
          resource(Entity.DOMAIN, visibleDomain.getId()),
          resource(Entity.DOMAIN, hiddenDomain.getId()));
    }

    private static CatalogResource resource(final String type, final UUID id) {
      return new CatalogResource(type, id, List.of());
    }
  }
}

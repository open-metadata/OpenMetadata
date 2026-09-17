package org.openmetadata.service.rdf;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toUnmodifiableSet;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
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
import java.util.ArrayList;
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
import java.util.stream.Stream;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.query.ResultSet;
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
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.SanitizedModelBuilder.CallerPermissions;
import org.openmetadata.service.rdf.SanitizedModelBuilder.CatalogResource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.EntityIri;
import org.openmetadata.service.rdf.SanitizedModelBuilder.FactAdmissionException;
import org.openmetadata.service.rdf.SanitizedModelBuilder.KnowledgeSource;
import org.openmetadata.service.rdf.SanitizedModelBuilder.ReferenceState;
import org.openmetadata.service.rdf.SanitizedModelBuilder.ReferenceStates;
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
   * lineage reference other assets, and joins name other tables inside a literal.
   */
  private static final Set<String> DEFERRED_FACT_VIOLATIONS =
      Set.of(
          UNMAPPED_PREDICATE + OM + "has on DOMAIN",
          UNMAPPED_PREDICATE + OM + "upstream on DOMAIN",
          UNMAPPED_PREDICATE + OM + "joins on TABLE");

  /** Terms the builder now maps; live facts using them must be admitted, not reported as gaps. */
  private static final Set<String> MAPPED_TERMS =
      Set.of(
          "http://purl.org/dc/terms/description",
          "http://purl.org/dc/terms/modified",
          "http://purl.org/dc/terms/hasVersion",
          "http://www.w3.org/ns/dcat#version",
          OM + "hasServiceType",
          OM + "entityStatus",
          OM + "processedLineage",
          OM + "isDeleted",
          OM + "domainType",
          OM + "belongsToService",
          OM + "belongsToDatabase",
          OM + "belongsToSchema",
          OM + "Domain",
          OM + "DatabaseService",
          OM + "Database",
          OM + "DatabaseSchema",
          "http://www.w3.org/ns/dcat#Catalog",
          "http://www.w3.org/ns/dcat#DataService",
          "http://www.w3.org/2004/02/skos/core#Collection");

  /**
   * Predicate names, object kinds, referenced entity types and counts for one node. {@code ?object}
   * is bound only inside the aggregation, so no object value can reach the result.
   */
  private static final String CONTAINER_FACTS =
      """
      SELECT ?predicate ?kind ?target (COUNT(*) AS ?count)
      WHERE {
        GRAPH <%s> { <%s> ?predicate ?object }
        BIND(IF(isLiteral(?object), "literal", IF(isBlank(?object), "blank", "iri")) AS ?kind)
        BIND(IF(isIRI(?object) && STRSTARTS(STR(?object), "%sentity/"),
                STRBEFORE(STRAFTER(STR(?object), "%sentity/"), "/"), "") AS ?target)
      }
      GROUP BY ?predicate ?kind ?target
      ORDER BY ?predicate ?kind ?target
      """;

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
    final Table retired = createSoftDeletedUpstreamOfA(fixture, namespace);
    awaitProjectedFacts(fixture);
    recordContainerFacts(fixture);
    verifyDeletionStateContract(fixture, retired);
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
                violations.stream().noneMatch(RdfAuthorizationAlignmentIT::namesMappedTerm),
                "mapped terms must be admitted: " + violations),
        () ->
            assertTrue(
                violations.stream().allMatch(RdfAuthorizationAlignmentIT::isMappingGap),
                "every violation must be a mapping gap: " + violations),
        () ->
            assertTrue(
                violations.stream().noneMatch(violation -> violation.contains(tableIri(retired))),
                "the soft-deleted reference must be excluded, not rejected: " + violations));
  }

  /** Soft-deleted table E upstream of A, whose lineage edge must stay projected after the delete. */
  private static Table createSoftDeletedUpstreamOfA(
      final Fixture fixture, final TestNamespace namespace) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final Table retired =
        createTable(admin, fixture.schema(), namespace.prefix("e"), fixture.visibleDomain());
    addUpstream(admin, fixture.a(), retired);
    final String edge =
        "<%s> <%supstream> <%s>".formatted(tableIri(fixture.a()), OM, tableIri(retired));
    awaitProjection(edge);
    admin.tables().delete(retired.getId());
    awaitProjection("<%s> <%sisDeleted> true".formatted(tableIri(retired), OM));
    assertTrue(
        askRemote("ASK { GRAPH <%s> { %s } }".formatted(SanitizedModelBuilder.KNOWLEDGE, edge)),
        "a soft delete must leave the lineage edge projected, or the exclusion is not exercised");
    return retired;
  }

  /**
   * Establishes on live data what the database adapter relies on: the batch API reports an explicit
   * deleted flag for a soft-deleted and a live table, and the adapter classifies them accordingly.
   */
  private static void verifyDeletionStateContract(final Fixture fixture, final Table retired) {
    final List<UUID> ids = List.of(retired.getId(), fixture.a().getId());
    final Map<UUID, String> flags =
        inFreshRequest(
            () ->
                Entity.getEntityReferencesByIds(Entity.TABLE, ids, Include.ALL).stream()
                    .collect(
                        toMap(
                            EntityReference::getId,
                            reference -> String.valueOf(reference.getDeleted()))));
    final EntityIri retiredIri = new EntityIri(tableIri(retired), Entity.TABLE, retired.getId());
    final EntityIri liveIri =
        new EntityIri(tableIri(fixture.a()), Entity.TABLE, fixture.a().getId());
    final Map<String, ReferenceState> states =
        inFreshRequest(() -> catalogReferences().resolve(Set.of(retiredIri, liveIri)));
    record(
        "model",
        "deletion-state-contract",
        Map.of(
            "deletedFlags",
            Map.of("retired", flags.get(retired.getId()), "live", flags.get(fixture.a().getId())),
            "states",
            Map.of(
                "retired", String.valueOf(states.get(retiredIri.iri())),
                "live", String.valueOf(states.get(liveIri.iri())))));
    assertEquals(
        Map.of(retired.getId(), "true", fixture.a().getId(), "false"),
        flags,
        "the batch API must report an explicit deleted flag for both tables");
    assertEquals(new ReferenceState.Deleted(), states.get(retiredIri.iri()));
    assertInstanceOf(ReferenceState.Live.class, states.get(liveIri.iri()));
  }

  private static boolean namesMappedTerm(final String violation) {
    return MAPPED_TERMS.stream()
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
    fixture
        .containers()
        .forEach(container -> awaitProjection("<%s> ?p ?o".formatted(entityIri(container))));
  }

  private static String entityIri(final EntityReference reference) {
    return SanitizedModelBuilder.BASE + "entity/" + reference.getType() + "/" + reference.getId();
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
    recordContainerDecisions(fixture, phase);
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

  /**
   * Recorded, never asserted: whether the caller can read the service, database and schema in this
   * phase, through REST and through a fresh-request in-process check. A container link is admitted
   * only when the container is readable on its own, so these decisions bound what containment can
   * contribute.
   */
  private void recordContainerDecisions(final Fixture fixture, final String phase) {
    final Map<String, Boolean> rest = new LinkedHashMap<>();
    fixture
        .containers()
        .forEach(container -> rest.put(container.getType(), restCanRead(fixture, container)));
    final Map<String, Boolean> freshRequest = inFreshRequest(() -> containerDecisions(fixture));
    record(phase, "container-decisions", Map.of("rest", rest, "freshRequest", freshRequest));
  }

  private Map<String, Boolean> containerDecisions(final Fixture fixture) {
    final Map<String, Boolean> decisions = new LinkedHashMap<>();
    for (EntityReference container : fixture.containers()) {
      decisions.put(
          container.getType(),
          isPermittedAsRestGet(
              fixture.securityContext(),
              container.getType(),
              container.getId(),
              MetadataOperation.VIEW_BASIC));
    }
    return decisions;
  }

  private static boolean restCanRead(final Fixture fixture, final EntityReference container) {
    final OpenMetadataClient client = fixture.userClient();
    final String id = container.getId().toString();
    boolean readable = true;
    try {
      switch (container.getType()) {
        case Entity.DATABASE_SERVICE -> client.databaseServices().get(id);
        case Entity.DATABASE -> client.databases().get(id);
        case Entity.DATABASE_SCHEMA -> client.databaseSchemas().get(id);
        default -> throw new IllegalArgumentException("Not a fixture container: " + container);
      }
    } catch (ForbiddenException denied) {
      readable = false;
    }
    return readable;
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
    return new SanitizedModelBuilder(
            suiteFuseki(), fixture.catalog(), catalogReferences(), permissions, TRIPLE_BUDGET)
        .build();
  }

  private static ReferenceStates catalogReferences() {
    return new DatabaseReferences();
  }

  /**
   * Deletion state of referenced entities outside the candidates, from one batched database read
   * per entity type. Live resources carry no tags because this test's permission check reloads
   * every authorization attribute itself.
   */
  private static final class DatabaseReferences implements ReferenceStates {
    @Override
    public Set<String> entityTypes() {
      return Entity.getEntityList();
    }

    @Override
    public Map<String, ReferenceState> resolve(final Set<EntityIri> references) {
      final Map<String, ReferenceState> states = new LinkedHashMap<>();
      references.stream()
          .collect(groupingBy(EntityIri::type))
          .forEach((type, ofType) -> states.putAll(statesOfType(type, ofType)));
      return states;
    }
  }

  /**
   * Every requested reference gets an explicit state: an id the batch omits is missing, and a
   * reference without a deleted flag does not establish that the entity is live. A not-found error
   * from the batch cannot be attributed to one id, so it marks the whole type inconsistent.
   */
  private static Map<String, ReferenceState> statesOfType(
      final String type, final List<EntityIri> references) {
    final List<UUID> ids = references.stream().map(EntityIri::id).toList();
    try {
      final Map<UUID, EntityReference> found =
          Entity.getEntityReferencesByIds(type, ids, Include.ALL).stream()
              .collect(toMap(EntityReference::getId, identity(), (first, second) -> first));
      return references.stream()
          .collect(
              toMap(EntityIri::iri, reference -> stateOf(reference, found.get(reference.id()))));
    } catch (EntityNotFoundException unattributed) {
      return references.stream()
          .collect(
              toMap(
                  EntityIri::iri,
                  reference ->
                      (ReferenceState)
                          new ReferenceState.Inconsistent(
                              "the batch lookup reported a missing " + type)));
    }
  }

  private static ReferenceState stateOf(final EntityIri reference, final EntityReference found) {
    final ReferenceState state;
    if (found == null) {
      state = new ReferenceState.Missing();
    } else if (found.getDeleted() == null) {
      state = new ReferenceState.Inconsistent("the catalog returned no deleted flag");
    } else if (found.getDeleted()) {
      state = new ReferenceState.Deleted();
    } else {
      state =
          new ReferenceState.Live(new CatalogResource(reference.type(), reference.id(), List.of()));
    }
    return state;
  }

  private static KnowledgeSource suiteFuseki() {
    return sparql -> {
      try (QueryExecution execution = remote(sparql)) {
        return execution.execConstruct();
      }
    };
  }

  private static QueryExecution remote(final String sparql) {
    return QueryExecutionHTTP.service(TestSuiteBootstrap.getFusekiQueryEndpoint())
        .query(sparql)
        .timeout(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build();
  }

  /**
   * Recorded, never asserted: what each container node projects, so the mapping is reviewed against
   * the live shape instead of a prediction. Object values never leave the store. The query
   * aggregates without ever returning {@code ?object}, because a service node carries its
   * connection config and its last connection test as literals, and neither may reach a diagnostics
   * file. Only an entity IRI contributes a type; every other object is reported by kind alone.
   */
  private static void recordContainerFacts(final Fixture fixture) {
    for (EntityReference container : fixture.containers()) {
      record(
          "model",
          "container-facts",
          Map.of("type", container.getType(), "facts", containerFacts(entityIri(container))));
    }
  }

  private static List<Map<String, String>> containerFacts(final String iri) {
    final String base = SanitizedModelBuilder.BASE;
    final List<Map<String, String>> facts = new ArrayList<>();
    try (QueryExecution execution =
        remote(CONTAINER_FACTS.formatted(SanitizedModelBuilder.KNOWLEDGE, iri, base, base))) {
      final ResultSet rows = execution.execSelect();
      while (rows.hasNext()) {
        facts.add(fact(rows.next()));
      }
    }
    return facts;
  }

  private static Map<String, String> fact(final QuerySolution row) {
    final Map<String, String> fact = new LinkedHashMap<>();
    fact.put("predicate", row.getResource("predicate").getURI());
    fact.put("objectKind", row.getLiteral("kind").getString());
    fact.put("targetType", row.getLiteral("target").getString());
    fact.put("count", String.valueOf(row.getLiteral("count").getInt()));
    return fact;
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
    try (QueryExecution execution = remote(ask)) {
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
    return new Fixture(caller, visible, hidden, schema, tables);
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
      Caller caller,
      Domain visibleDomain,
      Domain hiddenDomain,
      DatabaseSchema schema,
      LineageTables lineage) {
    /** The service, database and schema containing every fixture table. */
    List<EntityReference> containers() {
      return List.of(schema.getService(), schema.getDatabase(), schema.getEntityReference());
    }

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

    /**
     * A link predicate is mapped only where its target type is also a candidate type, so the
     * containers join the candidates together with the container links. Their own live facts that
     * no reviewed mapping covers, such as the service connection, still reject the build.
     */
    List<CatalogResource> catalog() {
      final List<CatalogResource> containers =
          containers().stream()
              .map(container -> resource(container.getType(), container.getId()))
              .toList();
      return Stream.concat(
              Stream.of(
                  resource(Entity.TABLE, a().getId()),
                  resource(Entity.TABLE, b().getId()),
                  resource(Entity.TABLE, c().getId()),
                  resource(Entity.TABLE, d().getId()),
                  resource(Entity.DOMAIN, visibleDomain.getId()),
                  resource(Entity.DOMAIN, hiddenDomain.getId())),
              containers.stream())
          .toList();
    }

    private static CatalogResource resource(final String type, final UUID id) {
      return new CatalogResource(type, id, List.of());
    }
  }
}

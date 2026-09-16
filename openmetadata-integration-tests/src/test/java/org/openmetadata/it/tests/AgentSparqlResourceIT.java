package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.rdf.AgentSparqlBinding;
import org.openmetadata.schema.api.rdf.AgentSparqlCompletenessReason;
import org.openmetadata.schema.api.rdf.AgentSparqlCompletenessStatus;
import org.openmetadata.schema.api.rdf.AgentSparqlError;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.AgentSparqlQuery;
import org.openmetadata.schema.api.rdf.AgentSparqlRdfTerm;
import org.openmetadata.schema.api.rdf.AgentSparqlRdfTermType;
import org.openmetadata.schema.api.rdf.AgentSparqlResponse;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfProjectionHealth;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.agent.AgentSparqlAudit;
import org.slf4j.LoggerFactory;

/**
 * Contract tests for {@code POST /v1/rdf/sparql/agent} over real HTTP: explicit opt-in
 * authorization, bot impersonation, pre-resource error mapping, query policy, completeness, and
 * conservative projection readiness.
 *
 * <p>Fixture triples are written to a dedicated named graph. Agent reads use the default-graph
 * union view, matching production where entities live in named graphs: the supported Fuseki
 * image unions named graphs into the default graph for reads, so default-graph writes would be
 * unreadable.
 */
@Isolated
public class AgentSparqlResourceIT {
  private static final String AGENT_PATH = "/v1/rdf/sparql/agent";
  private static final String IMPERSONATE_HEADER = "X-Impersonate-User";
  private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
  private static final String RDF_INDEX_APP = "RdfIndexApp";
  private static final long TOKEN_TTL_SECONDS = 3600;
  private static final int FIXTURE_BATCH_ROWS = 400;
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private static final Deque<Runnable> CLEANUP = new ArrayDeque<>();
  private static final Deque<UUID> APP_RUN_IDS = new ArrayDeque<>();

  private static String suffix;
  private static String fixture;
  private static String fixtureGraph;
  private static String grantedToken;
  private static String grantedUserName;
  private static String wildcardToken;
  private static String deniedToken;
  private static String plainToken;
  private static String plainUserName;
  private static String impersonatingBotToken;
  private static String impersonatingBotName;
  private static String nonImpersonatingBotToken;

  @BeforeAll
  static void setUp() throws Exception {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Requires the RDF integration-test profile");
    suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    fixture = "urn:agent-sparql-it:" + suffix + ":";
    fixtureGraph = fixture + "graph";
    requireServerRdf();
    recordRdfIndexRun(AppRunRecord.Status.SUCCESS);
    RdfProjectionHealth.markReady();
    createCallers();
    loadFixture();
  }

  @AfterAll
  static void tearDown() throws Exception {
    if (fixtureGraph != null) {
      adminUpdate("DELETE WHERE { GRAPH <" + fixtureGraph + "> { ?s ?p ?o } }");
    }
    APP_RUN_IDS.forEach(
        id -> Entity.getCollectionDAO().appExtensionTimeSeriesDao().delete(id.toString(), STATUS));
    while (!CLEANUP.isEmpty()) {
      CLEANUP.pop().run();
    }
  }

  @Test
  void explicitGrantReturnsTypedBindings() throws Exception {
    AgentSparqlResponse response =
        success(
            grantedToken,
            "SELECT ?label ?count ?note WHERE { <"
                + fixture
                + "table> <"
                + fixture
                + "label> ?label ; <"
                + fixture
                + "count> ?count OPTIONAL { <"
                + fixture
                + "table> <"
                + fixture
                + "missing> ?note } }");

    AgentSparqlBinding row = response.getResults().getBindings().getFirst();
    AgentSparqlRdfTerm label = row.getAdditionalProperties().get("label");
    AgentSparqlRdfTerm count = row.getAdditionalProperties().get("count");
    assertEquals(List.of("label", "count", "note"), response.getHead().getVars());
    assertEquals(AgentSparqlRdfTermType.LITERAL, label.getType());
    assertEquals("en", label.getXmlLang());
    assertEquals("http://www.w3.org/2001/XMLSchema#integer", count.getDatatype());
    assertFalse(row.getAdditionalProperties().containsKey("note"), "Unbound must stay absent");
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE,
        response.getMetadata().getCompleteness().getStatus());
  }

  @Test
  void joinsAggregatesAndEmptyResultsSucceed() throws Exception {
    AgentSparqlResponse aggregate =
        success(
            grantedToken,
            "SELECT (COUNT(DISTINCT ?downstream) AS ?n) WHERE { <"
                + fixture
                + "table> <"
                + fixture
                + "feeds> ?middle . ?middle <"
                + fixture
                + "feeds> ?downstream }");
    AgentSparqlResponse empty =
        success(grantedToken, "SELECT ?o WHERE { <" + fixture + "absent> ?p ?o }");

    assertEquals(
        "2",
        aggregate
            .getResults()
            .getBindings()
            .getFirst()
            .getAdditionalProperties()
            .get("n")
            .getValue());
    assertTrue(empty.getResults().getBindings().isEmpty());
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE, empty.getMetadata().getCompleteness().getStatus());
  }

  @Test
  void wildcardAllPolicyDoesNotGrantTheEndpoint() throws Exception {
    assertError(
        post(wildcardToken, query(selectFixture())), 403, AgentSparqlErrorCode.RDF_QUERY_FORBIDDEN);
  }

  @Test
  void callerWithoutGrantIsForbidden() throws Exception {
    assertError(
        post(plainToken, query(selectFixture())), 403, AgentSparqlErrorCode.RDF_QUERY_FORBIDDEN);
  }

  @Test
  void wildcardDenyOverridesExplicitGrant() throws Exception {
    assertError(
        post(deniedToken, query(selectFixture())), 403, AgentSparqlErrorCode.RDF_QUERY_FORBIDDEN);
  }

  @Test
  void adminPassesWithoutAnExplicitGrant() throws Exception {
    success(SdkClients.getAdminToken(), selectFixture());
  }

  @Test
  void impersonationAuthorizesAndAuditsTheEffectiveUser() throws Exception {
    ListAppender<ILoggingEvent> audit = attachAuditAppender();
    try {
      success(impersonatingBotToken, selectFixture(), grantedUserName);

      String event =
          audit.list.stream()
              .map(ILoggingEvent::getFormattedMessage)
              .filter(message -> message.contains("effectiveUser=" + grantedUserName))
              .findFirst()
              .orElseThrow();
      assertTrue(event.contains("serviceActor=" + impersonatingBotName), event);
      assertTrue(event.contains("outcome=SUCCESS"), event);
      assertFalse(event.contains(fixture), "Query text must not be logged: " + event);
    } finally {
      detachAuditAppender(audit);
    }
  }

  @Test
  void impersonatedUserWithoutGrantGetsNoBotFallback() throws Exception {
    assertError(
        post(impersonatingBotToken, query(selectFixture()), plainUserName),
        403,
        AgentSparqlErrorCode.RDF_QUERY_FORBIDDEN);
  }

  @Test
  void untrustedImpersonationIsRejectedBeforeTheResource() throws Exception {
    assertError(
        post(impersonatingBotToken, query(selectFixture()), "agent_it_ghost_" + suffix),
        403,
        AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED);
    assertError(
        post(grantedToken, query(selectFixture()), plainUserName),
        403,
        AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED);
    assertError(
        post(nonImpersonatingBotToken, query(selectFixture()), grantedUserName),
        403,
        AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED);
  }

  @Test
  void authenticationFailuresUseTheStableEnvelope() throws Exception {
    assertError(
        post(null, query(selectFixture())), 401, AgentSparqlErrorCode.AUTHENTICATION_REQUIRED);
    assertError(
        post("not.a.jwt", query(selectFixture())),
        401,
        AgentSparqlErrorCode.AUTHENTICATION_REQUIRED);
  }

  @Test
  void neighboringEndpointsKeepTheirErrorShape() throws Exception {
    HttpResponse<String> admin =
        send(SdkClients.getServerUrl() + "/v1/rdf/sparql", null, query(selectFixture()), null);

    assertEquals(401, admin.statusCode());
    assertFalse(admin.body().contains("requestId"), admin.body());
    assertFalse(admin.body().contains("AUTHENTICATION_REQUIRED"), admin.body());
  }

  @Test
  void malformedBodiesAreInvalidQueries() throws Exception {
    assertError(post(grantedToken, "{not json"), 400, AgentSparqlErrorCode.QUERY_INVALID);
    assertError(
        post(grantedToken, "{\"query\":\"" + selectFixture() + "\",\"inference\":\"owl\"}"),
        400,
        AgentSparqlErrorCode.QUERY_INVALID);
  }

  @Test
  void queryPolicyViolationsHaveDistinctCodes() throws Exception {
    assertError(
        post(grantedToken, query("SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }")),
        400,
        AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED);
    assertError(
        post(grantedToken, query("SELECT ?s FROM <urn:g> WHERE { ?s ?p ?o }")),
        400,
        AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED);
    assertError(
        post(
            grantedToken,
            query("SELECT ?s WHERE { SERVICE <https://example.org/sparql> { ?s ?p ?o } }")),
        403,
        AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED);
    assertError(
        post(grantedToken, query("ASK { ?s ?p ?o }")),
        400,
        AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED);
    assertError(
        post(grantedToken, query("SELECT ?s WHERE { ?s ?p ?o } LIMIT 10001")),
        400,
        AgentSparqlErrorCode.QUERY_LIMIT_EXCEEDED);
  }

  @Test
  void explicitLimitIsCompleteRelativeToTheSubmittedQuery() throws Exception {
    AgentSparqlResponse response =
        success(grantedToken, "SELECT ?row WHERE { ?row <" + fixture + "p1001> ?v } LIMIT 10");

    assertEquals(10, response.getResults().getBindings().size());
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE,
        response.getMetadata().getCompleteness().getStatus());
    assertEquals(10, response.getMetadata().getEffectiveLimits().getExplicitQueryLimit());
  }

  @Test
  void serverRowLimitDistinguishesExactlyFullFromOverflow() throws Exception {
    AgentSparqlResponse exactlyFull =
        success(grantedToken, "SELECT ?row WHERE { ?row <" + fixture + "p1000> ?v }");
    AgentSparqlResponse overflow =
        success(grantedToken, "SELECT ?row WHERE { ?row <" + fixture + "p1001> ?v }");
    AgentSparqlResponse offset =
        success(grantedToken, "SELECT ?row WHERE { ?row <" + fixture + "p1001> ?v } OFFSET 1");

    assertEquals(1000, exactlyFull.getResults().getBindings().size());
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE,
        exactlyFull.getMetadata().getCompleteness().getStatus());
    assertEquals(1000, overflow.getResults().getBindings().size());
    assertEquals(
        AgentSparqlCompletenessStatus.TRUNCATED,
        overflow.getMetadata().getCompleteness().getStatus());
    assertEquals(
        AgentSparqlCompletenessReason.SERVER_ROW_LIMIT,
        overflow.getMetadata().getCompleteness().getReason());
    assertNull(overflow.getMetadata().getEffectiveLimits().getExplicitQueryLimit());
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE, offset.getMetadata().getCompleteness().getStatus());
  }

  @Test
  void subqueryLimitsKeepTheirSemantics() throws Exception {
    AgentSparqlResponse response =
        success(
            grantedToken,
            "SELECT (COUNT(?row) AS ?n) WHERE { { SELECT ?row WHERE { ?row <"
                + fixture
                + "p1001> ?v } LIMIT 3 } }");

    assertEquals(
        "3",
        response
            .getResults()
            .getBindings()
            .getFirst()
            .getAdditionalProperties()
            .get("n")
            .getValue());
  }

  @Test
  void rebuildingProjectionIsNotReady() throws Exception {
    recordRdfIndexRun(AppRunRecord.Status.RUNNING);
    try {
      assertError(
          post(grantedToken, query(selectFixture())),
          503,
          AgentSparqlErrorCode.PROJECTION_NOT_READY);
    } finally {
      recordRdfIndexRun(AppRunRecord.Status.SUCCESS);
    }
    success(grantedToken, selectFixture());
  }

  private static String selectFixture() {
    return "SELECT ?p ?o WHERE { <" + fixture + "table> ?p ?o }";
  }

  private static AgentSparqlResponse success(String token, String sparql) throws Exception {
    return success(token, sparql, null);
  }

  private static AgentSparqlResponse success(String token, String sparql, String impersonate)
      throws Exception {
    HttpResponse<String> response = post(token, query(sparql), impersonate);
    assertEquals(200, response.statusCode(), response.body());
    return JsonUtils.readValue(response.body(), AgentSparqlResponse.class);
  }

  private static void assertError(
      HttpResponse<String> response, int status, AgentSparqlErrorCode code) {
    assertEquals(status, response.statusCode(), response.body());
    AgentSparqlError error = JsonUtils.readValue(response.body(), AgentSparqlError.class);
    assertEquals(code, error.getCode(), response.body());
    assertNotNull(error.getRequestId());
  }

  private static String query(String sparql) {
    return JsonUtils.pojoToJson(new AgentSparqlQuery().withQuery(sparql));
  }

  /** The admin schema carries defaulted format/timeout/inference fields the agent schema rejects. */
  private static String adminQuery(String sparql) {
    return JsonUtils.pojoToJson(new SparqlQuery().withQuery(sparql));
  }

  private static HttpResponse<String> post(String token, String body) throws Exception {
    return post(token, body, null);
  }

  private static HttpResponse<String> post(String token, String body, String impersonate)
      throws Exception {
    return send(SdkClients.getServerUrl() + AGENT_PATH, token, body, impersonate);
  }

  private static HttpResponse<String> send(
      String url, String token, String body, String impersonate) throws Exception {
    HttpRequest.Builder request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(60))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));
    if (token != null) {
      request.header("Authorization", "Bearer " + token);
    }
    if (impersonate != null) {
      request.header(IMPERSONATE_HEADER, impersonate);
    }
    return HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
  }

  private static void adminUpdate(String sparql) throws Exception {
    HttpResponse<String> response =
        send(
            SdkClients.getServerUrl() + "/v1/rdf/sparql/update",
            SdkClients.getAdminToken(),
            adminQuery(sparql),
            null);
    assertEquals(200, response.statusCode(), response.body());
  }

  /**
   * The suite bootstrap configures RDF on the embedded server. Reconfiguring it here would point the
   * repository away from its active dataset and leak into later tests, so the test only insists that
   * it is on.
   */
  private static void requireServerRdf() {
    RdfRepository repository = RdfRepository.getInstanceOrNull();
    assertTrue(
        repository != null && repository.isEnabled(),
        "The RDF test profile must start the server with RDF enabled");
  }

  /** The projection state resolver reads the latest RdfIndexApp run, so a newer row wins. */
  private static void recordRdfIndexRun(AppRunRecord.Status status) {
    UUID appId = UUID.randomUUID();
    long now = System.currentTimeMillis() + APP_RUN_IDS.size();
    AppRunRecord run =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName(RDF_INDEX_APP)
            .withStatus(status)
            .withTimestamp(now)
            .withStartTime(now)
            .withExtension(STATUS);
    Entity.getCollectionDAO().appExtensionTimeSeriesDao().insert(JsonUtils.pojoToJson(run), STATUS);
    APP_RUN_IDS.push(appId);
  }

  private static void loadFixture() throws Exception {
    String table = "<" + fixture + "table>";
    insertRows("p1000", 1000);
    insertRows("p1001", 1001);
    adminUpdate(
        "INSERT DATA { GRAPH <"
            + fixtureGraph
            + "> { "
            + table
            + " <"
            + fixture
            + "label> \"orders\"@en ; <"
            + fixture
            + "count> 3 ; <"
            + fixture
            + "feeds> <"
            + fixture
            + "staging> . <"
            + fixture
            + "staging> <"
            + fixture
            + "feeds> <"
            + fixture
            + "report> , <"
            + fixture
            + "dashboard> . } }");
  }

  /** Batched so each update stays well under the 100,000-character query ceiling. */
  private static void insertRows(String predicate, int count) throws Exception {
    for (int start = 0; start < count; start += FIXTURE_BATCH_ROWS) {
      String triples =
          IntStream.range(start, Math.min(count, start + FIXTURE_BATCH_ROWS))
              .mapToObj(
                  index ->
                      "<" + fixture + predicate + "/" + index + "> <" + fixture + predicate + "> "
                          + index + " . ")
              .collect(Collectors.joining());
      adminUpdate("INSERT DATA { GRAPH <" + fixtureGraph + "> { " + triples + "} }");
    }
  }

  private static void createCallers() {
    OpenMetadataClient admin = SdkClients.adminClient();
    Role grantRole =
        role(
            admin,
            "grant",
            rule(MetadataOperation.EXECUTE_SPARQL_QUERY, Entity.RDF, Rule.Effect.ALLOW));
    Role wildcardRole =
        role(admin, "wildcard", rule(MetadataOperation.ALL, "All", Rule.Effect.ALLOW));
    Role denyRole = role(admin, "deny", rule(MetadataOperation.ALL, Entity.RDF, Rule.Effect.DENY));

    grantedUserName = user(admin, "granted", List.of(grantRole.getId()));
    grantedToken = tokenFor(grantedUserName);
    wildcardToken = tokenFor(user(admin, "wildcard", List.of(wildcardRole.getId())));
    deniedToken = tokenFor(user(admin, "denied", List.of(grantRole.getId(), denyRole.getId())));
    plainUserName = user(admin, "plain", List.of());
    plainToken = tokenFor(plainUserName);

    impersonatingBotName = "agentsparqlbot" + suffix;
    impersonatingBotToken = botToken(admin, impersonatingBotName, true);
    nonImpersonatingBotToken = botToken(admin, "agentsparqlnoimp" + suffix, null);
  }

  private static Rule rule(MetadataOperation operation, String resource, Rule.Effect effect) {
    return new Rule()
        .withName("agentSparql" + effect.value())
        .withOperations(List.of(operation))
        .withResources(List.of(resource))
        .withEffect(effect);
  }

  private static Role role(OpenMetadataClient admin, String name, Rule rule) {
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("AgentSparqlIt_" + name + "_" + suffix)
                    .withRules(List.of(rule)));
    CLEANUP.push(() -> admin.policies().delete(policy.getId()));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName("AgentSparqlIt_" + name + "Role_" + suffix)
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    CLEANUP.push(() -> admin.roles().delete(role.getId()));
    return role;
  }

  private static String user(OpenMetadataClient admin, String name, List<UUID> roles) {
    String userName = ("agentsparql" + name + suffix).toLowerCase(Locale.ROOT);
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(userName + "@test.openmetadata.org")
                    .withRoles(roles));
    CLEANUP.push(() -> admin.users().delete(user.getId()));
    return userName;
  }

  private static String tokenFor(String userName) {
    String email = userName + "@test.openmetadata.org";
    return JwtAuthProvider.tokenFor(email, email, new String[] {}, TOKEN_TTL_SECONDS);
  }

  private static String botToken(
      OpenMetadataClient admin, String botUserName, Boolean allowImpersonation) {
    User botUser =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(botUserName)
                    .withEmail(botUserName + "@test.com")
                    .withIsBot(true)
                    .withAuthenticationMechanism(
                        new AuthenticationMechanism()
                            .withAuthType(AuthenticationMechanism.AuthType.JWT)
                            .withConfig(
                                new JWTAuthMechanism()
                                    .withJWTTokenExpiry(JWTTokenExpiry.Unlimited))));
    CLEANUP.push(() -> admin.users().delete(botUser.getId()));
    Bot bot =
        admin
            .bots()
            .create(
                new CreateBot()
                    .withName(botUserName + "_bot")
                    .withBotUser(botUser.getName())
                    .withAllowImpersonation(allowImpersonation));
    CLEANUP.push(() -> admin.bots().delete(bot.getId()));
    return admin.users().generateToken(botUser.getId(), JWTTokenExpiry.Seven).getJWTToken();
  }

  private static ListAppender<ILoggingEvent> attachAuditAppender() {
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    auditLogger().setLevel(Level.INFO);
    auditLogger().addAppender(appender);
    return appender;
  }

  private static void detachAuditAppender(ListAppender<ILoggingEvent> appender) {
    auditLogger().detachAppender(appender);
    auditLogger().setLevel(null);
    appender.stop();
  }

  private static Logger auditLogger() {
    return (Logger) LoggerFactory.getLogger(AgentSparqlAudit.class);
  }
}

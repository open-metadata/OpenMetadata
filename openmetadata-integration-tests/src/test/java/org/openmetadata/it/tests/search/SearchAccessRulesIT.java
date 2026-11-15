package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * With access control on, search returns a document only where its caller may read what it
 * describes: a pipeline run where the pipeline is readable, a column where its table is, and a
 * user's email only to admins and bots.
 *
 * <p>The callers are users the harness signs tokens for, which a deployed cluster does not trust,
 * so these tests run embedded only.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
public class SearchAccessRulesIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String RUN_INDEX = "pipelineStatus";
  private static final String COLUMN_INDEX = "tableColumn";
  private static final String USER_INDEX = "user_search_index";
  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @Test
  void aRunIsFoundOnlyInItsPipelinesDomainAndFollowsItWhenItMoves(TestNamespace ns)
      throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      Domain own = createDomain(admin, p + "_own", cleanup);
      Domain other = createDomain(admin, p + "_other", cleanup);
      PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
      Pipeline ownPipeline = createPipeline(admin, service, p + "_own_pl", own, List.of());
      Pipeline otherPipeline = createPipeline(admin, service, p + "_other_pl", other, List.of());
      reportRun(admin, ownPipeline);
      reportRun(admin, otherPipeline);
      OpenMetadataClient restricted = domainOnlyUser(admin, p, own, cleanup);
      enableAccessControl(admin, cleanup);

      Set<String> both = Set.of(id(ownPipeline), id(otherPipeline));
      awaitRuns("both runs are indexed", admin, both, both);
      awaitRuns(
          "a run of the other domain's pipeline is hidden",
          restricted,
          both,
          Set.of(id(ownPipeline)));

      admin
          .getHttpClient()
          .executeForString(
              HttpMethod.PATCH,
              "/v1/pipelines/" + otherPipeline.getId(),
              "[{\"op\":\"replace\",\"path\":\"/domains\",\"value\":[{\"id\":\""
                  + own.getId()
                  + "\",\"type\":\"domain\"}]}]",
              JSON_PATCH);
      awaitRuns("the run follows its pipeline into the caller's domain", restricted, both, both);
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void aTagDenyOnPipelinesReachesTheirRunsIncludingTagsOnTasks(TestNamespace ns) throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      String secret = secretTag(ns, "runs");
      PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
      Pipeline tagged =
          admin
              .pipelines()
              .create(
                  new CreatePipeline()
                      .withName(p + "_tagged")
                      .withService(service.getFullyQualifiedName())
                      .withTags(List.of(tag(secret))));
      Pipeline taskTagged =
          createPipeline(
              admin,
              service,
              p + "_task_tagged",
              null,
              List.of(new Task().withName("extract").withTags(List.of(tag(secret)))));
      Pipeline plain = createPipeline(admin, service, p + "_plain", null, List.of());
      for (Pipeline pipeline : List.of(tagged, taskTagged, plain)) {
        reportRun(admin, pipeline);
      }
      OpenMetadataClient restricted =
          deniedUser(admin, p, Entity.PIPELINE, "matchAnyTag('" + secret + "')", cleanup);
      enableAccessControl(admin, cleanup);

      Set<String> all = Set.of(id(tagged), id(taskTagged), id(plain));
      awaitRuns("every run is indexed", admin, all, all);
      awaitRuns("runs of denied pipelines are hidden", restricted, all, Set.of(id(plain)));
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void aColumnIsHiddenWhenATagOnAnotherColumnDeniesItsTable(TestNamespace ns) throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      String secret = secretTag(ns, "columns");
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
      Table denied =
          admin
              .tables()
              .create(
                  new CreateTable()
                      .withName(p + "_denied")
                      .withDatabaseSchema(schema.getFullyQualifiedName())
                      .withColumns(
                          List.of(
                              new Column()
                                  .withName("tagged")
                                  .withDataType(ColumnDataType.INT)
                                  .withTags(List.of(tag(secret))),
                              new Column().withName("plain").withDataType(ColumnDataType.INT))));
      Table readable =
          admin
              .tables()
              .create(
                  new CreateTable()
                      .withName(p + "_readable")
                      .withDatabaseSchema(schema.getFullyQualifiedName())
                      .withColumns(
                          List.of(
                              new Column().withName("plain").withDataType(ColumnDataType.INT))));
      OpenMetadataClient restricted =
          deniedUser(admin, p, Entity.TABLE, "matchAnyTag('" + secret + "')", cleanup);
      enableAccessControl(admin, cleanup);

      String deniedPlain = denied.getFullyQualifiedName() + ".plain";
      String readablePlain = readable.getFullyQualifiedName() + ".plain";
      Set<String> both = Set.of(deniedPlain, readablePlain);
      awaitColumns("both untagged columns are indexed", admin, schema, both, both);
      awaitColumns(
          "the untagged column of the denied table is hidden",
          restricted,
          schema,
          both,
          Set.of(readablePlain));
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void userSearchNeitherReturnsNorMatchesEmailsForNonAdmins(TestNamespace ns) throws Exception {
    assumeTheServerTrustsHarnessSignedTokens();
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String p = ns.shortPrefix();
      String name = p + "_listed";
      String email = name + "@test.openmetadata.org";
      User listed = admin.users().create(new CreateUser().withName(name).withEmail(email));
      cleanup.push(() -> hardDelete(admin, listed));
      OpenMetadataClient caller = user(admin, new CreateUser().withName(p + "_caller"), cleanup);

      Awaitility.await("an admin finds the user by its email and reads it back")
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> assertEquals(email, userHit(admin, email, name).path("email").asText()));
      assertEquals(email, fieldQueryHit(admin, name).path("email").asText());
      assertTrue(aggregate(admin, aggregateRequest(name)).contains(email));

      assertFalse(userHit(caller, name).has("email"), "query hit");
      assertFalse(fieldQueryHit(caller, name).has("email"), "field query hit");
      String topHits =
          caller
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/search/aggregate",
                  null,
                  RequestOptions.builder()
                      .queryParam("index", USER_INDEX)
                      .queryParam("field", "name.keyword")
                      .queryParam("value", ".*")
                      .queryParam("sourceFields", "*")
                      .queryParam("q", nameFilter(name))
                      .build());
      assertTrue(topHits.contains(name), topHits);
      assertFalse(topHits.contains(email), "GET aggregate top hits: " + topHits);
      String postTopHits = aggregate(caller, aggregateRequest(name));
      assertTrue(postTopHits.contains(name), postTopHits);
      assertFalse(postTopHits.contains(email), "POST aggregate top hits: " + postTopHits);

      String byAddress = caller.search().query(email).index(USER_INDEX).size(10).execute();
      assertFalse(hitNames(byAddress).contains(name), "matched by email: " + byAddress);
      caller.search().query("@timestamp").index("table_search_index").execute();

      List<Executable> emailLookups =
          List.of(
              () ->
                  caller.search().query("email.keyword:" + name + "*").index(USER_INDEX).execute(),
              () ->
                  caller
                      .search()
                      .query("*")
                      .index(USER_INDEX)
                      .queryFilter("{\"query\":{\"prefix\":{\"email.keyword\":\"" + name + "\"}}}")
                      .execute(),
              () ->
                  caller
                      .search()
                      .query("*")
                      .index(USER_INDEX)
                      .sortBy("email.keyword", "asc")
                      .execute(),
              () -> fieldQuery(caller, "email.keyword", name + "*"),
              () ->
                  caller
                      .getHttpClient()
                      .executeForString(
                          HttpMethod.GET,
                          "/v1/search/aggregate",
                          null,
                          RequestOptions.builder()
                              .queryParam("index", USER_INDEX)
                              .queryParam("field", "email.keyword")
                              .queryParam("value", ".*")
                              .build()));
      for (Executable lookup : emailLookups) {
        OpenMetadataException refused = assertThrows(OpenMetadataException.class, lookup);
        assertEquals(400, refused.getStatusCode(), refused.getMessage());
      }
    } finally {
      drain(cleanup);
    }
  }

  private static void awaitRuns(
      String description,
      OpenMetadataClient client,
      Set<String> pipelineIds,
      Set<String> expected) {
    Awaitility.await(description)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(() -> assertEquals(expected, runPipelineIds(client, pipelineIds)));
  }

  private static Set<String> runPipelineIds(OpenMetadataClient client, Set<String> pipelineIds)
      throws Exception {
    String filter =
        MAPPER.writeValueAsString(
            Map.of("query", Map.of("terms", Map.of("pipelineId", List.copyOf(pipelineIds)))));
    String response =
        client.search().query("*").index(RUN_INDEX).queryFilter(filter).size(100).execute();
    Set<String> ids = new HashSet<>();
    MAPPER
        .readTree(response)
        .path("hits")
        .path("hits")
        .forEach(hit -> ids.add(hit.path("_source").path("pipelineId").asText()));
    return ids;
  }

  private static void awaitColumns(
      String description,
      OpenMetadataClient client,
      DatabaseSchema schema,
      Set<String> columnFqns,
      Set<String> expected) {
    Awaitility.await(description)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(() -> assertEquals(expected, columnFqns(client, schema, columnFqns)));
  }

  private static Set<String> columnFqns(
      OpenMetadataClient client, DatabaseSchema schema, Set<String> columnFqns) throws Exception {
    String filter =
        MAPPER.writeValueAsString(
            Map.of(
                "query", Map.of("terms", Map.of("fullyQualifiedName", List.copyOf(columnFqns)))));
    String response =
        client.search().query("*").index(COLUMN_INDEX).queryFilter(filter).size(100).execute();
    Set<String> fqns = new HashSet<>();
    MAPPER
        .readTree(response)
        .path("hits")
        .path("hits")
        .forEach(hit -> fqns.add(hit.path("_source").path("fullyQualifiedName").asText()));
    return fqns;
  }

  private static JsonNode userHit(OpenMetadataClient client, String name) throws Exception {
    return userHit(client, name, name);
  }

  private static JsonNode userHit(OpenMetadataClient client, String query, String name)
      throws Exception {
    return sourceNamed(client.search().query(query).index(USER_INDEX).size(10).execute(), name);
  }

  private static JsonNode fieldQueryHit(OpenMetadataClient client, String name) throws Exception {
    return sourceNamed(fieldQuery(client, "name.keyword", name), name);
  }

  private static String fieldQuery(OpenMetadataClient client, String field, String value) {
    return client
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            "/v1/search/fieldQuery",
            null,
            RequestOptions.builder()
                .queryParam("index", USER_INDEX)
                .queryParam("fieldName", field)
                .queryParam("fieldValue", value)
                .build());
  }

  private static String aggregate(OpenMetadataClient client, String request) {
    return client
        .getHttpClient()
        .executeForString(HttpMethod.POST, "/v1/search/aggregate", request);
  }

  /** Buckets the one user named {@code name} by name, its email asked for in the top hits. */
  private static String aggregateRequest(String name) throws Exception {
    return MAPPER.writeValueAsString(
        Map.of(
            "index",
            USER_INDEX,
            "fieldName",
            "name.keyword",
            "fieldValue",
            ".*",
            "query",
            nameFilter(name),
            "sourceFields",
            List.of("email")));
  }

  private static String nameFilter(String name) throws Exception {
    return MAPPER.writeValueAsString(Map.of("query", Map.of("term", Map.of("name.keyword", name))));
  }

  private static JsonNode sourceNamed(String response, String name) throws Exception {
    for (JsonNode hit : MAPPER.readTree(response).path("hits").path("hits")) {
      if (name.equals(hit.path("_source").path("name").asText())) {
        return hit.path("_source");
      }
    }
    throw new AssertionError("no hit for " + name + " in " + response);
  }

  private static Set<String> hitNames(String response) throws Exception {
    Set<String> names = new HashSet<>();
    MAPPER
        .readTree(response)
        .path("hits")
        .path("hits")
        .forEach(hit -> names.add(hit.path("_source").path("name").asText()));
    return names;
  }

  private static void hardDelete(OpenMetadataClient admin, User user) {
    admin.users().delete(user.getId().toString(), Map.of("hardDelete", "true"));
  }

  private static Pipeline createPipeline(
      OpenMetadataClient admin,
      PipelineService service,
      String name,
      Domain domain,
      List<Task> tasks) {
    CreatePipeline create =
        new CreatePipeline()
            .withName(name)
            .withService(service.getFullyQualifiedName())
            .withTasks(tasks);
    if (domain != null) {
      create.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return admin.pipelines().create(create);
  }

  private static void reportRun(OpenMetadataClient admin, Pipeline pipeline) {
    admin
        .pipelines()
        .addPipelineStatus(
            pipeline.getFullyQualifiedName(),
            new PipelineStatus()
                .withExecutionStatus(StatusType.Successful)
                .withTimestamp(System.currentTimeMillis()));
  }

  private static String secretTag(TestNamespace ns, String suffix) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Classification classification =
        admin
            .classifications()
            .create(
                new CreateClassification()
                    .withName("sar_" + suffix + "_" + UUID.randomUUID().toString().substring(0, 8))
                    .withDescription("Classification for search access tests"));
    ns.trackRoot(Entity.CLASSIFICATION, classification);
    return admin
        .tags()
        .create(
            new CreateTag()
                .withName("secret")
                .withDescription("Tag a deny rule hides")
                .withClassification(classification.getFullyQualifiedName()))
        .getFullyQualifiedName();
  }

  private static TagLabel tag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static String id(Pipeline pipeline) {
    return pipeline.getId().toString();
  }

  private static Domain createDomain(
      OpenMetadataClient admin, String name, Deque<Runnable> cleanup) {
    Domain domain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(name)
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Search access test domain"));
    cleanup.push(() -> admin.domains().delete(domain.getId().toString()));
    return domain;
  }

  private static OpenMetadataClient domainOnlyUser(
      OpenMetadataClient admin, String prefix, Domain domain, Deque<Runnable> cleanup) {
    Role domainOnly = admin.roles().getByName("DomainOnlyAccessRole");
    return user(
        admin,
        new CreateUser()
            .withName(prefix + "_domain_only")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withRoles(List.of(domainOnly.getId())),
        cleanup);
  }

  private static OpenMetadataClient deniedUser(
      OpenMetadataClient admin,
      String prefix,
      String resource,
      String condition,
      Deque<Runnable> cleanup) {
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(prefix + "_deny_" + resource)
                    .withDescription("Denies some " + resource + " entities")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("deny_" + resource)
                                .withResources(List.of(resource))
                                .withOperations(List.of(MetadataOperation.ALL))
                                .withEffect(Rule.Effect.DENY)
                                .withCondition(condition))));
    cleanup.push(() -> admin.policies().delete(policy.getId().toString()));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + "_deny_" + resource + "_role")
                    .withDescription("Role denying some " + resource + " entities")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    cleanup.push(() -> admin.roles().delete(role.getId().toString()));
    return user(
        admin,
        new CreateUser().withName(prefix + "_denied_" + resource).withRoles(List.of(role.getId())),
        cleanup);
  }

  private static OpenMetadataClient user(
      OpenMetadataClient admin, CreateUser create, Deque<Runnable> cleanup) {
    String email = create.getName() + "@test.openmetadata.org";
    User user = admin.users().create(create.withEmail(email));
    cleanup.push(() -> hardDelete(admin, user));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static void enableAccessControl(OpenMetadataClient admin, Deque<Runnable> cleanup)
      throws Exception {
    String settingsJson =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null);
    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings search = MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
    if (Boolean.TRUE.equals(search.getGlobalSettings().getEnableAccessControl())) {
      return;
    }
    search.getGlobalSettings().setEnableAccessControl(true);
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(
                new Settings()
                    .withConfigType(SettingsType.SEARCH_SETTINGS)
                    .withConfigValue(search)));
    cleanup.push(
        () -> {
          try {
            admin
                .getHttpClient()
                .executeForString(
                    HttpMethod.PUT,
                    "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
                    null);
          } catch (Exception ignored) {
            // Best-effort restore.
          }
        });
  }

  private static void assumeTheServerTrustsHarnessSignedTokens() {
    Assumptions.assumeTrue(
        !OssTestServer.isExternalMode(),
        "Signs the callers' tokens with the harness key, which a deployed cluster rejects");
  }

  private static void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (Exception ignored) {
        // Best-effort teardown; namespaces keep concurrent tests apart regardless.
      }
    }
  }
}

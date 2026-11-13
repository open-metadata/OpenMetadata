package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceAttributes;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

/**
 * Issue #22095: hiding every asset ingested by a service through a policy condition on the service.
 *
 * <p>A Deny rule carrying {@code matchAnyServiceTag} has to hold on both read paths — direct GET
 * and search — or the asset disappears from Explore while still being readable by id, or the
 * reverse. These tests exercise both, plus the create path, which resolves the service from the
 * persisted parent rather than from the caller's request.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ServiceAttributePolicyIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Column COLUMN = new Column().withName("id").withDataType(ColumnDataType.INT);
  private static final String HIDDEN_TAG = "PII.Sensitive";
  private static final String TAGS_FIELD = "tags";
  private static final String TIER_TAG = "Tier.Tier1";
  private static final String TABLE_INDEX = "table_search_index";
  private static final Duration INDEXING_WAIT = Duration.ofSeconds(90);
  // Generous for a change that needs no reindex, yet well inside the five-minute TTL of the
  // compiled search filter, so a filter served stale from that cache still fails the wait.
  private static final Duration POLICY_CHANGE_WAIT = Duration.ofSeconds(60);

  /** Only this test toggles the global search settings, so only it takes the shared lock. */
  @Test
  @ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
  void denyOnServiceTag_hidesTheAssetsAndTheService_andUntaggingRestoresThem(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_hidden", schema);

      Role denyRole =
          createDenyRole(admin, prefix, "matchAnyServiceTag('" + HIDDEN_TAG + "')", cleanup);
      OpenMetadataClient restricted = createUserClient(admin, prefix, denyRole, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      // Untagged service: the table is both readable and findable. Establishing this first is what
      // makes the "gone" assertions below meaningful — an absence check alone would also pass if
      // the table had simply never been indexed.
      assertNotNull(restricted.tables().get(table.getId().toString(), ""));
      Awaitility.await("table is indexed and visible before the service is tagged")
          .atMost(Duration.ofSeconds(90))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertTrue(
                      searchFqns(restricted, "table_search_index", prefix)
                          .contains(table.getFullyQualifiedName())));

      tagService(admin, service, HIDDEN_TAG);

      assertThrows(
          ForbiddenException.class,
          () -> restricted.tables().get(table.getId().toString(), ""),
          "a Deny on the service's tag must also deny a direct GET of its table");
      assertThrows(
          ForbiddenException.class,
          () -> restricted.databaseServices().get(service.getId().toString(), ""),
          "the service is its own service, so it is hidden alongside its assets");

      Awaitility.await("tagged service's table leaves the restricted user's search results")
          .atMost(Duration.ofSeconds(90))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertFalse(
                      searchFqns(restricted, "table_search_index", prefix)
                          .contains(table.getFullyQualifiedName()),
                      "search must agree with the authorization decision"));

      assertTrue(
          searchFqns(admin, "table_search_index", prefix).contains(table.getFullyQualifiedName()),
          "an admin is exempt from search RBAC");

      untagService(admin, service);

      Awaitility.await("untagging the service restores visibility")
          .atMost(Duration.ofSeconds(90))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .untilAsserted(
              () -> {
                assertNotNull(restricted.tables().get(table.getId().toString(), ""));
                assertTrue(
                    searchFqns(restricted, "table_search_index", prefix)
                        .contains(table.getFullyQualifiedName()),
                    "the compiled RBAC query is cached, so this only passes if the cache key "
                        + "tracks the resolved service state");
              });
    } finally {
      drain(cleanup);
    }
  }

  /**
   * collate#7984: search follows a policy change as soon as a direct read does. OpenSearch caches
   * the compiled filter for five minutes under the subject's user, role, domain and team ids. A Deny
   * added to a role the user already holds, or a Deny's condition edited in place, leaves every one
   * of those ids as it was, so the key also carries the policy generation that each policy, role
   * and team write bumps. Elasticsearch compiles the filter on every search, so there this holds
   * trivially.
   */
  @Test
  @ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
  void search_followsRoleAndPolicyEditsWithoutWaitingOutTheFilterCache(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseService elsewhere = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_rbaccache", schema);
      String tableId = table.getId().toString();
      String hidesTheTable = "matchAnyServiceName('" + service.getName() + "')";
      String hidesNothingHere = "matchAnyServiceName('" + elsewhere.getName() + "')";

      Role role = createDenyRole(admin, prefix, hidesNothingHere, cleanup);
      UUID rolePolicyId =
          admin.roles().get(role.getId().toString(), "policies").getPolicies().get(0).getId();
      OpenMetadataClient restricted = createUserClient(admin, prefix, role, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      // This search compiles the filter and caches it. Nothing below changes an id the cache key
      // is made of, and nothing changes the indexed documents either.
      awaitTableInSearch(restricted, prefix, table, true, INDEXING_WAIT, "table is indexed");

      Policy addedDeny =
          createPolicy(admin, prefix + "_addedDeny", denyViewRule(hidesTheTable), cleanup);
      admin.roles().patch(role.getId().toString(), addPolicyPatch(addedDeny.getId()));
      assertThrows(
          ForbiddenException.class,
          () -> restricted.tables().get(tableId, ""),
          "a direct read follows the role edit at once");
      awaitTableInSearch(
          restricted, prefix, table, false, POLICY_CHANGE_WAIT, "Deny added to a held role");

      replaceRuleCondition(admin, addedDeny.getId(), hidesNothingHere);
      assertNotNull(
          restricted.tables().get(tableId, ""), "the loosened Deny lets the read through");
      awaitTableInSearch(
          restricted, prefix, table, true, POLICY_CHANGE_WAIT, "Deny loosened in place");

      replaceRuleCondition(admin, rolePolicyId, hidesTheTable);
      assertThrows(
          ForbiddenException.class,
          () -> restricted.tables().get(tableId, ""),
          "a direct read follows the policy edit at once");
      awaitTableInSearch(
          restricted, prefix, table, false, POLICY_CHANGE_WAIT, "Deny tightened in place");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Issue #22095 regression for the security impact: a PUT create-or-update that omits
   * {@code serviceAttributes} must not wipe an admin-set {@code environment}, or a Deny
   * {@code matchAnyServiceEnvironment('Production')} quietly goes inert and the service's assets
   * become visible. Before the fix the omission PUT nulls the inline {@code serviceAttributes},
   * the resolver drops the service from the environment reverse index, and the Deny stops
   * applying on both read paths with no error logged.
   */
  @Test
  @ResourceLock(value = SharedResourceLocks.SEARCH_SETTINGS, mode = ResourceAccessMode.READ_WRITE)
  void denyOnServiceEnvironment_survivesAPutThatOmitsServiceAttributes(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_envhidden", schema);

      Role denyRole =
          createDenyRole(admin, prefix, "matchAnyServiceEnvironment('Production')", cleanup);
      OpenMetadataClient restricted = createUserClient(admin, prefix, denyRole, cleanup);

      boolean originalAccessControl = enableSearchAccessControl(admin);
      cleanup.push(() -> restoreSearchAccessControl(admin, originalAccessControl));

      // Before the environment is set the table is both readable and indexed — establishing this
      // first is what makes the "hidden" assertions below meaningful.
      assertNotNull(restricted.tables().get(table.getId().toString(), ""));
      Awaitility.await("table is indexed and visible before the environment is set")
          .atMost(Duration.ofSeconds(90))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertTrue(
                      searchFqns(restricted, "table_search_index", prefix)
                          .contains(table.getFullyQualifiedName())));

      // Admin sets environment=Production through the PATCH path (the UI "Service Attributes"
      // card).
      DatabaseService fetched = admin.databaseServices().get(service.getId().toString());
      fetched.setServiceAttributes(
          new ServiceAttributes().withEnvironment(ServiceAttributes.Environment.PRODUCTION));
      admin.databaseServices().update(fetched.getId().toString(), fetched);

      // The Deny now applies on both read paths.
      assertThrows(
          ForbiddenException.class,
          () -> restricted.tables().get(table.getId().toString(), ""),
          "a Deny on the service's environment must deny a direct GET of its table");
      assertThrows(
          ForbiddenException.class,
          () -> restricted.databaseServices().get(service.getId().toString(), ""),
          "the service is its own service, so it is hidden alongside its assets");
      Awaitility.await("environment-tagged service's table leaves the restricted search results")
          .atMost(Duration.ofSeconds(90))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertFalse(
                      searchFqns(restricted, "table_search_index", prefix)
                          .contains(table.getFullyQualifiedName()),
                      "search must agree with the authorization decision"));

      // A credential-rotation-style PUT that OMITS serviceAttributes. Before the fix this wipes
      // environment and the Deny silently stops applying; after the fix the admin-set value is
      // preserved.
      PostgresConnection rotatedConn =
          new PostgresConnection().withHostPort("localhost:5432").withUsername("rotated");
      CreateDatabaseService putBody =
          new CreateDatabaseService()
              .withName(service.getName())
              .withServiceType(CreateDatabaseService.DatabaseServiceType.Postgres)
              .withConnection(new DatabaseConnection().withConfig(rotatedConn));
      admin
          .getHttpClient()
          .execute(HttpMethod.PUT, "/v1/services/databaseServices", putBody, DatabaseService.class);

      // The Deny must STILL apply after the omission PUT.
      assertThrows(
          ForbiddenException.class,
          () -> restricted.tables().get(table.getId().toString(), ""),
          "after a PUT omitting serviceAttributes the Deny must still deny the table");
      assertThrows(
          ForbiddenException.class,
          () -> restricted.databaseServices().get(service.getId().toString(), ""),
          "the service is still hidden after the omission PUT");
      Awaitility.await("table stays absent from search after the omission PUT")
          .atMost(Duration.ofSeconds(90))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertFalse(
                      searchFqns(restricted, "table_search_index", prefix)
                          .contains(table.getFullyQualifiedName()),
                      "search must keep agreeing with the authorization decision"));

      // And the admin-set environment survived the omission PUT on the persisted row.
      DatabaseService reloaded = admin.databaseServices().get(service.getId().toString());
      assertNotNull(reloaded.getServiceAttributes(), "serviceAttributes must not have been wiped");
      assertEquals(
          ServiceAttributes.Environment.PRODUCTION,
          reloaded.getServiceAttributes().getEnvironment(),
          "the omission PUT must not wipe the admin-set environment");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * On create the entity is caller-supplied and its {@code service} is an unvalidated stub that most
   * mappers never populate, so the condition resolves the service from the persisted parent
   * instead. Without that, a create into a hidden service would be allowed.
   */
  @Test
  void denyOnServiceTag_blocksCreatingIntoTheHiddenService(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      tagService(admin, service, HIDDEN_TAG);

      Rule denyCreate =
          new Rule()
              .withName("denyCreateInTaggedService")
              .withDescription("Deny creating assets in a tagged service")
              .withEffect(Rule.Effect.DENY)
              .withOperations(List.of(MetadataOperation.CREATE))
              .withResources(List.of("All"))
              .withCondition("matchAnyServiceTag('" + HIDDEN_TAG + "')");
      Role denyRole = createRole(admin, prefix, denyCreate, cleanup);
      OpenMetadataClient restricted = createUserClient(admin, prefix, denyRole, cleanup);

      assertThrows(
          ForbiddenException.class,
          () ->
              restricted
                  .tables()
                  .create(
                      new CreateTable()
                          .withName(prefix + "_forbidden")
                          .withDatabaseSchema(schema.getFullyQualifiedName())
                          .withColumns(List.of(COLUMN))),
          "the service must be resolved from the persisted parent, not from the request");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Every service condition has to resolve on the create path, not just the tag one — otherwise a
   * Deny written against the service's type or name silently permits creates into it.
   */
  @Test
  void denyOnServiceTypeAndName_blockCreatingIntoTheService(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

      for (String condition :
          List.of(
              "matchAnyServiceType('Postgres')",
              "matchAnyServiceName('" + service.getName() + "')")) {
        Role denyRole =
            createDenyCreateRole(admin, prefix + condition.hashCode(), condition, cleanup);
        OpenMetadataClient restricted =
            createUserClient(admin, prefix + Math.abs(condition.hashCode()), denyRole, cleanup);
        assertThrows(
            ForbiddenException.class,
            () ->
                restricted
                    .tables()
                    .create(
                        new CreateTable()
                            .withName(prefix + "_f" + Math.abs(condition.hashCode()))
                            .withDatabaseSchema(schema.getFullyQualifiedName())
                            .withColumns(List.of(COLUMN))),
            condition + " must be resolved on the create path");
      }
    } finally {
      drain(cleanup);
    }
  }

  private Role createDenyCreateRole(
      OpenMetadataClient admin, String prefix, String condition, Deque<Runnable> cleanup) {
    Rule rule =
        new Rule()
            .withName("denyCreateByServiceAttribute")
            .withDescription("Deny creating assets by an attribute of their service")
            .withEffect(Rule.Effect.DENY)
            .withOperations(List.of(MetadataOperation.CREATE))
            .withResources(List.of("All"))
            .withCondition(condition);
    return createRole(admin, prefix, rule, cleanup);
  }

  /**
   * Glossary terms, users and teams are not ingested by a service, so the condition is false for
   * them and a Deny built on it leaves them alone. Keeping the predicate strict this way is also
   * what makes the search translation agree with the API — those indexes carry no service field.
   */
  @Test
  void denyOnServiceTag_leavesEntitiesWithoutAServiceAlone(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      tagService(admin, service, HIDDEN_TAG);

      Role denyRole =
          createDenyRole(admin, prefix, "matchAnyServiceTag('" + HIDDEN_TAG + "')", cleanup);
      OpenMetadataClient restricted = createUserClient(admin, prefix, denyRole, cleanup);

      assertNotNull(
          restricted.classifications().getByName("PII", ""),
          "a classification has no service and must stay readable under the Deny");
      assertNotNull(
          restricted.teams().getByName("Organization", ""),
          "a team has no service and must stay readable under the Deny");
    } finally {
      drain(cleanup);
    }
  }

  @Test
  void serviceNameAndServiceTypeConditions_areAcceptedAndDeny(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_byname", schema);

      Role byName =
          createDenyRole(
              admin, prefix + "_n", "matchAnyServiceName('" + service.getName() + "')", cleanup);
      OpenMetadataClient nameRestricted = createUserClient(admin, prefix + "_n", byName, cleanup);
      assertThrows(
          ForbiddenException.class,
          () -> nameRestricted.tables().get(table.getId().toString(), ""));

      Role byType =
          createDenyRole(admin, prefix + "_t", "matchAnyServiceType('Postgres')", cleanup);
      OpenMetadataClient typeRestricted = createUserClient(admin, prefix + "_t", byType, cleanup);
      assertThrows(
          ForbiddenException.class,
          () -> typeRestricted.tables().get(table.getId().toString(), ""));
    } finally {
      drain(cleanup);
    }
  }

  /**
   * collate#7981: a tag an asset inherits from its service is one of its tags for {@code
   * matchAnyTag} on every read, not only on one that asks for the tags. The decision loads tags on
   * demand, when a rule first reads them, so it has to merge the inherited ones in itself; a GET
   * naming other fields, or none, must be refused like a read of the tags.
   */
  @Test
  void denyOnAnInheritedTag_refusesEveryReadOfTheAssetsBelowTheTaggedService(TestNamespace ns)
      throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_inherits", schema);
      String tableId = table.getId().toString();

      Role denyRole = createDenyRole(admin, prefix, "matchAnyTag('" + HIDDEN_TAG + "')", cleanup);
      OpenMetadataClient restricted = createUserClient(admin, prefix, denyRole, cleanup);
      assertNotNull(restricted.tables().get(tableId, ""), "readable before the service is tagged");

      tagService(admin, service, HIDDEN_TAG);
      assertTrue(
          tagFqnsOf(admin.tables().get(tableId, TAGS_FIELD)).contains(HIDDEN_TAG),
          "the table inherits the service's tag");

      List<Executable> reads = new ArrayList<>();
      for (String fields : List.of("", "owners", "columns", TAGS_FIELD)) {
        reads.add(
            () ->
                assertThrows(
                    ForbiddenException.class,
                    () -> restricted.tables().get(tableId, fields),
                    "GET by id, fields=" + fields));
        reads.add(
            () ->
                assertThrows(
                    ForbiddenException.class,
                    () -> restricted.tables().getByName(table.getFullyQualifiedName(), fields),
                    "GET by name, fields=" + fields));
      }
      reads.add(
          () ->
              assertThrows(
                  ForbiddenException.class,
                  () -> restricted.databaseSchemas().get(schema.getId().toString(), ""),
                  "the schema inherits the tag too"));
      reads.add(
          () ->
              assertThrows(
                  ForbiddenException.class,
                  () -> restricted.databases().get(schema.getDatabase().getId().toString(), ""),
                  "and so does the database"));
      reads.add(
          () ->
              assertEquals(
                  Permission.Access.DENY,
                  accessOf(restricted, "table", table.getId(), MetadataOperation.VIEW_ALL),
                  "the permissions a client reads agree with the decision"));
      assertAll(reads);
    } finally {
      drain(cleanup);
    }
  }

  /**
   * The same rule for every other kind of asset that inherits its service's tags. Each type resolves
   * its parent in its own repository, so each is read once under the Deny (collate#7981).
   */
  @Test
  void denyOnAnInheritedTag_refusesDirectReadsOfEveryOtherInheritingAssetType(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      List<InheritingAsset> assets = new ArrayList<>();
      List<Runnable> tagServices = new ArrayList<>();

      EntityInterface<?> dashboards = DashboardServiceTestFactory.createMetabase(ns);
      tagServices.add(() -> tag(admin.dashboardServices(), dashboards, HIDDEN_TAG));
      String dashboardService = dashboards.getFullyQualifiedName();
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::charts,
              admin
                  .charts()
                  .create(
                      new CreateChart()
                          .withName(prefix + "_chart")
                          .withService(dashboardService))));
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::dashboards,
              admin
                  .dashboards()
                  .create(
                      new CreateDashboard()
                          .withName(prefix + "_dashboard")
                          .withService(dashboardService))));

      EntityInterface<?> messaging = MessagingServiceTestFactory.createKafka(ns);
      tagServices.add(() -> tag(admin.messagingServices(), messaging, HIDDEN_TAG));
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::topics,
              admin
                  .topics()
                  .create(
                      new CreateTopic()
                          .withName(prefix + "_topic")
                          .withService(messaging.getFullyQualifiedName())
                          .withPartitions(1))));

      EntityInterface<?> pipelines = PipelineServiceTestFactory.createAirflow(ns);
      tagServices.add(() -> tag(admin.pipelineServices(), pipelines, HIDDEN_TAG));
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::pipelines,
              admin
                  .pipelines()
                  .create(
                      new CreatePipeline()
                          .withName(prefix + "_pipeline")
                          .withService(pipelines.getFullyQualifiedName()))));

      EntityInterface<?> storage = StorageServiceTestFactory.createS3(ns);
      tagServices.add(() -> tag(admin.storageServices(), storage, HIDDEN_TAG));
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::containers,
              admin
                  .containers()
                  .create(
                      new CreateContainer()
                          .withName(prefix + "_bucket")
                          .withService(storage.getFullyQualifiedName()))));

      EntityInterface<?> mlModels = MlModelServiceTestFactory.createMlflow(ns);
      tagServices.add(() -> tag(admin.mlModelServices(), mlModels, HIDDEN_TAG));
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::mlModels,
              admin
                  .mlModels()
                  .create(
                      new CreateMlModel()
                          .withName(prefix + "_model")
                          .withAlgorithm("xgboost")
                          .withService(mlModels.getFullyQualifiedName()))));

      EntityInterface<?> search = SearchServiceTestFactory.createElasticSearch(ns);
      tagServices.add(() -> tag(admin.searchServices(), search, HIDDEN_TAG));
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::searchIndexes,
              admin
                  .searchIndexes()
                  .create(
                      new CreateSearchIndex()
                          .withName(prefix + "_index")
                          .withService(search.getFullyQualifiedName())
                          .withFields(
                              List.of(
                                  new SearchIndexField()
                                      .withName("title")
                                      .withDataType(SearchIndexDataType.TEXT))))));

      EntityInterface<?> apis = APIServiceTestFactory.createRest(ns);
      tagServices.add(() -> tag(admin.apiServices(), apis, HIDDEN_TAG));
      APICollection collection =
          admin
              .apiCollections()
              .create(
                  new CreateAPICollection()
                      .withName(prefix + "_users")
                      .withService(apis.getFullyQualifiedName()));
      assets.add(new InheritingAsset(OpenMetadataClient::apiCollections, collection));
      assets.add(
          new InheritingAsset(
              OpenMetadataClient::apiEndpoints,
              admin
                  .apiEndpoints()
                  .create(
                      new CreateAPIEndpoint()
                          .withName(prefix + "_getUser")
                          .withApiCollection(collection.getFullyQualifiedName())
                          .withEndpointURL(URI.create("https://example.com/users")))));

      Role denyRole = createDenyRole(admin, prefix, "matchAnyTag('" + HIDDEN_TAG + "')", cleanup);
      OpenMetadataClient restricted = createUserClient(admin, prefix, denyRole, cleanup);

      // Readable while nothing is tagged, so a 403 below can only come from the inherited tag.
      List<Executable> readable = new ArrayList<>();
      for (InheritingAsset asset : assets) {
        readable.add(
            () ->
                assertNotNull(
                    asset.client().apply(restricted).get(asset.id(), ""),
                    asset.type() + " is readable before its service is tagged"));
      }
      assertAll(readable);

      tagServices.forEach(Runnable::run);

      List<Executable> refused = new ArrayList<>();
      for (InheritingAsset asset : assets) {
        refused.add(
            () ->
                assertThrows(
                    ForbiddenException.class,
                    () -> asset.client().apply(restricted).get(asset.id(), ""),
                    asset.type() + " inherits its service's tag"));
      }
      assertAll(refused);
    } finally {
      drain(cleanup);
    }
  }

  /**
   * A condition naming a tag that does not exist is rejected when the policy is created, so a
   * typo cannot silently produce a rule that matches nothing.
   */
  @Test
  void serviceTagCondition_rejectsAnUnknownTagOnCreate(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = ns.shortPrefix();
    String unknownTag = "NoSuchClassification.NoSuchTag";

    OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () ->
                admin
                    .policies()
                    .create(
                        new CreatePolicy()
                            .withName(prefix + "_badTagPolicy")
                            .withDescription("Policy naming a tag that does not exist")
                            .withRules(
                                List.of(
                                    new Rule()
                                        .withName("denyUnknownServiceTag")
                                        .withEffect(Rule.Effect.DENY)
                                        .withOperations(List.of(MetadataOperation.VIEW_ALL))
                                        .withResources(List.of("All"))
                                        .withCondition(
                                            "matchAnyServiceTag('" + unknownTag + "')")))));

    // Assert on the reason, not just that creation failed — otherwise this test also passes when
    // the condition is rejected because the function itself is unknown.
    assertTrue(
        failure.getMessage() != null && failure.getMessage().contains(unknownTag),
        "rejection should name the unresolvable tag, but was: " + failure.getMessage());
  }

  /**
   * A connector type that matches no service makes a Deny rule quietly grant access, so a typo has
   * to be rejected when the policy is written -- the same guarantee the tag condition gives.
   */
  @Test
  void serviceTypeCondition_rejectsAnUnknownTypeOnCreate(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String prefix = ns.shortPrefix();

    OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () ->
                admin
                    .policies()
                    .create(
                        new CreatePolicy()
                            .withName(prefix + "_badTypePolicy")
                            .withDescription("Policy naming a connector type that does not exist")
                            .withRules(
                                List.of(
                                    new Rule()
                                        .withName("denyUnknownServiceType")
                                        .withEffect(Rule.Effect.DENY)
                                        .withOperations(List.of(MetadataOperation.VIEW_ALL))
                                        .withResources(List.of("All"))
                                        .withCondition("matchAnyServiceType('Snowflak')")))));

    assertTrue(
        failure.getMessage() != null && failure.getMessage().contains("Snowflak"),
        "rejection should name the unrecognised type, but was: " + failure.getMessage());
  }

  private Table createTable(OpenMetadataClient admin, String name, DatabaseSchema schema) {
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(COLUMN)));
  }

  /**
   * Issue #22095 ask 3: a tag on the service reaches its assets.
   *
   * <p>A table is the case that matters and the one most easily missed: {@code TableRepository}
   * loads its parent itself rather than going through the generic inheritance path, so it decides
   * for itself whether the parent is needed and which of its fields to project. The chain also has
   * to be walked transitively -- the tag is set on the service, and the table's parent is the
   * schema two hops below it.
   *
   * <p>No setting to turn on: inheritance is intrinsic, as it already is for owners and domains.
   */
  @Test
  void tagPropagation_carriesAServiceTagDownToItsTables(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_propagated", schema);

      assertFalse(
          tagFqnsOf(admin.tables().get(table.getId().toString(), TAGS_FIELD)).contains(HIDDEN_TAG),
          "nothing to inherit before the service is tagged");

      tagService(admin, service, HIDDEN_TAG);

      assertTrue(
          tagFqnsOf(admin.tables().get(table.getId().toString(), TAGS_FIELD)).contains(HIDDEN_TAG),
          "a tags-only read has to walk service -> database -> schema -> table");
      assertTrue(
          tagFqnsOf(admin.databaseSchemas().get(schema.getId().toString(), TAGS_FIELD))
              .contains(HIDDEN_TAG),
          "the intermediate schema inherits it too, which is what makes the walk transitive");

      untagService(admin, service);

      assertFalse(
          tagFqnsOf(admin.tables().get(table.getId().toString(), TAGS_FIELD)).contains(HIDDEN_TAG),
          "removing the service tag withdraws it from the assets that inherited it");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Editing an asset's own tags must not look like the inherited ones were taken away.
   *
   * <p>`original` carries its ancestors' tags as DERIVED because it comes off the read path, while
   * `updated` has been through prepareInternal, which strips them. Diffing those as-is recorded the
   * service's tag as removed from the table -- in the version history and in the ChangeEvent -- on
   * every tag edit, even though nothing was written and the tag was still there on the next read.
   */
  @Test
  void editingOwnTags_doesNotRecordTheInheritedOnesAsRemoved(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_diff", schema);
      tagService(admin, service, HIDDEN_TAG);

      Table inherited = admin.tables().get(table.getId().toString(), TAGS_FIELD);
      assertTrue(
          tagFqnsOf(inherited).contains(HIDDEN_TAG), "the table has something to inherit first");

      Table edited = addOwnTag(admin, inherited, TIER_TAG);

      assertTrue(
          tagFqnsOf(edited).contains(TIER_TAG), "the tag the caller actually added is recorded");
      assertFalse(
          changeDescriptionMentionsRemoval(edited, HIDDEN_TAG),
          "the inherited tag was never removed, so the change must not say it was");
      assertTrue(
          tagFqnsOf(admin.tables().get(table.getId().toString(), TAGS_FIELD)).contains(HIDDEN_TAG),
          "and it is still inherited after the edit");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * The mirror of the edit case, on the other side of the comparison.
   *
   * <p>`restoreEntity` builds `updated` as a deep copy of an `original` that inheritance has
   * already decorated, and never runs it through prepareInternal -- so the derived labels sit on
   * the updated side. Diffing only the original side would record the inherited tag as newly
   * added on every restore, the same false entry as the edit case but with the sign flipped.
   */
  @Test
  void restoringAnAsset_doesNotRecordTheInheritedTagsAsAdded(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Deque<Runnable> cleanup = new ArrayDeque<>();
    try {
      String prefix = ns.shortPrefix();
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table = createTable(admin, prefix + "_restored", schema);
      tagService(admin, service, HIDDEN_TAG);

      assertTrue(
          tagFqnsOf(admin.tables().get(table.getId().toString(), TAGS_FIELD)).contains(HIDDEN_TAG),
          "the table has something to inherit first");

      admin.tables().delete(table.getId().toString(), Map.of("hardDelete", "false"));
      Table restored = admin.tables().restore(table.getId().toString());

      assertFalse(
          changeDescriptionMentions(restored, HIDDEN_TAG, true),
          "the inherited tag was already there, so the restore must not record it as added");
      assertFalse(changeDescriptionMentions(restored, HIDDEN_TAG, false), "nor as removed");
      assertTrue(
          tagFqnsOf(admin.tables().get(table.getId().toString(), TAGS_FIELD)).contains(HIDDEN_TAG),
          "and it is still inherited after the restore");
    } finally {
      drain(cleanup);
    }
  }

  /**
   * Appends one tag of the asset's own, the way a UI edit does: the caller sends only the label it
   * is adding and leaves the inherited ones untouched.
   */
  private Table addOwnTag(OpenMetadataClient admin, Table table, String tagFqn) throws Exception {
    String patch =
        """
        [{"op":"add","path":"/tags/-","value":{"tagFQN":"%s","source":"Classification","labelType":"Manual","state":"Confirmed"}}]"""
            .formatted(tagFqn);
    return admin.tables().patch(table.getId().toString(), MAPPER.readTree(patch));
  }

  private boolean changeDescriptionMentionsRemoval(Table table, String tagFqn) {
    return changeDescriptionMentions(table, tagFqn, false);
  }

  /** Whether the recorded diff names {@code tagFqn} as added ({@code added}) or as removed. */
  private boolean changeDescriptionMentions(Table table, String tagFqn, boolean added) {
    ChangeDescription change = table.getChangeDescription();
    if (change == null) {
      return false;
    }
    return listOrEmpty(added ? change.getFieldsAdded() : change.getFieldsDeleted()).stream()
        .filter(field -> TAGS_FIELD.equals(field.getName()))
        .anyMatch(
            field ->
                String.valueOf(added ? field.getNewValue() : field.getOldValue()).contains(tagFqn));
  }

  private static Set<String> tagFqnsOf(Table table) {
    return tagFqns(table.getTags());
  }

  private static Set<String> tagFqnsOf(DatabaseSchema schema) {
    return tagFqns(schema.getTags());
  }

  private static Set<String> tagFqns(List<TagLabel> tags) {
    Set<String> fqns = new HashSet<>();
    if (tags != null) {
      tags.forEach(tag -> fqns.add(tag.getTagFQN()));
    }
    return fqns;
  }

  /** Tags a service through a PATCH, which works the same for every service type. */
  private static void tag(
      EntityServiceBase<?> services, EntityInterface<?> service, String tagFqn) {
    ArrayNode patch = MAPPER.createArrayNode();
    patch
        .addObject()
        .put("op", "add")
        .put("path", "/tags")
        .putArray("value")
        .add(
            MAPPER.valueToTree(
                new TagLabel()
                    .withTagFQN(tagFqn)
                    .withSource(TagLabel.TagSource.CLASSIFICATION)
                    .withLabelType(TagLabel.LabelType.MANUAL)
                    .withState(TagLabel.State.CONFIRMED)));
    services.patch(service.getId(), patch);
  }

  /** An asset read back through the client for its type. */
  private record InheritingAsset(
      Function<OpenMetadataClient, EntityServiceBase<?>> client, EntityInterface<?> entity) {
    String id() {
      return entity.getId().toString();
    }

    String type() {
      return entity.getClass().getSimpleName();
    }
  }

  private static Permission.Access accessOf(
      OpenMetadataClient client, String resource, UUID id, MetadataOperation operation)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/permissions/" + resource + "/" + id, null);
    return MAPPER.readValue(response, ResourcePermission.class).getPermissions().stream()
        .filter(permission -> permission.getOperation() == operation)
        .findFirst()
        .orElseThrow(() -> new AssertionError(operation + " is missing from " + response))
        .getAccess();
  }

  private static JsonNode addPolicyPatch(UUID policyId) {
    ArrayNode patch = MAPPER.createArrayNode();
    patch
        .addObject()
        .put("op", "add")
        .put("path", "/policies/-")
        .putObject("value")
        .put("id", policyId.toString())
        .put("type", "policy");
    return patch;
  }

  private static void replaceRuleCondition(
      OpenMetadataClient admin, UUID policyId, String condition) {
    ArrayNode patch = MAPPER.createArrayNode();
    patch
        .addObject()
        .put("op", "replace")
        .put("path", "/rules/0/condition")
        .put("value", condition);
    admin.policies().patch(policyId, patch);
  }

  private void awaitTableInSearch(
      OpenMetadataClient client,
      String prefix,
      Table table,
      boolean expected,
      Duration atMost,
      String alias) {
    Awaitility.await(alias)
        .atMost(atMost)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    expected,
                    searchFqns(client, TABLE_INDEX, prefix).contains(table.getFullyQualifiedName()),
                    alias));
  }

  private void tagService(OpenMetadataClient admin, DatabaseService service, String tagFqn) {
    DatabaseService fetched = admin.databaseServices().get(service.getId().toString(), TAGS_FIELD);
    List<TagLabel> tags =
        new ArrayList<>(fetched.getTags() == null ? List.of() : fetched.getTags());
    tags.add(
        new TagLabel()
            .withTagFQN(tagFqn)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));
    fetched.setTags(tags);
    admin.databaseServices().update(fetched.getId().toString(), fetched);
  }

  private void untagService(OpenMetadataClient admin, DatabaseService service) {
    DatabaseService fetched = admin.databaseServices().get(service.getId().toString(), TAGS_FIELD);
    fetched.setTags(List.of());
    admin.databaseServices().update(fetched.getId().toString(), fetched);
  }

  private Role createDenyRole(
      OpenMetadataClient admin, String prefix, String condition, Deque<Runnable> cleanup) {
    return createRole(admin, prefix, denyViewRule(condition), cleanup);
  }

  private static Rule denyViewRule(String condition) {
    return new Rule()
        .withName("denyViewByServiceAttribute")
        .withDescription("Deny viewing assets by an attribute of their service")
        .withEffect(Rule.Effect.DENY)
        .withOperations(List.of(MetadataOperation.VIEW_ALL))
        .withResources(List.of("All"))
        .withCondition(condition);
  }

  private Policy createPolicy(
      OpenMetadataClient admin, String name, Rule rule, Deque<Runnable> cleanup) {
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(name)
                    .withDescription("Service-attribute deny policy")
                    .withRules(List.of(rule)));
    cleanup.push(() -> admin.policies().delete(policy.getId()));
    return policy;
  }

  private Role createRole(
      OpenMetadataClient admin, String prefix, Rule rule, Deque<Runnable> cleanup) {
    Policy policy = createPolicy(admin, prefix + "_serviceDenyPolicy", rule, cleanup);

    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + "_serviceDenyRole")
                    .withDescription("Service-attribute deny role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    cleanup.push(() -> admin.roles().delete(role.getId()));
    return role;
  }

  private OpenMetadataClient createUserClient(
      OpenMetadataClient admin, String prefix, Role role, Deque<Runnable> cleanup) {
    String name = prefix + "_svcuser";
    String email = name + "@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId())));
    cleanup.push(() -> admin.users().delete(user.getId()));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private Set<String> searchFqns(OpenMetadataClient client, String index, String prefix)
      throws Exception {
    String response = client.search().query(prefix + "*").index(index).size(1000).execute();
    JsonNode hits = MAPPER.readTree(response).path("hits").path("hits");
    Set<String> fqns = new HashSet<>();
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (source.hasNonNull("fullyQualifiedName")) {
        fqns.add(source.get("fullyQualifiedName").asText());
      }
    }
    return fqns;
  }

  private boolean enableSearchAccessControl(OpenMetadataClient admin) throws Exception {
    String settingsJson =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);
    boolean original =
        Boolean.TRUE.equals(searchConfig.getGlobalSettings().getEnableAccessControl());
    searchConfig.getGlobalSettings().setEnableAccessControl(true);
    Settings updated =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    admin
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings",
            MAPPER.writeValueAsString(updated),
            RequestOptions.builder().build());
    return original;
  }

  private void restoreSearchAccessControl(OpenMetadataClient admin, boolean original) {
    if (!original) {
      try {
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());
      } catch (OpenMetadataException ignored) {
        // Best-effort restore: the next test re-reads the setting rather than trusting this.
      }
    }
  }

  private void drain(Deque<Runnable> cleanup) {
    while (!cleanup.isEmpty()) {
      try {
        cleanup.pop().run();
      } catch (OpenMetadataException ignored) {
        // Best-effort teardown; concurrent namespaces keep tests isolated regardless.
      }
    }
  }
}

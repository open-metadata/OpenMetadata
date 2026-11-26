package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import java.time.Duration;
import java.util.List;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Who may read and write a lineage edge, through each route that names it. The decision must not
 * depend on how a route finds the ends: by id or by name, for an admin or for any other caller, it
 * sees the same owners, tags and deleted state, and a missing end is reported before it.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class LineageEdgeAuthorizationIT {

  private static final String LINEAGE_PATH = "/v1/lineage";
  private static final String PII_SENSITIVE = "PII.Sensitive";
  private static final String DENIED_WHEN_SENSITIVE = "matchAnyTag('" + PII_SENSITIVE + "')";
  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
  private static final String DESCRIPTION_PATCH =
      "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"authorized\"}]";

  private record End(String type, String fullyQualifiedName) {}

  @Test
  void edgeRead_deniedOnEitherEnd_isForbidden(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table sensitive = createTable(ns, schema, "sensitive", List.of(piiSensitive()));
    Table dotted = createTable(ns, schema, "plain.v1", List.of());
    Table plain = createTable(ns, schema, "plain", List.of());
    addEdge(sensitive.getEntityReference(), dotted.getEntityReference());
    addEdge(plain.getEntityReference(), sensitive.getEntityReference());
    addEdge(dotted.getEntityReference(), plain.getEntityReference());
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("edgeread"),
            Entity.TABLE,
            MetadataOperation.VIEW_BASIC,
            DENIED_WHEN_SENSITIVE);

    assertEdgeReadStatus(denied, 403, sensitive, dotted);
    assertEdgeReadStatus(denied, 403, plain, sensitive);
    assertEdgeReadable(denied, dotted, plain);
  }

  @Test
  void edgeRead_inheritedSchemaTag_isDenied(TestNamespace ns) {
    DatabaseSchema plainSchema = DatabaseSchemaTestFactory.createSimple(ns);
    DatabaseSchema taggedSchema =
        SdkClients.adminClient()
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("tagged"))
                    .withDatabase(plainSchema.getDatabase().getFullyQualifiedName())
                    .withTags(List.of(piiSensitive())));
    Table inheriting = createTable(ns, taggedSchema, "inheriting", List.of());
    Table plain = createTable(ns, plainSchema, "plain", List.of());
    addEdge(inheriting.getEntityReference(), plain.getEntityReference());
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("inherited"),
            Entity.TABLE,
            MetadataOperation.VIEW_BASIC,
            DENIED_WHEN_SENSITIVE);

    assertEdgeReadStatus(denied, 403, inheriting, plain);
    assertEdgeReadable(SdkClients.ingestionBotClient(), inheriting, plain);
  }

  @Test
  void edgeWrite_ownerConditionedDeny_seesDirectAndInheritedOwners(TestNamespace ns) {
    User user =
        DenyPolicyPrincipals.userDeniedWhen(
            ns.shortPrefix("owner"), Entity.TABLE, MetadataOperation.EDIT_LINEAGE, "!isOwner()");
    OpenMetadataClient owner =
        SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
    EntityReference ownerReference = user.getEntityReference();
    DatabaseSchema plainSchema = DatabaseSchemaTestFactory.createSimple(ns);
    DatabaseSchema ownedSchema =
        SdkClients.adminClient()
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("owned"))
                    .withDatabase(plainSchema.getDatabase().getFullyQualifiedName())
                    .withOwners(List.of(ownerReference)));
    Table direct = createOwnedTable(ns, plainSchema, "direct", List.of(ownerReference));
    Table inherited = createOwnedTable(ns, ownedSchema, "inherited", List.of());
    String edgePath = LINEAGE_PATH + byNamePath(direct, inherited);

    send(owner, HttpMethod.PUT, edgePath, rewrite(), null);
    send(owner, HttpMethod.PATCH, edgePath, JsonUtils.readTree(DESCRIPTION_PATCH), JSON_PATCH);
    send(owner, HttpMethod.DELETE, edgePath, null, null);
    SdkClients.adminClient()
        .databaseSchemas()
        .patch(
            ownedSchema.getId(),
            JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/owners/0\"}]"));

    assertStatus(owner, 403, HttpMethod.PUT, edgePath, rewrite(), null);
  }

  @Test
  void byName_missingEnd_is404BeforeAuthorization(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table from = createTable(ns, schema, "from", List.of());
    Table to = createTable(ns, schema, "to", List.of());
    addEdge(from.getEntityReference(), to.getEntityReference());
    End fromEnd = new End(Entity.TABLE, from.getFullyQualifiedName());
    End missing =
        new End(
            Entity.TABLE,
            FullyQualifiedName.add(schema.getFullyQualifiedName(), ns.prefix("missing")));
    OpenMetadataClient cannotView =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("missview"), Entity.TABLE, MetadataOperation.VIEW_BASIC);
    OpenMetadataClient cannotEdit =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("missedit"), Entity.TABLE, MetadataOperation.EDIT_LINEAGE);
    String existing = byNamePath(from, to);

    assertStatus(
        cannotView, 403, HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + existing, null, null);
    assertStatus(cannotEdit, 403, HttpMethod.PUT, LINEAGE_PATH + existing, rewrite(), null);

    String toMissing = byNamePath(fromEnd, missing);
    assertStatus(
        cannotView, 404, HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + toMissing, null, null);
    assertStatus(cannotEdit, 404, HttpMethod.PUT, LINEAGE_PATH + toMissing, rewrite(), null);
    assertStatus(
        cannotEdit,
        404,
        HttpMethod.PATCH,
        LINEAGE_PATH + toMissing,
        JsonUtils.readTree(DESCRIPTION_PATCH),
        JSON_PATCH);
    assertStatus(
        cannotEdit,
        404,
        HttpMethod.DELETE,
        LINEAGE_PATH + byNamePath(missing, fromEnd),
        null,
        null);
    assertStatus(cannotEdit, 404, HttpMethod.DELETE, sourceDeletionPath(missing), null, null);
  }

  /**
   * A rename on another server reaches this one only through the database, and nothing evicts this
   * server's entry for the old name. So the rename is written straight to the row here, and the old
   * name's entry is put back before each request. A route that names an end must still answer from
   * the database: the old name is gone for every caller, and the new name finds the edge.
   */
  @Test
  void byName_renamedOnAnotherServer_oldNameIsNotFoundForEveryCaller(TestNamespace ns) {
    Metric metric =
        SdkClients.adminClient()
            .metrics()
            .create(new CreateMetric().withName(ns.prefix("before_rename")));
    Table table =
        createTable(ns, DatabaseSchemaTestFactory.createSimple(ns), "metric_to", List.of());
    addEdge(metric.getEntityReference(), table.getEntityReference());
    End tableEnd = new End(Entity.TABLE, table.getFullyQualifiedName());
    End oldName = new End(Entity.METRIC, metric.getFullyQualifiedName());
    End newName = new End(Entity.METRIC, ns.prefix("after_rename"));
    String staleRow = renameInDatabaseOnly(metric, newName.fullyQualifiedName());
    String oldNamePath = byNamePath(oldName, tableEnd);

    for (OpenMetadataClient caller :
        List.of(SdkClients.ingestionBotClient(), SdkClients.adminClient())) {
      cacheName(oldName, staleRow);
      assertStatus(
          caller, 404, HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + oldNamePath, null, null);
      cacheName(oldName, staleRow);
      assertStatus(caller, 404, HttpMethod.PUT, LINEAGE_PATH + oldNamePath, rewrite(), null);
      cacheName(oldName, staleRow);
      assertStatus(caller, 404, HttpMethod.DELETE, LINEAGE_PATH + oldNamePath, null, null);
    }
    assertEdgeBody(
        send(
            SdkClients.ingestionBotClient(),
            HttpMethod.GET,
            LINEAGE_PATH + "/getLineageEdge" + byNamePath(newName, tableEnd),
            null,
            null));
  }

  @Test
  void byName_softDeletedEnd_is404ButDeletable(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table adminSource = createTable(ns, schema, "admin_src", List.of());
    Table botSource = createTable(ns, schema, "bot_src", List.of());
    Table deleted = createTable(ns, schema, "deleted", List.of());
    addEdge(adminSource.getEntityReference(), deleted.getEntityReference());
    addEdge(botSource.getEntityReference(), deleted.getEntityReference());
    SdkClients.adminClient().tables().delete(deleted.getId());
    OpenMetadataClient admin = SdkClients.adminClient();
    OpenMetadataClient bot = SdkClients.ingestionBotClient();

    assertSoftDeletedEndIsNotFound(admin, byNamePath(adminSource, deleted));
    assertSoftDeletedEndIsNotFound(bot, byNamePath(botSource, deleted));

    send(admin, HttpMethod.DELETE, LINEAGE_PATH + byNamePath(adminSource, deleted), null, null);
    send(bot, HttpMethod.DELETE, LINEAGE_PATH + byNamePath(botSource, deleted), null, null);
    send(
        bot,
        HttpMethod.DELETE,
        sourceDeletionPath(new End(Entity.TABLE, deleted.getFullyQualifiedName())),
        null,
        null);
    assertStatus(admin, 404, HttpMethod.GET, edgeReadByIdPath(adminSource, deleted), null, null);
  }

  @Test
  void byName_wrongTypeForFqn_is404(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table from = createTable(ns, schema, "from", List.of());
    Table to = createTable(ns, schema, "to", List.of());
    addEdge(from.getEntityReference(), to.getEntityReference());
    End toEnd = new End(Entity.TABLE, to.getFullyQualifiedName());
    String asDashboard = byNamePath(new End(Entity.DASHBOARD, from.getFullyQualifiedName()), toEnd);
    String asUnknownType =
        byNamePath(new End("notAnEntityType", from.getFullyQualifiedName()), toEnd);

    for (OpenMetadataClient caller :
        List.of(SdkClients.adminClient(), SdkClients.ingestionBotClient())) {
      assertStatus(
          caller, 404, HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + asDashboard, null, null);
      assertStatus(caller, 404, HttpMethod.PUT, LINEAGE_PATH + asUnknownType, rewrite(), null);
    }
  }

  @Test
  void pipelineEndByName_isAuthorizedLikeATable(TestNamespace ns) {
    Pipeline pipeline =
        SdkClients.adminClient()
            .pipelines()
            .create(
                new CreatePipeline()
                    .withName(ns.prefix("pipe"))
                    .withService(
                        PipelineServiceTestFactory.createAirflow(ns).getFullyQualifiedName()));
    Table table = createTable(ns, DatabaseSchemaTestFactory.createSimple(ns), "target", List.of());
    addEdge(pipeline.getEntityReference(), table.getEntityReference());
    End pipelineEnd = new End(Entity.PIPELINE, pipeline.getFullyQualifiedName());
    End tableEnd = new End(Entity.TABLE, table.getFullyQualifiedName());
    String byName = LINEAGE_PATH + "/getLineageEdge" + byNamePath(pipelineEnd, tableEnd);
    String byId = LINEAGE_PATH + "/getLineageEdge/" + pipeline.getId() + "/" + table.getId();
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("pipeend"), Entity.PIPELINE, MetadataOperation.VIEW_BASIC);

    assertStatus(denied, 403, HttpMethod.GET, byName, null, null);
    assertStatus(denied, 403, HttpMethod.GET, byId, null, null);
    assertEdgeBody(send(SdkClients.ingestionBotClient(), HttpMethod.GET, byName, null, null));
    assertEdgeBody(send(SdkClients.adminClient(), HttpMethod.GET, byName, null, null));
  }

  private static void assertSoftDeletedEndIsNotFound(OpenMetadataClient caller, String edgePath) {
    assertStatus(
        caller, 404, HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + edgePath, null, null);
    assertStatus(caller, 404, HttpMethod.PUT, LINEAGE_PATH + edgePath, rewrite(), null);
    assertStatus(
        caller,
        404,
        HttpMethod.PATCH,
        LINEAGE_PATH + edgePath,
        JsonUtils.readTree(DESCRIPTION_PATCH),
        JSON_PATCH);
  }

  private static void assertEdgeReadStatus(
      OpenMetadataClient caller, int status, Table from, Table to) {
    assertStatus(caller, status, HttpMethod.GET, edgeReadByIdPath(from, to), null, null);
    assertStatus(
        caller,
        status,
        HttpMethod.GET,
        LINEAGE_PATH + "/getLineageEdge" + byNamePath(from, to),
        null,
        null);
  }

  private static void assertEdgeReadable(OpenMetadataClient caller, Table from, Table to) {
    assertEdgeBody(send(caller, HttpMethod.GET, edgeReadByIdPath(from, to), null, null));
    assertEdgeBody(
        send(
            caller,
            HttpMethod.GET,
            LINEAGE_PATH + "/getLineageEdge" + byNamePath(from, to),
            null,
            null));
  }

  private static void assertEdgeBody(String response) {
    assertTrue(JsonUtils.readTree(response).has("edge"), response);
  }

  private static void assertStatus(
      OpenMetadataClient caller,
      int status,
      HttpMethod method,
      String path,
      Object body,
      RequestOptions options) {
    try {
      send(caller, method, path, body, options);
      fail("Expected HTTP " + status + " for " + method + " " + path + " but the call succeeded");
    } catch (OpenMetadataException e) {
      assertEquals(status, e.getStatusCode(), method + " " + path + ": " + e.getMessage());
    }
  }

  private static String send(
      OpenMetadataClient caller,
      HttpMethod method,
      String path,
      Object body,
      RequestOptions options) {
    return caller.getHttpClient().executeForString(method, path, body, options);
  }

  private static Table createTable(
      TestNamespace ns, DatabaseSchema schema, String baseName, List<TagLabel> tags) {
    return SdkClients.adminClient()
        .tables()
        .create(tableRequest(ns, schema, baseName).withTags(tags));
  }

  private static Table createOwnedTable(
      TestNamespace ns, DatabaseSchema schema, String baseName, List<EntityReference> owners) {
    return SdkClients.adminClient()
        .tables()
        .create(tableRequest(ns, schema, baseName).withOwners(owners));
  }

  private static CreateTable tableRequest(
      TestNamespace ns, DatabaseSchema schema, String baseName) {
    return new CreateTable()
        .withName(ns.prefix(baseName))
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
  }

  /** Renames the metric's row as another server would, returning the row as it was before. */
  private static String renameInDatabaseOnly(Metric metric, String newName) {
    EntityDAO<Metric> metrics = Entity.getCollectionDAO().metricDAO();
    Metric row = metrics.findEntityById(metric.getId());
    String staleRow = JsonUtils.pojoToJson(row);
    metrics.update(row.withName(newName).withFullyQualifiedName(newName));
    return staleRow;
  }

  /** The entry this server's name cache keeps for {@code end} until something evicts it. */
  private static void cacheName(End end, String row) {
    EntityRepository.CACHE_WITH_NAME.put(
        new ImmutablePair<>(end.type(), end.fullyQualifiedName()), row);
  }

  private static LineageDetails rewrite() {
    return new LineageDetails().withSqlQuery("select 1");
  }

  private static TagLabel piiSensitive() {
    return new TagLabel()
        .withTagFQN(PII_SENSITIVE)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static void addEdge(EntityReference from, EntityReference to) {
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from)
                    .withToEntity(to)
                    .withLineageDetails(
                        new LineageDetails().withSource(LineageDetails.Source.MANUAL)));
    Awaitility.await("lineage edge between freshly created entities")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              SdkClients.adminClient().lineage().addLineage(addLineage);
              return true;
            });
  }

  private static String edgeReadByIdPath(Table from, Table to) {
    return LINEAGE_PATH + "/getLineageEdge/" + from.getId() + "/" + to.getId();
  }

  private static String byNamePath(Table from, Table to) {
    return byNamePath(
        new End(Entity.TABLE, from.getFullyQualifiedName()),
        new End(Entity.TABLE, to.getFullyQualifiedName()));
  }

  private static String byNamePath(End from, End to) {
    return "/"
        + from.type()
        + "/name/"
        + encodeURIComponent(from.fullyQualifiedName())
        + "/"
        + to.type()
        + "/name/"
        + encodeURIComponent(to.fullyQualifiedName());
  }

  private static String sourceDeletionPath(End end) {
    return LINEAGE_PATH
        + "/source/name/"
        + end.type()
        + "/"
        + encodeURIComponent(end.fullyQualifiedName())
        + "/type/"
        + LineageDetails.Source.MANUAL.value();
  }
}

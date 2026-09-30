package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatus;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatusFor;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Covers /v1/columns for the entity types it did not serve before: their inline children are topic
 * and apiEndpoint schema fields, container data-model columns, mlmodel features, pipeline tasks and
 * searchIndex fields rather than table columns.
 *
 * <p>ColumnResourceIT stays byte-unmodified as the frozen contract for table and dashboardDataModel;
 * this file is the contract for everything the endpoint gained.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnChildTypesIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  public record ChildFixture(String entityType, String childFqn, String parentFqn) {}

  static Stream<String> newEntityTypes() {
    return Stream.of("topic", "pipeline", "mlmodel", "container", "searchIndex", "apiEndpoint");
  }

  /** Creates one parent entity carrying one child of the given type and returns their FQNs. */
  public static ChildFixture createFixture(String entityType, TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    return switch (entityType) {
      case "topic" -> {
        MessagingService service = MessagingServiceTestFactory.createKafka(ns);
        Topic topic =
            client
                .topics()
                .create(
                    new CreateTopic()
                        .withName(ns.prefix("orders"))
                        .withService(service.getFullyQualifiedName())
                        .withPartitions(1)
                        .withMessageSchema(
                            new MessageSchema()
                                .withSchemaType(SchemaType.JSON)
                                .withSchemaFields(
                                    List.of(
                                        new Field()
                                            .withName("customer_id")
                                            .withDataType(FieldDataType.STRING)))));
        yield new ChildFixture(
            entityType,
            topic.getFullyQualifiedName() + ".customer_id",
            topic.getFullyQualifiedName());
      }
      case "pipeline" -> {
        PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
        Pipeline pipeline =
            client
                .pipelines()
                .create(
                    new CreatePipeline()
                        .withName(ns.prefix("etl"))
                        .withService(service.getFullyQualifiedName())
                        .withTasks(List.of(new Task().withName("extract"))));
        yield new ChildFixture(
            entityType,
            pipeline.getFullyQualifiedName() + ".extract",
            pipeline.getFullyQualifiedName());
      }
      case "mlmodel" -> {
        MlModelService service = MlModelServiceTestFactory.createMlflow(ns);
        MlModel model =
            client
                .mlModels()
                .create(
                    new CreateMlModel()
                        .withName(ns.prefix("churn"))
                        .withService(service.getFullyQualifiedName())
                        .withAlgorithm("xgboost")
                        .withMlFeatures(List.of(new MlFeature().withName("age"))));
        yield new ChildFixture(
            entityType, model.getFullyQualifiedName() + ".age", model.getFullyQualifiedName());
      }
      case "container" -> {
        StorageService service = StorageServiceTestFactory.createS3(ns);
        Container container =
            client
                .containers()
                .create(
                    new CreateContainer()
                        .withName(ns.prefix("bucket"))
                        .withService(service.getFullyQualifiedName())
                        .withDataModel(
                            new ContainerDataModel()
                                .withColumns(
                                    List.of(
                                        new Column()
                                            .withName("payload")
                                            .withDataType(ColumnDataType.STRING)))));
        yield new ChildFixture(
            entityType,
            container.getFullyQualifiedName() + ".payload",
            container.getFullyQualifiedName());
      }
      case "searchIndex" -> {
        SearchService service = SearchServiceTestFactory.createElasticSearch(ns);
        SearchIndex index =
            client
                .searchIndexes()
                .create(
                    new CreateSearchIndex()
                        .withName(ns.prefix("products"))
                        .withService(service.getFullyQualifiedName())
                        .withFields(
                            List.of(
                                new SearchIndexField()
                                    .withName("title")
                                    .withDataType(SearchIndexDataType.TEXT))));
        yield new ChildFixture(
            entityType, index.getFullyQualifiedName() + ".title", index.getFullyQualifiedName());
      }
      case "apiEndpoint" -> {
        ApiService service = APIServiceTestFactory.createRest(ns);
        APICollection collection =
            client
                .apiCollections()
                .create(
                    new CreateAPICollection()
                        .withName(ns.prefix("users"))
                        .withService(service.getFullyQualifiedName()));
        APIEndpoint endpoint =
            client
                .apiEndpoints()
                .create(
                    new CreateAPIEndpoint()
                        .withName(ns.prefix("getUser"))
                        .withApiCollection(collection.getFullyQualifiedName())
                        .withEndpointURL(URI.create("https://example.com/users"))
                        .withResponseSchema(
                            new APISchema()
                                .withSchemaFields(
                                    List.of(
                                        new Field()
                                            .withName("userId")
                                            .withDataType(FieldDataType.STRING)))));
        // An apiEndpoint schema field's FQN carries the schema segment: the endpoint has two
        // schemas and a bare <endpoint>.<field> would be ambiguous between them.
        yield new ChildFixture(
            entityType,
            endpoint.getFullyQualifiedName() + ".responseSchema.userId",
            endpoint.getFullyQualifiedName());
      }
      default -> throw new IllegalArgumentException("No fixture for " + entityType);
    };
  }

  @ParameterizedTest
  @MethodSource("newEntityTypes")
  void putDescription_thenGet_roundTrips(String entityType, TestNamespace ns) throws Exception {
    ChildFixture fixture = createFixture(entityType, ns);
    OpenMetadataClient client = SdkClients.adminClient();

    String body =
        OBJECT_MAPPER.writeValueAsString(Map.of("description", "Written via /v1/columns"));
    String putResponse =
        client
            .getHttpClient()
            .executeForString(HttpMethod.PUT, childUrl(fixture) + "&changeSource=Automated", body);
    assertTrue(
        putResponse.contains("Written via /v1/columns"),
        "the PUT response must carry the written child: " + putResponse);

    // The read is the part that proves the write landed on the entity rather than on a copy.
    String getResponse =
        client.getHttpClient().executeForString(HttpMethod.GET, childUrl(fixture), null);
    JsonNode child = OBJECT_MAPPER.readTree(getResponse);
    assertEquals("Written via /v1/columns", child.get("description").asText());
  }

  @ParameterizedTest
  @MethodSource("newEntityTypes")
  void putUnknownChildName_returns404(String entityType, TestNamespace ns) throws Exception {
    // A child FQN under a real parent that names nothing must 404, not create a child or 500.
    ChildFixture fixture = createFixture(entityType, ns);
    String missing = fixture.parentFqn() + ".no_such_child";
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "x"));
    assertHttpStatus(
        404,
        HttpMethod.PUT,
        "/v1/columns/name/" + encodeURIComponent(missing) + "?entityType=" + entityType,
        body);
  }

  @ParameterizedTest
  @MethodSource("newEntityTypes")
  void putConstraint_rejected400ForNewTypes(String entityType, TestNamespace ns) throws Exception {
    ChildFixture fixture = createFixture(entityType, ns);
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("constraint", "PRIMARY_KEY"));
    assertHttpStatus(400, HttpMethod.PUT, childUrl(fixture), body);
  }

  @ParameterizedTest
  @MethodSource("newEntityTypes")
  void putExtension_rejected400ForNewTypes(String entityType, TestNamespace ns) throws Exception {
    ChildFixture fixture = createFixture(entityType, ns);
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("extension", Map.of("anything", "x")));
    assertHttpStatus(400, HttpMethod.PUT, childUrl(fixture), body);
  }

  @Test
  void putDisplayName_roundTripsForMlmodel(TestNamespace ns) throws Exception {
    // mlFeature carries displayName like every other child type, so the write must stick
    // rather than be dropped silently or rejected.
    ChildFixture fixture = createFixture("mlmodel", ns);
    OpenMetadataClient client = SdkClients.adminClient();
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("displayName", "Customer age"));
    String putResponse =
        client.getHttpClient().executeForString(HttpMethod.PUT, childUrl(fixture), body);
    assertEquals(
        "Customer age",
        OBJECT_MAPPER.readTree(putResponse).path("displayName").asText(),
        "the write must apply displayName to the returned feature: " + putResponse);

    String getResponse =
        client.getHttpClient().executeForString(HttpMethod.GET, childUrl(fixture), null);
    assertEquals(
        "Customer age",
        OBJECT_MAPPER.readTree(getResponse).path("displayName").asText(),
        "displayName must survive the round trip: " + getResponse);
  }

  @Test
  void putDisplayName_acceptedForATypeThatHasIt(TestNamespace ns) throws Exception {
    ChildFixture fixture = createFixture("pipeline", ns);
    OpenMetadataClient client = SdkClients.adminClient();
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("displayName", "Extract step"));
    String putResponse =
        client.getHttpClient().executeForString(HttpMethod.PUT, childUrl(fixture), body);
    assertTrue(
        OBJECT_MAPPER.readTree(putResponse).path("displayName").asText().equals("Extract step"),
        "the write must apply displayName to the returned child: " + putResponse);

    String getResponse =
        client.getHttpClient().executeForString(HttpMethod.GET, childUrl(fixture), null);
    assertEquals(
        "Extract step",
        OBJECT_MAPPER.readTree(getResponse).path("displayName").asText(),
        "displayName must survive the round trip: " + getResponse);
  }

  @Test
  void unknownEntityType_rejected400(TestNamespace ns) throws Exception {
    // chart has its own entity and RBAC, so it is deliberately not an inline-child type here.
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "x"));
    assertHttpStatus(400, HttpMethod.PUT, "/v1/columns/name/a.b.c?entityType=chart", body);
  }

  @Test
  void unknownChangeSource_rejected400(TestNamespace ns) throws Exception {
    ChildFixture fixture = createFixture("topic", ns);
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "x"));
    assertHttpStatus(400, HttpMethod.PUT, childUrl(fixture) + "&changeSource=Invented", body);
  }

  @ParameterizedTest
  @MethodSource("newEntityTypes")
  void negativeAuthz_denyEditDescriptionUserCannotWriteChild(String entityType, TestNamespace ns)
      throws Exception {
    ChildFixture fixture = createFixture(entityType, ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("deny_" + entityType), entityType, MetadataOperation.EDIT_DESCRIPTION);

    // Positive control first. Without it this test passes for the wrong reason: a denied VIEW_BASIC
    // inside the parent fetch produces the same 403 as a denied EDIT_DESCRIPTION, so a principal
    // that simply cannot see the parent would satisfy the assertion below while proving nothing.
    String readBack =
        denied.getHttpClient().executeForString(HttpMethod.GET, childUrl(fixture), null);
    assertTrue(
        OBJECT_MAPPER.readTree(readBack).has("name"),
        "the denied principal must still be able to GET the child; if this fails the 403 below "
            + "is a VIEW_BASIC denial, not an EDIT_DESCRIPTION denial");

    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "should be denied"));
    assertHttpStatusFor(denied, 403, HttpMethod.PUT, childUrl(fixture), body);
  }

  @Test
  void changeSource_isRecordedOnParentVersionHistory(TestNamespace ns) throws Exception {
    ChildFixture fixture = createFixture("topic", ns);
    OpenMetadataClient client = SdkClients.adminClient();
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "attributed"));
    client
        .getHttpClient()
        .executeForString(HttpMethod.PUT, childUrl(fixture) + "&changeSource=Automated", body);

    // changeSummary has its own endpoint; it is not a projectable field on the entity.
    String topic =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/topics/name/" + encodeURIComponent(fixture.parentFqn()), null);
    String topicId = OBJECT_MAPPER.readTree(topic).get("id").asText();
    String summaryResponse =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/changeSummary/topic/" + topicId, null);
    JsonNode changeSummary = OBJECT_MAPPER.readTree(summaryResponse).get("changeSummary");
    assertNotNull(changeSummary, "the changeSummary endpoint must return a changeSummary object");

    // Assert the entry for THIS child. A body-wide contains("Automated") would pass on any
    // unrelated field's change source.
    String childName = fixture.childFqn().substring(fixture.parentFqn().length() + 1);
    JsonNode entry = null;
    List<String> seenKeys = new ArrayList<>();
    Iterator<String> keys = changeSummary.fieldNames();
    while (keys.hasNext()) {
      String key = keys.next();
      seenKeys.add(key);
      if (entry == null && key.contains(childName) && key.endsWith(".description")) {
        entry = changeSummary.get(key);
      }
    }
    assertNotNull(
        entry,
        "changeSummary must carry an entry for the written child's description; keys were "
            + seenKeys);
    assertEquals("Automated", entry.get("changeSource").asText());
  }

  @Test
  void getChildren_mlmodelFeatureTags_surviveAFieldsTagsRequest(TestNamespace ns) throws Exception {
    // mlmodel keeps its features' tags in the model's stored JSON, not in tag_usage:
    // MlModelRepository has no applyTags override. Hydrating the page from tag_usage therefore
    // missed and set an empty list, so fields=tags returned FEWER tags than omitting it, and a
    // caller that read the list, appended to it and PUT it back erased the feature's tags.
    ChildFixture fixture = createFixture("mlmodel", ns);
    OpenMetadataClient client = SdkClients.adminClient();
    String body =
        OBJECT_MAPPER.writeValueAsString(
            Map.of(
                "tags",
                List.of(
                    Map.of(
                        "tagFQN", "PII.Sensitive",
                        "source", "Classification",
                        "labelType", "Manual",
                        "state", "Confirmed"))));
    client.getHttpClient().executeForString(HttpMethod.PUT, childUrl(fixture), body);

    String page =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/mlmodels/name/"
                    + encodeURIComponent(fixture.parentFqn())
                    + "/columns?fields=tags",
                null);
    List<String> tagFqns = new ArrayList<>();
    OBJECT_MAPPER
        .readTree(page)
        .path("data")
        .forEach(
            feature -> feature.path("tags").forEach(t -> tagFqns.add(t.path("tagFQN").asText())));
    assertTrue(
        tagFqns.contains("PII.Sensitive"), "fields=tags must not blank a feature's tags: " + page);
  }

  private String childUrl(ChildFixture fixture) {
    return "/v1/columns/name/"
        + encodeURIComponent(fixture.childFqn())
        + "?entityType="
        + fixture.entityType();
  }
}

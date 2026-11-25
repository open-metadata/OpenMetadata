package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;
import org.openmetadata.service.Entity;

/** Fixtures and reads shared by the domain lineage ITs, all through the API as an admin. */
final class DomainLineageSteps {

  static final ObjectMapper MAPPER = new ObjectMapper();

  private DomainLineageSteps() {}

  static DatabaseSchema newSchema(TestNamespace ns) {
    return DatabaseSchemaTestFactory.createSimple(
        ns, DatabaseServiceTestFactory.createPostgres(ns));
  }

  static Table table(TestNamespace ns, DatabaseSchema schema, String name) {
    return client().tables().create(tableRequest(schema, ns.prefix(name)));
  }

  static CreateTable tableRequest(DatabaseSchema schema, String name) {
    return new CreateTable()
        .withName(name)
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new ColumnBuilder("id", "VARCHAR").dataLength(256).build()));
  }

  static Domain domain(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DOMAIN,
        client()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(name))
                    .withDescription("Domain lineage")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)));
  }

  static Table setTableDomains(Table table, Domain... domains) {
    return setDomains(client().tables(), table.getId(), domains);
  }

  static <T> T setDomains(EntityServiceBase<T> service, UUID id, Domain... domains) {
    ArrayNode refs = MAPPER.createArrayNode();
    for (Domain domain : domains) {
      refs.addObject().put("id", domain.getId().toString()).put("type", Entity.DOMAIN);
    }
    return service.patch(id, patchAdd("/domains", refs));
  }

  static JsonNode patchAdd(String path, JsonNode value) {
    ArrayNode patch = MAPPER.createArrayNode();
    patch.addObject().put("op", "add").put("path", path).set("value", value);
    return patch;
  }

  static void putEdge(EntityInterface<?> from, EntityInterface<?> to) {
    client()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(new LineageDetails())));
  }

  static void assertSucceeded(BulkOperationResult result) {
    assertEquals(ApiStatus.SUCCESS, result.getStatus(), JsonUtils.pojoToJson(result));
  }

  static void deleteEdge(EntityInterface<?> from, EntityInterface<?> to) {
    client()
        .lineage()
        .deleteLineage(
            from.getEntityReference().getType() + ":" + from.getId(),
            to.getEntityReference().getType() + ":" + to.getId());
  }

  static LineageDetails edge(Domain from, Domain to) {
    try {
      String response =
          client().getHttpClient().executeForString(HttpMethod.GET, edgePath(from, to), null);
      return JsonUtils.readValue(
          MAPPER.readTree(response).get("edge").toString(), LineageDetails.class);
    } catch (Exception e) {
      throw new AssertionError("No lineage edge between the domains", e);
    }
  }

  static Integer assetEdges(Domain from, Domain to) {
    return edge(from, to).getAssetEdges();
  }

  static void assertEdgeAbsent(Domain from, Domain to) {
    OpenMetadataException notFound =
        assertThrows(
            OpenMetadataException.class,
            () ->
                client()
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, edgePath(from, to), null));
    assertEquals(404, notFound.getStatusCode());
  }

  static DataProduct dataProduct(TestNamespace ns, Domain domain) {
    return client()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("product"))
                .withDescription("Domain lineage refcount")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  /** The domain view reads search, where the edge lives on the downstream domain's document. */
  static void awaitPlatformLineage(Domain from, Domain to, boolean shown) {
    Awaitility.await("domain view shows " + shown)
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(() -> assertEquals(shown, platformLineageShows(from, to)));
  }

  private static boolean platformLineageShows(Domain from, Domain to) throws Exception {
    String filter =
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"id.keyword\":\"" + to.getId() + "\"}}]}}}";
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("view", Entity.DOMAIN)
            .queryParam("query_filter", filter)
            .build();
    JsonNode result =
        MAPPER.readTree(
            client()
                .getHttpClient()
                .executeForString(HttpMethod.GET, "/v1/lineage/getPlatformLineage", null, options));
    assertTrue(result.path("nodes").has(to.getFullyQualifiedName()), result.toString());
    boolean shown = false;
    for (JsonNode edge : result.path("upstreamEdges")) {
      shown |=
          from.getId().toString().equals(edge.path("fromEntity").path("id").asText())
              && to.getId().toString().equals(edge.path("toEntity").path("id").asText());
    }
    assertFalse(result.path("upstreamEdges").isMissingNode(), result.toString());
    return shown;
  }

  private static String edgePath(Domain from, Domain to) {
    return "/v1/lineage/getLineageEdge/" + from.getId() + "/" + to.getId();
  }

  static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}

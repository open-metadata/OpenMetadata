package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.EntityUsage;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Some indexed fields are loaded only when a read asks for them. A reindex, and the live paths that
 * re-read an entity with its index's field list, did not ask, so the search document lost usage
 * for pipelines, dashboards and ML models, and the users of a query (#34639).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ReindexFieldSetSearchDocIT {

  private static final String QUERY_INDEX = "query_search_index";
  private static final int DAILY_USAGE = 7;

  @Test
  void usageReport_reachesPipelineSearchDoc(TestNamespace ns) {
    Pipeline pipeline =
        SdkClients.adminClient()
            .pipelines()
            .create(
                new CreatePipeline()
                    .withName(ns.prefix("pipeline"))
                    .withService(
                        PipelineServiceTestFactory.createAirflow(ns).getFullyQualifiedName()));
    assertUsageReachesSearchDoc(Entity.PIPELINE, "pipeline_search_index", pipeline.getId());
  }

  @Test
  void usageReport_reachesDashboardSearchDoc(TestNamespace ns) {
    Dashboard dashboard =
        SdkClients.adminClient()
            .dashboards()
            .create(
                new CreateDashboard()
                    .withName(ns.prefix("dashboard"))
                    .withService(
                        DashboardServiceTestFactory.createMetabase(ns).getFullyQualifiedName()));
    assertUsageReachesSearchDoc(Entity.DASHBOARD, "dashboard_search_index", dashboard.getId());
  }

  @Test
  void usageReport_reachesMlModelSearchDoc(TestNamespace ns) {
    MlModel mlModel =
        SdkClients.adminClient()
            .mlModels()
            .create(
                new CreateMlModel()
                    .withName(ns.prefix("mlmodel"))
                    .withAlgorithm("regression")
                    .withService(
                        MlModelServiceTestFactory.createMlflow(ns).getFullyQualifiedName()));
    assertUsageReachesSearchDoc(Entity.MLMODEL, "mlmodel_search_index", mlModel.getId());
  }

  @Test
  void singleEntityReindex_keepsQueryUsers(TestNamespace ns) throws IOException {
    Query query =
        SdkClients.adminClient()
            .queries()
            .create(
                new CreateQuery()
                    .withName(ns.prefix("query"))
                    .withQuery("SELECT 1")
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName())
                    .withUsers(List.of(SharedEntities.get().USER1.getName())));
    awaitDoc(QUERY_INDEX, query.getId(), ReindexFieldSetSearchDocIT::assertQueryUserIndexed);

    // Deleting the doc first makes its reappearance the marker that the reindex write landed.
    deleteSearchDoc(QUERY_INDEX, query.getId());
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, "/v1/search/reindexEntities", List.of(query.getEntityReference()));

    awaitDoc(QUERY_INDEX, query.getId(), ReindexFieldSetSearchDocIT::assertQueryUserIndexed);
  }

  private static void assertUsageReachesSearchDoc(String entityType, String index, UUID id) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/usage/" + entityType + "/" + id,
            new DailyCount().withDate(LocalDate.now().toString()).withCount(DAILY_USAGE),
            EntityUsage.class);
    awaitDoc(
        index,
        id,
        doc ->
            assertEquals(
                DAILY_USAGE, doc.path("usageSummary").path("dailyStats").path("count").asInt()));
  }

  private static void assertQueryUserIndexed(JsonNode doc) {
    assertEquals(
        SharedEntities.get().USER1.getId().toString(),
        doc.path("users").path(0).path("id").asText());
  }

  private static void deleteSearchDoc(String index, UUID id) throws IOException {
    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      Request request =
          new Request(
              "DELETE",
              "/" + Entity.getSearchRepository().getIndexOrAliasName(index) + "/_doc/" + id);
      request.addParameter("refresh", "true");
      searchClient.performRequest(request);
    }
  }
}

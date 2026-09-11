package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Proves /v1/columns/grid serves a type the grid never served before.
 *
 * <p>Deriving the grid's index configs from the child-field registry admitted three new types:
 * pipeline, mlmodel and worksheet. A mapping survey shows their child-name keyword subfields exist,
 * but that is not proof the aggregation returns rows. ColumnGridResourceIT cannot supply that proof
 * either: it is a frozen contract and every one of its tests queries table or
 * table,dashboardDataModel, so it never exercises even the legacy topic, searchIndex or container
 * types. Hence this separate file, alongside it rather than inside it.
 *
 * <p>If this test cannot be made to pass, the correct response is to narrow GRID_EXCLUDED_TYPES to
 * what is actually verified rather than leave an unverified type admitted to a public endpoint.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnGridNewTypesIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void grid_returnsRowsForPipeline(TestNamespace ns) throws Exception {
    // pipeline is one of the three types admitted to the grid for the first time. Its
    // tasks.name.keyword subfield exists but has no lowercase_normalizer, which is the documented
    // case-sensitivity caveat, so the pattern below matches the task name exactly as stored.
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    String taskName = ns.prefix("extract").replace('-', '_');

    client
        .pipelines()
        .create(
            new CreatePipeline()
                .withName(ns.prefix("grid_etl"))
                .withService(service.getFullyQualifiedName())
                .withTasks(List.of(new Task().withName(taskName))));
    waitForSearchIndexRefresh(ns);

    await("Wait for the pipeline task to appear in the column grid")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              ColumnGridResponse response =
                  getColumnGrid(client, "entityTypes=pipeline&columnNamePattern=" + taskName);
              assertNotNull(response.getColumns(), "Columns should not be null");
              assertFalse(
                  response.getColumns().isEmpty(), "grid must return a row for a pipeline task");
              assertEquals(taskName, response.getColumns().getFirst().getColumnName());
            });
  }

  // Copied verbatim from ColumnGridResourceIT, which stays byte-unmodified as the frozen contract
  // for the legacy grid behavior.
  private ColumnGridResponse getColumnGrid(OpenMetadataClient client, String queryParams)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/columns/grid?" + queryParams, null);

    return OBJECT_MAPPER.readValue(response, ColumnGridResponse.class);
  }

  private void waitForSearchIndexRefresh(TestNamespace ns) {
    String namespaceMarker = ns.prefix("");
    await("Wait for a namespace entity to appear in search")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String response =
                  SdkClients.adminClient()
                      .search()
                      .query(namespaceMarker)
                      .index("dataAsset")
                      .size(100)
                      .execute();
              JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
              boolean namespaceEntityFound = false;
              for (JsonNode hit : hits) {
                if (hit.path("_source")
                    .path("fullyQualifiedName")
                    .asText()
                    .contains(namespaceMarker)) {
                  namespaceEntityFound = true;
                  break;
                }
              }
              assertTrue(
                  namespaceEntityFound,
                  "Search did not return an entity from namespace " + namespaceMarker);
            });
  }
}

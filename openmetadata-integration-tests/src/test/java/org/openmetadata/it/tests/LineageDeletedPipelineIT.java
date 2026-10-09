package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Lineage edge writes after the pipeline on an edge has been deleted.
 *
 * <p>Ingestion copies an edge's stored pipeline onto every write that carries none, so a write that
 * leaves the pipeline unchanged must succeed even when that pipeline was deleted after the edge was
 * written. Linking a deleted pipeline to an edge that does not already carry it must still fail.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class LineageDeletedPipelineIT {

  private static final String LINEAGE_PATH = "/v1/lineage";
  private static final String SQL_QUERY = "select id, name from source_table";
  private static final String ADD_SQL_QUERY_PATCH =
      """
      [{"op":"add","path":"/sqlQuery","value":"%s"}]
      """.formatted(SQL_QUERY);
  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  private record EdgeTables(Table from, Table to) {}

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void patchKeepsSoftDeletedPipelineAlreadyOnEdge(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline pipeline = createPipeline(ns, "pipeline");
    putEdge(edge, pipelineLineage(pipeline, LineageDetails.Source.PIPELINE_LINEAGE));
    softDelete(pipeline);

    patchEdge(edge, ADD_SQL_QUERY_PATCH);

    LineageDetails stored = getEdge(edge);
    assertEquals(SQL_QUERY, stored.getSqlQuery());
    assertEquals(pipeline.getId(), stored.getPipeline().getId());
  }

  @Test
  void putKeepsSoftDeletedPipelineAlreadyOnEdge(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline pipeline = createPipeline(ns, "pipeline");
    putEdge(edge, pipelineLineage(pipeline, LineageDetails.Source.PIPELINE_LINEAGE));
    softDelete(pipeline);

    putEdge(edge, sqlLineage(pipeline));

    LineageDetails stored = getEdge(edge);
    assertEquals(SQL_QUERY, stored.getSqlQuery());
    assertEquals(pipeline.getId(), stored.getPipeline().getId());
  }

  @Test
  void writeDropsHardDeletedPipelineAlreadyOnEdge(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline pipeline = createPipeline(ns, "pipeline");
    // Hard-deleting a pipeline removes only its PipelineLineage edges, so this DbtLineage edge
    // keeps a reference to a pipeline that no longer exists.
    putEdge(edge, pipelineLineage(pipeline, LineageDetails.Source.DBT_LINEAGE));
    hardDelete(pipeline);

    putEdge(edge, sqlLineage(pipeline));

    LineageDetails stored = getEdge(edge);
    assertEquals(SQL_QUERY, stored.getSqlQuery());
    assertNull(stored.getPipeline());
  }

  @Test
  void linkingDeletedPipelineToNewEdgeIsRejected(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline deletedPipeline = createPipeline(ns, "deleted_pipeline");
    softDelete(deletedPipeline);

    ApiException error =
        assertThrows(ApiException.class, () -> putEdge(edge, sqlLineage(deletedPipeline)));
    assertEquals(404, error.getStatusCode());
  }

  @Test
  void switchingEdgeToDeletedPipelineIsRejected(TestNamespace ns) {
    EdgeTables edge = createEdgeTables(ns);
    Pipeline livePipeline = createPipeline(ns, "live_pipeline");
    putEdge(edge, pipelineLineage(livePipeline, LineageDetails.Source.PIPELINE_LINEAGE));
    Pipeline deletedPipeline = createPipeline(ns, "deleted_pipeline");
    softDelete(deletedPipeline);

    ApiException error =
        assertThrows(ApiException.class, () -> putEdge(edge, sqlLineage(deletedPipeline)));
    assertEquals(404, error.getStatusCode());
  }

  private static EdgeTables createEdgeTables(TestNamespace ns) {
    String schemaFqn = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    return new EdgeTables(
        TableTestFactory.createWithName(ns, schemaFqn, "src"),
        TableTestFactory.createWithName(ns, schemaFqn, "tgt"));
  }

  private static Pipeline createPipeline(TestNamespace ns, String name) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    return SdkClients.adminClient()
        .pipelines()
        .create(
            new CreatePipeline()
                .withName(ns.prefix(name))
                .withService(service.getFullyQualifiedName()));
  }

  private static LineageDetails pipelineLineage(Pipeline pipeline, LineageDetails.Source source) {
    return new LineageDetails().withPipeline(pipeline.getEntityReference()).withSource(source);
  }

  /** A SQL-parsed write. Ingestion sends these with the pipeline it copied from the stored edge. */
  private static LineageDetails sqlLineage(Pipeline pipeline) {
    return pipelineLineage(pipeline, LineageDetails.Source.DBT_LINEAGE).withSqlQuery(SQL_QUERY);
  }

  private static void softDelete(Pipeline pipeline) {
    SdkClients.adminClient().pipelines().delete(pipeline.getId().toString());
  }

  private static void hardDelete(Pipeline pipeline) {
    SdkClients.adminClient()
        .pipelines()
        .delete(pipeline.getId().toString(), Map.of("hardDelete", "true"));
  }

  private static void putEdge(EdgeTables edge, LineageDetails details) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, LINEAGE_PATH + edgePath(edge), details);
  }

  private static void patchEdge(EdgeTables edge, String jsonPatch) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            LINEAGE_PATH + edgePath(edge),
            JsonUtils.readTree(jsonPatch),
            JSON_PATCH);
  }

  private static LineageDetails getEdge(EdgeTables edge) {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, LINEAGE_PATH + "/getLineageEdge" + edgePath(edge), null);
    return JsonUtils.treeToValue(JsonUtils.readTree(response).get("edge"), LineageDetails.class);
  }

  private static String edgePath(EdgeTables edge) {
    return "/table/name/"
        + encodePathSegment(edge.from().getFullyQualifiedName())
        + "/table/name/"
        + encodePathSegment(edge.to().getFullyQualifiedName());
  }

  private static String encodePathSegment(String segment) {
    return URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20");
  }
}

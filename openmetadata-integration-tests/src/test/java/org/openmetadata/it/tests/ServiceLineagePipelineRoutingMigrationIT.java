package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.utils.v203.ServiceLineagePipelineRoutingMigration;

/**
 * Covers the 2.0.3 repair that prunes direct service edges left behind by pipeline-annotated
 * lineage.
 *
 * <p>Topology: two database services wired together twice — once through a pipeline
 * ({@code annotatedSource → annotatedTarget}) and once directly ({@code plainSource → plainTarget}).
 * That mix is what makes the repair non-trivial: the direct service edge is still earned by the
 * plain pair and must survive, while its refcount has to drop to cover only that pair.
 *
 * <p>This class owns its services so the plain edge does not perturb {@link
 * LineagePipelineAnnotatorIT}, which asserts the absence of exactly that direct edge.
 */
@Execution(ExecutionMode.SAME_THREAD)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ServiceLineagePipelineRoutingMigrationIT {

  private OpenMetadataClient client;
  private TestNamespace namespace;

  private DatabaseService sourceService;
  private DatabaseService targetService;
  private PipelineService pipelineService;
  private Pipeline pipeline;
  private Table annotatedSource;
  private Table annotatedTarget;
  private Table plainSource;
  private Table plainTarget;

  @BeforeAll
  void setUp() {
    client = SdkClients.adminClient();
    namespace = new TestNamespace("ServiceLineagePipelineRoutingMigrationIT");

    sourceService = DatabaseServiceTestFactory.createPostgres(namespace);
    targetService = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema sourceSchema = DatabaseSchemaTestFactory.createSimple(namespace, sourceService);
    DatabaseSchema targetSchema = DatabaseSchemaTestFactory.createSimple(namespace, targetService);

    annotatedSource = createTable(sourceSchema.getFullyQualifiedName(), "annotated_source");
    annotatedTarget = createTable(targetSchema.getFullyQualifiedName(), "annotated_target");
    plainSource = createTable(sourceSchema.getFullyQualifiedName(), "plain_source");
    plainTarget = createTable(targetSchema.getFullyQualifiedName(), "plain_target");

    pipelineService = PipelineServiceTestFactory.createAirflow(namespace);
    pipeline = createPipeline(pipelineService.getFullyQualifiedName());

    addLineage(annotatedSource, annotatedTarget, pipeline);
    addLineage(plainSource, plainTarget, null);
  }

  @AfterAll
  void tearDown() {
    safeDelete(() -> client.pipelines().delete(pipeline.getId()));
    for (Table table : List.of(annotatedSource, annotatedTarget, plainSource, plainTarget)) {
      safeDelete(() -> client.tables().delete(table.getId()));
    }
  }

  @Test
  void repairKeepsDirectEdgeEarnedByPlainLineageAndStaysIdempotent() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    UUID sourceId = sourceService.getId();
    UUID targetId = targetService.getId();

    assertNotNull(
        directEdge(collectionDAO, sourceId, targetId),
        "the plain table pair should have produced a direct service edge");

    ServiceLineagePipelineRoutingMigration.removeServiceEdgesBypassingPipeline(collectionDAO);
    assertEquals(
        1,
        assetEdgesOfDirectEdge(collectionDAO, sourceId, targetId),
        "direct edge must survive and count only the plain child edge");

    // The annotated child edges are untouched by the repair, so a second pass recomputes the same
    // target. Subtracting from the stored refcount instead would reach zero here and delete it.
    ServiceLineagePipelineRoutingMigration.removeServiceEdgesBypassingPipeline(collectionDAO);
    assertEquals(
        1,
        assetEdgesOfDirectEdge(collectionDAO, sourceId, targetId),
        "re-running the repair must not delete the direct edge it just kept");
  }

  @Test
  void repairDropsDirectEdgeWhenEveryChildEdgeRoutesThroughAPipeline() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    UUID sourceId = sourceService.getId();
    UUID targetId = targetService.getId();

    client.lineage().deleteLineage("table:" + plainSource.getId(), "table:" + plainTarget.getId());

    ServiceLineagePipelineRoutingMigration.removeServiceEdgesBypassingPipeline(collectionDAO);

    assertNull(
        directEdge(collectionDAO, sourceId, targetId),
        "with only pipeline-annotated lineage left, the direct service edge must go");

    addLineage(plainSource, plainTarget, null);
  }

  private CollectionDAO.EntityRelationshipObject directEdge(
      CollectionDAO collectionDAO, UUID fromId, UUID toId) {
    return collectionDAO.relationshipDAO().getRecord(fromId, toId, Relationship.UPSTREAM.ordinal());
  }

  private int assetEdgesOfDirectEdge(CollectionDAO collectionDAO, UUID fromId, UUID toId) {
    CollectionDAO.EntityRelationshipObject edge = directEdge(collectionDAO, fromId, toId);
    assertNotNull(edge, "direct service edge unexpectedly missing");
    LineageDetails details =
        org.openmetadata.schema.utils.JsonUtils.readValue(edge.getJson(), LineageDetails.class);
    return details.getAssetEdges() == null ? 0 : details.getAssetEdges();
  }

  private void addLineage(Table from, Table to, Pipeline annotator) {
    LineageDetails details = new LineageDetails().withSource(LineageDetails.Source.MANUAL);
    if (annotator != null) {
      details
          .withSource(LineageDetails.Source.PIPELINE_LINEAGE)
          .withPipeline(annotator.getEntityReference());
    }
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(details)));
  }

  private Table createTable(String schemaFqn, String name) {
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(namespace.prefix(name))
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(new ColumnBuilder("id", "VARCHAR").dataLength(256).build())));
  }

  private Pipeline createPipeline(String serviceFqn) {
    CreatePipeline request = new CreatePipeline();
    request.setName(namespace.prefix("etl_pipeline"));
    request.setService(serviceFqn);
    return client.pipelines().create(request);
  }

  private void safeDelete(Runnable delete) {
    try {
      delete.run();
    } catch (Exception e) {
      // Cleanup is best effort; the namespace teardown removes anything left behind.
    }
  }
}

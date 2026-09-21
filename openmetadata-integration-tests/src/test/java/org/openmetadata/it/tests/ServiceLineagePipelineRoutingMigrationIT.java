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
import org.junit.jupiter.api.parallel.Isolated;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
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
@Isolated(
    "invokes the v203 repair, which scans and rewrites service edges across the whole"
        + " entity_relationship table, not just this class's own services")
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

  /**
   * Attaching a pipeline to an edge that had none re-points it from the direct service edge onto
   * the hops. The direct edge it used to feed must be released, or both paths stay on the graph.
   */
  @Test
  void addingAPipelineToAnExistingEdgeReleasesTheDirectServiceEdge() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    UUID sourceId = sourceService.getId();
    UUID targetId = targetService.getId();
    UUID pipelineServiceId = pipelineService.getId();

    assertEquals(
        1,
        assetEdgesOfDirectEdge(collectionDAO, sourceId, targetId),
        "the plain pair is the only contributor to the direct edge");

    addLineage(plainSource, plainTarget, pipeline);

    assertNull(
        directEdge(collectionDAO, sourceId, targetId),
        "its last plain contributor now routes through the pipeline, so the direct edge must go");
    assertNotNull(
        directEdge(collectionDAO, sourceId, pipelineServiceId), "source -> pipeline hop expected");
    assertNotNull(
        directEdge(collectionDAO, pipelineServiceId, targetId), "pipeline -> target hop expected");

    addLineage(plainSource, plainTarget, null);
    assertNotNull(
        directEdge(collectionDAO, sourceId, targetId),
        "removing the pipeline again must restore the direct edge");
  }

  /** Re-saving an edge without changing its pipeline is not a reshape and must not release. */
  @Test
  void resavingAnEdgeWithTheSamePipelineKeepsBothProjections() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    UUID sourceId = sourceService.getId();
    UUID targetId = targetService.getId();
    UUID pipelineServiceId = pipelineService.getId();

    addLineage(annotatedSource, annotatedTarget, pipeline);

    assertNotNull(
        directEdge(collectionDAO, sourceId, pipelineServiceId),
        "source -> pipeline hop must survive an unchanged re-save");
    assertNotNull(
        directEdge(collectionDAO, pipelineServiceId, targetId),
        "pipeline -> target hop must survive an unchanged re-save");
    assertEquals(
        1,
        assetEdgesOfDirectEdge(collectionDAO, sourceId, targetId),
        "the unrelated plain pair's direct edge must be untouched");
  }

  /**
   * A child edge whose prior pipeline was hard-deleted still moves onto its new pipeline's hops, so
   * it has to be counted into them. Skipping that increment leaves a hop shared with another child
   * one contributor short, and deleting that other child then takes the hop away from this edge.
   */
  @Test
  void movingOffAHardDeletedPipelineStillCountsIntoTheNewHops() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    UUID sourceId = sourceService.getId();
    UUID targetId = targetService.getId();
    UUID pipelineServiceId = pipelineService.getId();

    // annotatedSource -> annotatedTarget already routes through `pipeline`, so it is the hops' only
    // contributor. Point the plain pair at a pipeline that no longer exists, mimicking an edge
    // whose annotator was hard-deleted, then move it onto the same live pipeline.
    pointChildEdgeAtMissingPipeline(collectionDAO, plainSource, plainTarget);
    addLineage(plainSource, plainTarget, pipeline);

    assertEquals(
        2,
        assetEdges(directEdge(collectionDAO, sourceId, pipelineServiceId)),
        "the moved edge must be counted into the source -> pipeline hop it now depends on");
    assertEquals(
        2,
        assetEdges(directEdge(collectionDAO, pipelineServiceId, targetId)),
        "the moved edge must be counted into the pipeline -> target hop it now depends on");

    client
        .lineage()
        .deleteLineage("table:" + annotatedSource.getId(), "table:" + annotatedTarget.getId());

    assertNotNull(
        directEdge(collectionDAO, sourceId, pipelineServiceId),
        "the hop is still needed by the moved edge and must survive the other child's deletion");
    assertNotNull(
        directEdge(collectionDAO, pipelineServiceId, targetId),
        "the hop is still needed by the moved edge and must survive the other child's deletion");

    addLineage(annotatedSource, annotatedTarget, pipeline);
    addLineage(plainSource, plainTarget, null);
  }

  /**
   * A child edge the scan cannot classify must not be read as absent: treating it that way makes
   * the pair look purely annotated and costs it a direct edge the unreadable child may still earn.
   */
  @Test
  void anUnclassifiableChildEdgeLeavesItsServicePairUntouched() {
    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    UUID sourceId = sourceService.getId();
    UUID targetId = targetService.getId();

    assertEquals(
        1,
        assetEdges(directEdge(collectionDAO, sourceId, targetId)),
        "precondition: the plain pair earns the direct edge");

    corruptChildEdgeDetails(collectionDAO, plainSource, plainTarget);

    ServiceLineagePipelineRoutingMigration.removeServiceEdgesBypassingPipeline(collectionDAO);

    assertNotNull(
        directEdge(collectionDAO, sourceId, targetId),
        "the direct edge must survive while a contributing child edge cannot be classified");

    // Restore through the DAO: addLineage would have to read the corrupt prior details first.
    replaceChildEdgeJson(
        collectionDAO,
        plainSource,
        plainTarget,
        JsonUtils.pojoToJson(new LineageDetails().withSource(LineageDetails.Source.MANUAL)));
  }

  /** Rewrites the child edge to reference a pipeline id that no entity holds. */
  private void pointChildEdgeAtMissingPipeline(CollectionDAO collectionDAO, Table from, Table to) {
    LineageDetails details =
        new LineageDetails()
            .withSource(LineageDetails.Source.PIPELINE_LINEAGE)
            .withPipeline(
                new EntityReference().withId(UUID.randomUUID()).withType(Entity.PIPELINE));
    replaceChildEdgeJson(collectionDAO, from, to, JsonUtils.pojoToJson(details));
  }

  /** Stores syntactically valid JSON that cannot bind to {@link LineageDetails}. */
  private void corruptChildEdgeDetails(CollectionDAO collectionDAO, Table from, Table to) {
    replaceChildEdgeJson(collectionDAO, from, to, "{\"pipeline\": \"not-an-entity-reference\"}");
  }

  private void replaceChildEdgeJson(
      CollectionDAO collectionDAO, Table from, Table to, String json) {
    collectionDAO
        .relationshipDAO()
        .insert(
            from.getId(),
            to.getId(),
            Entity.TABLE,
            Entity.TABLE,
            Relationship.UPSTREAM.ordinal(),
            json);
  }

  private int assetEdges(CollectionDAO.EntityRelationshipObject edge) {
    assertNotNull(edge, "expected service edge is missing");
    LineageDetails details = JsonUtils.readValue(edge.getJson(), LineageDetails.class);
    return details.getAssetEdges() == null ? 0 : details.getAssetEdges();
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

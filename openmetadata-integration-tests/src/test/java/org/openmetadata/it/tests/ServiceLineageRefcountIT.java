package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * The lineage edge between two services refcounts the child-asset edges behind it in {@code
 * assetEdges}. These cover a service edge that was also written directly through PUT /v1/lineage,
 * which left the refcount unset and made every later child-edge write between the same two
 * services fail with a 500.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class ServiceLineageRefcountIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void childEdgeCountsIntoAServiceEdgeThatWasPutDirectly(TestNamespace ns) throws Exception {
    Fixture f = Fixture.create(ns);
    putEdge(f.drive(), f.storage(), new LineageDetails());

    putEdge(f.sheet(), f.container(), new LineageDetails());

    assertEquals(1, assetEdges(f.drive(), f.storage()));
  }

  @Test
  void directPutOnAServicePairKeepsItsChildAssetCount(TestNamespace ns) throws Exception {
    Fixture f = Fixture.create(ns);
    putEdge(f.sheet(), f.container(), new LineageDetails());

    putEdge(f.drive(), f.storage(), new LineageDetails());

    assertEquals(1, assetEdges(f.drive(), f.storage()));
  }

  @Test
  void attachingAPipelineAfterADirectServicePutRoutesThroughThePipeline(TestNamespace ns)
      throws Exception {
    Fixture f = Fixture.create(ns);
    PipelineService pipelineService = PipelineServiceTestFactory.createAirflow(ns);
    Pipeline pipeline =
        client()
            .pipelines()
            .create(
                new CreatePipeline()
                    .withName(ns.prefix("pipeline"))
                    .withService(pipelineService.getFullyQualifiedName()));
    putEdge(f.sheet(), f.container(), new LineageDetails());
    putEdge(f.drive(), f.storage(), new LineageDetails());

    // The payload the lineage editor sends when a pipeline is attached to an existing edge.
    putEdge(
        f.sheet(),
        f.container(),
        new LineageDetails()
            .withSqlQuery("")
            .withColumnsLineage(List.<ColumnLineage>of())
            .withPipeline(pipeline.getEntityReference()));

    assertEquals(1, assetEdges(f.drive(), pipelineService));
    assertEdgeAbsent(f.drive(), f.storage());
  }

  @Test
  void deletingAChildEdgeAfterADirectServicePutReleasesTheServiceEdge(TestNamespace ns)
      throws Exception {
    Fixture f = Fixture.create(ns);
    putEdge(f.sheet(), f.container(), new LineageDetails());
    putEdge(f.drive(), f.storage(), new LineageDetails());

    client()
        .lineage()
        .deleteLineage(
            Entity.SPREADSHEET + ":" + f.sheet().getId(),
            Entity.CONTAINER + ":" + f.container().getId());

    assertEdgeAbsent(f.drive(), f.storage());
  }

  /** A spreadsheet and a container in services of their own, so each test owns its service pair. */
  private record Fixture(
      DriveService drive, StorageService storage, Spreadsheet sheet, Container container) {

    static Fixture create(TestNamespace ns) {
      DriveService drive =
          ns.trackRoot(Entity.DRIVE_SERVICE, DriveServiceTestFactory.createGoogleDrive(ns));
      StorageService storage = StorageServiceTestFactory.createS3(ns);
      Spreadsheet sheet =
          client()
              .spreadsheets()
              .create(
                  new CreateSpreadsheet()
                      .withName(ns.prefix("sheet"))
                      .withService(drive.getFullyQualifiedName()));
      Container container =
          client()
              .containers()
              .create(
                  new CreateContainer()
                      .withName(ns.prefix("container"))
                      .withService(storage.getFullyQualifiedName()));
      return new Fixture(drive, storage, sheet, container);
    }
  }

  private static void putEdge(EntityInterface from, EntityInterface to, LineageDetails details) {
    client()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(details)));
  }

  private static Integer assetEdges(EntityInterface from, EntityInterface to) throws Exception {
    String response =
        client().getHttpClient().executeForString(HttpMethod.GET, edgePath(from, to), null);
    String edge = MAPPER.readTree(response).get("edge").toString();
    return JsonUtils.readValue(edge, LineageDetails.class).getAssetEdges();
  }

  private static void assertEdgeAbsent(EntityInterface from, EntityInterface to) {
    OpenMetadataException notFound =
        assertThrows(
            OpenMetadataException.class,
            () ->
                client()
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, edgePath(from, to), null));
    assertEquals(404, notFound.getStatusCode());
  }

  private static String edgePath(EntityInterface from, EntityInterface to) {
    return "/v1/lineage/getLineageEdge/" + from.getId() + "/" + to.getId();
  }

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}

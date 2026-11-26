package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.sql.SQLException;
import org.jdbi.v3.core.ConnectionException;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.PipelineMetrics;
import org.openmetadata.service.Entity;

/**
 * GET /v1/pipelines/metrics has no catch of its own: a denied caller must get the authorizer's 403,
 * and a database failure must still answer 200 with dataAvailable=false. This pins the repository
 * half of that contract, so the endpoint never needs a broad catch again.
 */
class PipelineMetricsDegradationTest {

  @Test
  void aDatabaseFailureDegradesToUnavailableMetrics() {
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final CollectionDAO.EntityExtensionTimeSeriesDAO timeSeriesDAO =
        mock(CollectionDAO.EntityExtensionTimeSeriesDAO.class);
    when(collectionDAO.entityExtensionTimeSeriesDao()).thenReturn(timeSeriesDAO);
    when(timeSeriesDAO.getPipelineMetricsData(
            any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
            any(), any()))
        .thenThrow(new ConnectionException(new SQLException("Connection refused")));

    // Calling the real registerEntity while stubbing it can pollute the shared registry.
    try (final MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entities.when(() -> Entity.getEntityFields(Pipeline.class)).thenCallRealMethod();

      final PipelineMetrics metrics =
          new PipelineRepository()
              .getPipelineMetrics(null, null, null, null, null, null, null, null, null);

      assertFalse(metrics.getDataAvailable());
      assertEquals(0, metrics.getTotalPipelines());
      assertEquals(
          "Database unavailable: Failed to get pipeline metrics", metrics.getErrorMessage());
    }
  }
}

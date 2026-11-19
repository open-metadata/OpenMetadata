package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.MetricIndex;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.util.EntityUtil.Fields;

class MetricRepositoryTest {
  private MetricRepository repository;

  @BeforeEach
  void setUp() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.metricDAO()).thenReturn(mock(CollectionDAO.MetricDAO.class));
    Entity.setCollectionDAO(collectionDAO);
    repository = new MetricRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void aReindexReadKeepsEveryInputOfTheMetricEmbeddingFingerprint() {
    Metric written =
        new Metric()
            .withId(UUID.randomUUID())
            .withName("revenue")
            .withFullyQualifiedName("revenue")
            .withRelatedMetrics(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType(Entity.METRIC)
                        .withName("cost")
                        .withFullyQualifiedName("cost")));
    Metric reindexed = JsonUtils.deepCopy(written, Metric.class);

    repository.clearFields(
        reindexed, new Fields(new MetricIndex(reindexed).getRequiredReindexFields()));

    assertEquals(
        VectorDocBuilder.computeFingerprintForEntity(written),
        VectorDocBuilder.computeFingerprintForEntity(reindexed));
  }
}

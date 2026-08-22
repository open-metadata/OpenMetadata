/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

class RdfPartitionCalculatorTest {

  private static final String TABLE = "table";
  private static final String UNKNOWN_TYPE = "unknownWidget";
  private static final int DEFAULT_PARTITION_SIZE = 10000;
  private static final int MIN_PARTITION_SIZE = 1000;
  private static final int MAX_PARTITION_SIZE = 50000;

  @Test
  void calculatePartitionsForEntityReturnsEmptyWhenCountIsZero() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, 0);
      RdfPartitionCalculator calculator = new RdfPartitionCalculator();

      List<RdfIndexPartition> partitions =
          calculator.calculatePartitionsForEntity(UUID.randomUUID(), UNKNOWN_TYPE);

      assertTrue(partitions.isEmpty());
    }
  }

  @Test
  void calculatePartitionsForEntityReturnsEmptyWhenCountNegative() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, -5);
      RdfPartitionCalculator calculator = new RdfPartitionCalculator();

      List<RdfIndexPartition> partitions =
          calculator.calculatePartitionsForEntity(UUID.randomUUID(), UNKNOWN_TYPE);

      assertTrue(partitions.isEmpty());
    }
  }

  @Test
  void complexityFactorShrinksAdjustedPartitionSizeForTableVersusUnknown() {
    UUID jobId = UUID.randomUUID();
    long firstRangeEndTable;
    long firstRangeEndUnknown;

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, TABLE, 20000);
      firstRangeEndTable =
          new RdfPartitionCalculator()
              .calculatePartitionsForEntity(jobId, TABLE)
              .get(0)
              .getRangeEnd();
    }
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, 20000);
      firstRangeEndUnknown =
          new RdfPartitionCalculator()
              .calculatePartitionsForEntity(jobId, UNKNOWN_TYPE)
              .get(0)
              .getRangeEnd();
    }

    assertEquals((long) (DEFAULT_PARTITION_SIZE / 1.5), firstRangeEndTable);
    assertEquals(DEFAULT_PARTITION_SIZE, firstRangeEndUnknown);
    assertTrue(firstRangeEndTable < firstRangeEndUnknown);
  }

  @Test
  void numPartitionsUsesCeilingDivision() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, 25000);

      List<RdfIndexPartition> partitions =
          new RdfPartitionCalculator()
              .calculatePartitionsForEntity(UUID.randomUUID(), UNKNOWN_TYPE);

      assertEquals(3, partitions.size());
    }
  }

  @Test
  void lastPartitionRangeEndIsClampedToTotalCount() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, 25000);

      List<RdfIndexPartition> partitions =
          new RdfPartitionCalculator()
              .calculatePartitionsForEntity(UUID.randomUUID(), UNKNOWN_TYPE);

      RdfIndexPartition last = partitions.get(partitions.size() - 1);
      assertEquals(20000, last.getRangeStart());
      assertEquals(25000, last.getRangeEnd());
      assertEquals(5000, last.getEstimatedCount());
    }
  }

  @Test
  void partitionCarriesWorkUnitsCursorAndPendingStatus() {
    UUID jobId = UUID.randomUUID();
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, TABLE, 20000);

      List<RdfIndexPartition> partitions =
          new RdfPartitionCalculator().calculatePartitionsForEntity(jobId, TABLE);

      RdfIndexPartition first = partitions.get(0);
      long expectedAdjustedSize = (long) (DEFAULT_PARTITION_SIZE / 1.5);
      assertEquals(jobId, first.getJobId());
      assertEquals(TABLE, first.getEntityType());
      assertEquals(0, first.getPartitionIndex());
      assertEquals(0L, first.getRangeStart());
      assertEquals(first.getRangeStart(), first.getCursor());
      assertEquals(expectedAdjustedSize, first.getEstimatedCount());
      assertEquals((long) (first.getEstimatedCount() * 1.5), first.getWorkUnits());
      assertEquals(PartitionStatus.PENDING, first.getStatus());
      assertEquals(0, first.getProcessedCount());
      assertEquals(0, first.getRetryCount());
    }
  }

  @Test
  void adjustedPartitionSizeNeverDropsBelowMinimum() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, TABLE, 1500);

      List<RdfIndexPartition> partitions =
          new RdfPartitionCalculator(MIN_PARTITION_SIZE)
              .calculatePartitionsForEntity(UUID.randomUUID(), TABLE);

      assertEquals(2, partitions.size());
      assertEquals(MIN_PARTITION_SIZE, partitions.get(0).getRangeEnd());
    }
  }

  @Test
  void constructorClampsPartitionSizeBelowMinimum() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, 1500);

      List<RdfIndexPartition> partitions =
          new RdfPartitionCalculator(100)
              .calculatePartitionsForEntity(UUID.randomUUID(), UNKNOWN_TYPE);

      assertEquals(2, partitions.size());
      assertEquals(MIN_PARTITION_SIZE, partitions.get(0).getRangeEnd());
    }
  }

  @Test
  void constructorClampsPartitionSizeAboveMaximum() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, 60000);

      List<RdfIndexPartition> partitions =
          new RdfPartitionCalculator(1_000_000)
              .calculatePartitionsForEntity(UUID.randomUUID(), UNKNOWN_TYPE);

      assertEquals(2, partitions.size());
      assertEquals(MAX_PARTITION_SIZE, partitions.get(0).getRangeEnd());
    }
  }

  @Test
  void getEntityCountReturnsListTotalCount() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubEntityCount(entityMock, UNKNOWN_TYPE, 4242);

      assertEquals(4242L, new RdfPartitionCalculator().getEntityCount(UNKNOWN_TYPE));
    }
  }

  @Test
  void getEntityCountSwallowsExceptionAndReturnsZero() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(UNKNOWN_TYPE))
          .thenThrow(new IllegalStateException("no repository registered"));

      assertEquals(0L, new RdfPartitionCalculator().getEntityCount(UNKNOWN_TYPE));
    }
  }

  @Test
  void calculatePartitionsForEntityReturnsEmptyWhenRepositoryLookupFails() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(UNKNOWN_TYPE))
          .thenThrow(new IllegalStateException("boom"));

      List<RdfIndexPartition> partitions =
          new RdfPartitionCalculator()
              .calculatePartitionsForEntity(UUID.randomUUID(), UNKNOWN_TYPE);

      assertTrue(partitions.isEmpty());
    }
  }

  @SuppressWarnings("unchecked")
  private void stubEntityCount(MockedStatic<Entity> entityMock, String entityType, int count) {
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);
    EntityDAO<EntityInterface> dao = mock(EntityDAO.class);
    when(repository.getDao()).thenReturn(dao);
    when(dao.listTotalCount()).thenReturn(count);
    entityMock.when(() -> Entity.getEntityRepository(entityType)).thenReturn(repository);
  }
}

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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.FullyQualifiedName;

@ExtendWith(MockitoExtension.class)
class PartitionCalculatorTest {

  private PartitionCalculator partitionCalculator;
  private MockedStatic<Entity> entityMock;

  @BeforeEach
  void setUp() {
    partitionCalculator = new PartitionCalculator(10000); // 10k partition size
    entityMock = mockStatic(Entity.class);
  }

  @AfterEach
  void tearDown() {
    if (entityMock != null) {
      entityMock.close();
    }
  }

  @Test
  void testCalculatePartitionsForEntity_SinglePartition() {
    // Setup mock repository returning 5000 entities (less than partition size)
    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    EntityDAO<?> mockDao = mock(EntityDAO.class);
    doReturn(mockDao).when(mockRepo).getDao();
    when(mockDao.listCount(any())).thenReturn(5000);
    entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepo);

    UUID jobId = UUID.randomUUID();
    List<SearchIndexPartition> partitions =
        partitionCalculator.calculatePartitionsForEntity(jobId, "table");

    assertNotNull(partitions);
    assertEquals(1, partitions.size());

    SearchIndexPartition partition = partitions.getFirst();
    assertEquals(jobId, partition.getJobId());
    assertEquals("table", partition.getEntityType());
    assertEquals(0, partition.getPartitionIndex());
    assertEquals(0, partition.getRangeStart());
    assertEquals(5000, partition.getRangeEnd());
    assertEquals(5000, partition.getEstimatedCount());
    assertEquals(PartitionStatus.PENDING, partition.getStatus());
  }

  @Test
  void testCalculatePartitionsForEntity_MultiplePartitions() {
    // Setup mock repository returning 25000 entities (should create multiple partitions)
    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    EntityDAO<?> mockDao = mock(EntityDAO.class);
    doReturn(mockDao).when(mockRepo).getDao();
    when(mockDao.listCount(any())).thenReturn(25000);
    entityMock.when(() -> Entity.getEntityRepository("user")).thenReturn(mockRepo);

    UUID jobId = UUID.randomUUID();
    List<SearchIndexPartition> partitions =
        partitionCalculator.calculatePartitionsForEntity(jobId, "user");

    assertNotNull(partitions);
    assertTrue(partitions.size() > 1);

    // Verify partitions cover the entire range
    long totalCovered = 0;
    for (int i = 0; i < partitions.size(); i++) {
      SearchIndexPartition partition = partitions.get(i);
      assertEquals(i, partition.getPartitionIndex());
      assertEquals(totalCovered, partition.getRangeStart());
      totalCovered = partition.getRangeEnd();
    }
    assertEquals(25000, totalCovered);
  }

  @Test
  void testCalculatePartitionsForEntity_EmptyEntity() {
    // Setup mock repository returning 0 entities
    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    EntityDAO<?> mockDao = mock(EntityDAO.class);
    doReturn(mockDao).when(mockRepo).getDao();
    when(mockDao.listCount(any())).thenReturn(0);
    entityMock.when(() -> Entity.getEntityRepository("empty")).thenReturn(mockRepo);

    UUID jobId = UUID.randomUUID();
    List<SearchIndexPartition> partitions =
        partitionCalculator.calculatePartitionsForEntity(jobId, "empty");

    assertNotNull(partitions);
    assertTrue(partitions.isEmpty());
  }

  @Test
  void testCalculatePartitions_MultipleEntityTypes() {
    // Setup mock repositories for different entity types
    EntityRepository<?> tableRepo = mock(EntityRepository.class);
    EntityDAO<?> tableDao = mock(EntityDAO.class);
    doReturn(tableDao).when(tableRepo).getDao();
    when(tableDao.listCount(any())).thenReturn(15000);

    EntityRepository<?> userRepo = mock(EntityRepository.class);
    EntityDAO<?> userDao = mock(EntityDAO.class);
    doReturn(userDao).when(userRepo).getDao();
    when(userDao.listCount(any())).thenReturn(5000);

    entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(tableRepo);
    entityMock.when(() -> Entity.getEntityRepository("user")).thenReturn(userRepo);

    UUID jobId = UUID.randomUUID();
    Set<String> entityTypes = Set.of("table", "user");
    List<SearchIndexPartition> partitions =
        partitionCalculator.calculatePartitions(jobId, entityTypes);

    assertNotNull(partitions);
    assertTrue(partitions.size() >= 2); // At least one partition per entity type

    // Verify all partitions have correct job ID
    for (SearchIndexPartition partition : partitions) {
      assertEquals(jobId, partition.getJobId());
    }
  }

  @Test
  void testComplexityFactorAffectsPartitionSize() {
    // Tables have higher complexity (1.5), should result in smaller partitions
    EntityRepository<?> tableRepo = mock(EntityRepository.class);
    EntityDAO<?> tableDao = mock(EntityDAO.class);
    doReturn(tableDao).when(tableRepo).getDao();
    when(tableDao.listCount(any())).thenReturn(20000);

    // Users have lower complexity (0.6), should result in larger partitions
    EntityRepository<?> userRepo = mock(EntityRepository.class);
    EntityDAO<?> userDao = mock(EntityDAO.class);
    doReturn(userDao).when(userRepo).getDao();
    when(userDao.listCount(any())).thenReturn(20000);

    entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(tableRepo);
    entityMock.when(() -> Entity.getEntityRepository("user")).thenReturn(userRepo);

    UUID jobId = UUID.randomUUID();

    List<SearchIndexPartition> tablePartitions =
        partitionCalculator.calculatePartitionsForEntity(jobId, "table");
    List<SearchIndexPartition> userPartitions =
        partitionCalculator.calculatePartitionsForEntity(jobId, "user");

    // Tables should have more partitions due to higher complexity
    assertTrue(
        tablePartitions.size() >= userPartitions.size(),
        "Tables should have more partitions due to higher complexity");
  }

  @Test
  void testGetEntityPriority() {
    // Services should have highest priority
    int servicePriority = partitionCalculator.getEntityPriority("databaseService");
    int tablePriority = partitionCalculator.getEntityPriority("table");
    int testCasePriority = partitionCalculator.getEntityPriority("testCase");

    assertTrue(servicePriority > tablePriority);
    assertTrue(tablePriority > testCasePriority);
  }

  @Test
  void testGetComplexityFactor() {
    double tableComplexity = partitionCalculator.getComplexityFactor("table");
    double userComplexity = partitionCalculator.getComplexityFactor("user");
    double tagComplexity = partitionCalculator.getComplexityFactor("tag");

    assertTrue(tableComplexity > userComplexity);
    assertTrue(userComplexity > tagComplexity);
  }

  @Test
  void testGetEntityCounts() {
    EntityRepository<?> tableRepo = mock(EntityRepository.class);
    EntityDAO<?> tableDao = mock(EntityDAO.class);
    doReturn(tableDao).when(tableRepo).getDao();
    when(tableDao.listCount(any())).thenReturn(10000);

    EntityRepository<?> userRepo = mock(EntityRepository.class);
    EntityDAO<?> userDao = mock(EntityDAO.class);
    doReturn(userDao).when(userRepo).getDao();
    when(userDao.listCount(any())).thenReturn(500);

    entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(tableRepo);
    entityMock.when(() -> Entity.getEntityRepository("user")).thenReturn(userRepo);

    Map<String, Long> counts = partitionCalculator.getEntityCounts(Set.of("table", "user"));

    assertEquals(10000L, counts.get("table"));
    assertEquals(500L, counts.get("user"));
  }

  @Test
  void testWorkUnitsReflectComplexity() {
    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    EntityDAO<?> mockDao = mock(EntityDAO.class);
    doReturn(mockDao).when(mockRepo).getDao();
    when(mockDao.listCount(any())).thenReturn(1000);
    entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(mockRepo);

    UUID jobId = UUID.randomUUID();
    List<SearchIndexPartition> partitions =
        partitionCalculator.calculatePartitionsForEntity(jobId, "table");

    SearchIndexPartition partition = partitions.getFirst();
    double expectedComplexity = partitionCalculator.getComplexityFactor("table");

    // Work units should be estimatedCount * complexity
    long expectedWorkUnits = (long) (partition.getEstimatedCount() * expectedComplexity);
    assertEquals(expectedWorkUnits, partition.getWorkUnits());
  }

  @Test
  void testPartitionSizeBounds() {
    // Very small partition size should be clamped to minimum (1000)
    // Then adjusted by complexity: for "database" with 0.8 complexity,
    // effective size = 1000 / 0.8 = 1250
    PartitionCalculator smallCalculator = new PartitionCalculator(100);
    assertEquals(1250, getEffectivePartitionSize(smallCalculator));

    // Very large partition size should be clamped to maximum (50000)
    // Then adjusted by complexity: for "database" with 0.8 complexity,
    // effective size = 50000 / 0.8 = 62500
    PartitionCalculator largeCalculator = new PartitionCalculator(100000);
    assertEquals(62500, getEffectivePartitionSize(largeCalculator));
  }

  @Test
  void testCalculatePartitionsForEntity_EnforcesMinimumPartitionsPerEntity() {
    PartitionCalculator calculator = new PartitionCalculator(10000, 4);

    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    EntityDAO<?> mockDao = mock(EntityDAO.class);
    doReturn(mockDao).when(mockRepo).getDao();
    when(mockDao.listCount(any())).thenReturn(4000);
    entityMock.when(() -> Entity.getEntityRepository("user")).thenReturn(mockRepo);

    UUID jobId = UUID.randomUUID();
    List<SearchIndexPartition> partitions = calculator.calculatePartitionsForEntity(jobId, "user");

    assertEquals(4, partitions.size());
    assertEquals(0, partitions.getFirst().getRangeStart());
    assertEquals(1000, partitions.getFirst().getRangeEnd());
    assertEquals(4000, partitions.getLast().getRangeEnd());
  }

  @Test
  void testCalculatePartitionsForEntity_CapsPerEntityPartitionCount() {
    PartitionCalculator calculator = new PartitionCalculator(1000);

    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    EntityDAO<?> mockDao = mock(EntityDAO.class);
    doReturn(mockDao).when(mockRepo).getDao();
    when(mockDao.listCount(any())).thenReturn(10_001_000);
    entityMock.when(() -> Entity.getEntityRepository("topic")).thenReturn(mockRepo);

    UUID jobId = UUID.randomUUID();
    List<SearchIndexPartition> partitions = calculator.calculatePartitionsForEntity(jobId, "topic");

    assertTrue(partitions.size() <= 10_000);
    assertEquals(1001, partitions.getFirst().getEstimatedCount());
    assertEquals(10_001_000, partitions.getLast().getRangeEnd());
  }

  @Test
  void testCalculatePartitions_ThrowsWhenTotalPartitionLimitExceeded() {
    PartitionCalculator calculator = spy(new PartitionCalculator());
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(1)
            .estimatedCount(1)
            .workUnits(1)
            .priority(1)
            .status(PartitionStatus.PENDING)
            .cursor(0)
            .processedCount(0)
            .successCount(0)
            .failedCount(0)
            .retryCount(0)
            .build();

    doReturn(Collections.nCopies(10_001, partition))
        .when(calculator)
        .calculatePartitionsForEntity(eq(jobId), anyString(), isNull());

    assertThrows(
        IllegalStateException.class,
        () -> calculator.calculatePartitions(jobId, Set.of("a", "b", "c", "d", "e")));
  }

  @Test
  void testGetEntityCount_TimeSeriesReportDataUsesDateFilteringAndHashedFqn() {
    PartitionCalculator calculator = new PartitionCalculator(10000);
    @SuppressWarnings("unchecked")
    EntityTimeSeriesRepository<?> repository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDAO = mock(EntityTimeSeriesDAO.class);
    when(repository.getTimeSeriesDao()).thenReturn(timeSeriesDAO);
    when(timeSeriesDAO.listCount(
            any(), anyLong(), anyLong(), org.mockito.ArgumentMatchers.eq(false)))
        .thenReturn(42);
    when(timeSeriesDAO.listCount(any())).thenReturn(84);
    entityMock
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
        .thenReturn(repository);

    ReindexingConfiguration config = ReindexingConfiguration.builder().timeSeriesMaxDays(7).build();

    long count = calculator.getEntityCount("entityReportData", config);

    assertEquals(42, count);
    entityMock.verify(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA));
    org.mockito.ArgumentCaptor<ListFilter> filterCaptor =
        org.mockito.ArgumentCaptor.forClass(ListFilter.class);
    org.mockito.Mockito.verify(timeSeriesDAO)
        .listCount(
            filterCaptor.capture(), anyLong(), anyLong(), org.mockito.ArgumentMatchers.eq(false));
    assertEquals(
        FullyQualifiedName.buildHash("entityReportData"),
        filterCaptor.getValue().getQueryParams().get("entityFQNHash"));
  }

  @Test
  void testGetEntityCount_TimeSeriesWithoutDateFilterUsesFullCount() {
    PartitionCalculator calculator = new PartitionCalculator(10000);
    @SuppressWarnings("unchecked")
    EntityTimeSeriesRepository<?> repository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDAO = mock(EntityTimeSeriesDAO.class);
    when(repository.getTimeSeriesDao()).thenReturn(timeSeriesDAO);
    when(timeSeriesDAO.listCount(any())).thenReturn(17);
    entityMock
        .when(() -> Entity.getEntityTimeSeriesRepository("testCaseResult"))
        .thenReturn(repository);

    long count = calculator.getEntityCount("testCaseResult");

    assertEquals(17, count);
    org.mockito.Mockito.verify(timeSeriesDAO).listCount(any());
  }

  @Test
  void testGetEntityCount_ReturnsZeroWhenRepositoryLookupFails() {
    entityMock
        .when(() -> Entity.getEntityRepository("broken"))
        .thenThrow(new IllegalStateException("missing repository"));

    long count = partitionCalculator.getEntityCount("broken");

    assertEquals(0, count);
  }

  private int getEffectivePartitionSize(PartitionCalculator calculator) {
    // Test by checking partition generation for a known count
    EntityRepository<?> mockRepo = mock(EntityRepository.class);
    EntityDAO<?> mockDao = mock(EntityDAO.class);
    doReturn(mockDao).when(mockRepo).getDao();
    when(mockDao.listCount(any())).thenReturn(100000);
    entityMock.when(() -> Entity.getEntityRepository("database")).thenReturn(mockRepo);

    UUID jobId = UUID.randomUUID();
    // Use "database" which has 0.8 complexity
    // Effective partition size = basePartitionSize / complexity
    List<SearchIndexPartition> partitions =
        calculator.calculatePartitionsForEntity(jobId, "database");

    if (partitions.isEmpty()) return 0;

    SearchIndexPartition first = partitions.getFirst();
    return (int) (first.getRangeEnd() - first.getRangeStart());
  }
}

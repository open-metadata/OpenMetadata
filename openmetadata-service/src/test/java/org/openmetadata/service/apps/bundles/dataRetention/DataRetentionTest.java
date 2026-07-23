/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.apps.bundles.dataRetention;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.search.SearchRepository;

class DataRetentionTest {

  private CollectionDAO collectionDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private MockedStatic<Entity> mockedEntity;
  private DataRetention dataRetention;

  @BeforeEach
  void setUp() throws Exception {
    collectionDAO = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.EventSubscriptionDAO eventSubscriptionDAO =
        mock(CollectionDAO.EventSubscriptionDAO.class);
    CollectionDAO.FeedDAO feedDAO = mock(CollectionDAO.FeedDAO.class);
    CollectionDAO.AuditLogDAO auditLogDAO = mock(CollectionDAO.AuditLogDAO.class);
    CollectionDAO.TestCaseResultTimeSeriesDAO testCaseResultsDAO =
        mock(CollectionDAO.TestCaseResultTimeSeriesDAO.class);
    CollectionDAO.ProfilerDataTimeSeriesDAO profileDataDAO =
        mock(CollectionDAO.ProfilerDataTimeSeriesDAO.class);
    FeedRepository feedRepository = mock(FeedRepository.class);
    SearchRepository searchRepository = mock(SearchRepository.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.eventSubscriptionDAO()).thenReturn(eventSubscriptionDAO);
    when(collectionDAO.auditLogDAO()).thenReturn(auditLogDAO);
    when(collectionDAO.testCaseResultTimeSeriesDao()).thenReturn(testCaseResultsDAO);
    when(collectionDAO.profilerDataTimeSeriesDao()).thenReturn(profileDataDAO);

    when(eventSubscriptionDAO.deleteSuccessfulSentChangeEventsInBatches(anyLong(), anyInt()))
        .thenReturn(0);
    when(eventSubscriptionDAO.deleteChangeEventsInBatches(anyLong(), anyInt())).thenReturn(0);
    when(eventSubscriptionDAO.deleteConsumersDlqInBatches(anyLong(), anyInt())).thenReturn(0);
    when(feedDAO.fetchConversationThreadIdsOlderThan(anyLong(), anyInt())).thenReturn(List.of());
    when(auditLogDAO.deleteInBatches(anyLong(), anyInt())).thenReturn(0);
    when(testCaseResultsDAO.deleteRecordsBeforeCutOff(anyLong(), anyInt())).thenReturn(0);
    when(profileDataDAO.deleteRecordsBeforeCutOff(anyLong(), anyInt())).thenReturn(0);
    when(relationshipDAO.deleteStaleLineage(anyInt(), anyLong(), anyList(), anyInt()))
        .thenReturn(0);

    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    mockedEntity.when(Entity::getFeedRepository).thenReturn(feedRepository);
    mockedEntity.when(() -> Entity.getCollectionDAO().feedDAO()).thenReturn(feedDAO);

    dataRetention = new DataRetention(collectionDAO, searchRepository);
    initializeStats(dataRetention);
  }

  private static void initializeStats(DataRetention instance) throws Exception {
    Method method = DataRetention.class.getDeclaredMethod("initializeStatsDefaults");
    method.setAccessible(true);
    method.invoke(instance);
  }

  @AfterEach
  void tearDown() {
    mockedEntity.close();
  }

  @Test
  void testCleanStaleLineage_WhenRetentionPeriodIsZero_SkipsLineageCleanup() {
    DataRetentionConfiguration config = configWithLineageRetention(0);

    dataRetention.executeCleanup(config);

    verify(relationshipDAO, never()).deleteStaleLineage(anyInt(), anyLong(), anyList(), anyInt());
  }

  @Test
  void testCleanStaleLineage_WhenRetentionPeriodIsPositive_CallsDeleteStaleLineage() {
    DataRetentionConfiguration config = configWithLineageRetention(365);

    dataRetention.executeCleanup(config);

    verify(relationshipDAO).deleteStaleLineage(anyInt(), anyLong(), anyList(), anyInt());
  }

  @Test
  void testCleanStaleLineage_UsesUpstreamRelationOrdinal() {
    DataRetentionConfiguration config = configWithLineageRetention(90);

    dataRetention.executeCleanup(config);

    verify(relationshipDAO)
        .deleteStaleLineage(eq(Relationship.UPSTREAM.ordinal()), anyLong(), anyList(), anyInt());
  }

  @Test
  void testCleanStaleLineage_CutoffTimestampIsInThePast() {
    DataRetentionConfiguration config = configWithLineageRetention(30);
    long beforeCall = System.currentTimeMillis();

    dataRetention.executeCleanup(config);

    ArgumentCaptor<Long> cutoffCaptor = ArgumentCaptor.forClass(Long.class);
    verify(relationshipDAO)
        .deleteStaleLineage(anyInt(), cutoffCaptor.capture(), anyList(), anyInt());

    long capturedCutoff = cutoffCaptor.getValue();
    assertTrue(capturedCutoff < beforeCall, "Cutoff must be in the past relative to call time");
  }

  @Test
  void testCleanStaleLineage_CutoffTimestampReflectsRetentionPeriod() {
    int retentionDays = 365;
    DataRetentionConfiguration config = configWithLineageRetention(retentionDays);
    long beforeCall = System.currentTimeMillis();

    dataRetention.executeCleanup(config);

    ArgumentCaptor<Long> cutoffCaptor = ArgumentCaptor.forClass(Long.class);
    verify(relationshipDAO)
        .deleteStaleLineage(anyInt(), cutoffCaptor.capture(), anyList(), anyInt());

    long capturedCutoff = cutoffCaptor.getValue();
    long expectedCutoff = beforeCall - (long) retentionDays * 24 * 60 * 60 * 1000;
    long toleranceMs = 5000;
    assertTrue(
        Math.abs(capturedCutoff - expectedCutoff) < toleranceMs,
        "Cutoff must be approximately now minus retention period");
  }

  @Test
  void testCleanStaleLineage_SourceListExcludesManual() {
    DataRetentionConfiguration config = configWithLineageRetention(365);

    dataRetention.executeCleanup(config);

    ArgumentCaptor<List<String>> sourcesCaptor = ArgumentCaptor.forClass(List.class);
    verify(relationshipDAO)
        .deleteStaleLineage(anyInt(), anyLong(), sourcesCaptor.capture(), anyInt());

    List<String> sources = sourcesCaptor.getValue();
    assertFalse(sources.contains("Manual"), "MANUAL lineage must never be included in cleanup");
  }

  @Test
  void testCleanStaleLineage_SourceListContainsAutoGeneratedSources() {
    DataRetentionConfiguration config = configWithLineageRetention(365);

    dataRetention.executeCleanup(config);

    ArgumentCaptor<List<String>> sourcesCaptor = ArgumentCaptor.forClass(List.class);
    verify(relationshipDAO)
        .deleteStaleLineage(anyInt(), anyLong(), sourcesCaptor.capture(), anyInt());

    List<String> sources = sourcesCaptor.getValue();
    assertTrue(sources.contains("QueryLineage"));
    assertTrue(sources.contains("ViewLineage"));
    assertTrue(sources.contains("PipelineLineage"));
    assertTrue(sources.contains("DashboardLineage"));
    assertTrue(sources.contains("DbtLineage"));
    assertTrue(sources.contains("SparkLineage"));
    assertTrue(sources.contains("OpenLineage"));
    assertTrue(sources.contains("ExternalTableLineage"));
    assertTrue(sources.contains("CrossDatabaseLineage"));
  }

  @Test
  void testExecuteCleanup_NullConfig_DoesNotThrow() {
    dataRetention.executeCleanup(null);

    verify(relationshipDAO, never()).deleteStaleLineage(anyInt(), anyLong(), anyList(), anyInt());
  }

  private DataRetentionConfiguration configWithLineageRetention(int lineageRetentionPeriod) {
    return new DataRetentionConfiguration()
        .withChangeEventRetentionPeriod(30)
        .withActivityThreadsRetentionPeriod(60)
        .withTestCaseResultsRetentionPeriod(1440)
        .withProfileDataRetentionPeriod(1440)
        .withAuditLogRetentionPeriod(90)
        .withLineageRetentionPeriod(lineageRetentionPeriod);
  }
}

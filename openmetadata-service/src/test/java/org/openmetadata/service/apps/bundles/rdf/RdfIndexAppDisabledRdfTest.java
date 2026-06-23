/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.apps.bundles.rdf;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

/**
 * Verifies RdfIndexApp tolerates RDF being disabled. RDF is disabled by default, so the
 * RdfRepository singleton is never initialized; the app is still installed as a default/seed
 * application on every startup. This test uses the real (uninitialized) RdfRepository static rather
 * than a mock so it reproduces the production crash:
 * IllegalStateException("RdfRepository not initialized").
 */
@DisplayName("RdfIndexApp Tests (RDF disabled)")
class RdfIndexAppDisabledRdfTest {

  private CollectionDAO collectionDAO;
  private SearchRepository searchRepository;

  private static class TestableRdfIndexApp extends RdfIndexApp {
    private final AppRunRecord appRunRecord =
        new AppRunRecord().withStatus(AppRunRecord.Status.RUNNING);

    TestableRdfIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
      super(collectionDAO, searchRepository);
    }

    @Override
    protected AppRunRecord getJobRecord(JobExecutionContext jobExecutionContext) {
      return appRunRecord;
    }

    @Override
    protected void pushAppStatusUpdates(
        JobExecutionContext jobExecutionContext, AppRunRecord appRecord, boolean update) {}
  }

  @BeforeEach
  void ensureRdfRepositoryNotInitialized() {
    RdfRepository.reset();
    collectionDAO = mock(CollectionDAO.class);
    searchRepository = mock(SearchRepository.class);
  }

  @AfterEach
  void cleanup() {
    RdfRepository.reset();
  }

  @Test
  @DisplayName("Constructor must not throw when RdfRepository is not initialized (RDF disabled)")
  void testConstructorToleratesUninitializedRdfRepository() {
    assertNull(RdfRepository.getInstanceOrNull(), "Precondition: RDF must be uninitialized");
    RdfIndexApp app = assertDoesNotThrow(() -> new RdfIndexApp(collectionDAO, searchRepository));
    assertNotNull(app);
  }

  @Test
  @DisplayName("execute must fail the job gracefully when RDF is disabled")
  void testExecuteFailsGracefullyWhenRdfDisabled() throws Exception {
    TestableRdfIndexApp app = new TestableRdfIndexApp(collectionDAO, searchRepository);

    EventPublisherJob jobConfig = new EventPublisherJob();
    jobConfig.setEntities(Set.of("table"));
    jobConfig.setStatus(EventPublisherJob.Status.STARTED);
    setJobData(app, jobConfig);

    JobExecutionContext context = mock(JobExecutionContext.class);
    JobDetail jobDetail = mock(JobDetail.class);
    when(context.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(new JobDataMap());

    assertDoesNotThrow(() -> app.execute(context));

    assertEquals(EventPublisherJob.Status.FAILED, app.getJobData().getStatus());
    assertNotNull(app.getJobData().getFailure());
    assertEquals("RDF Repository is not enabled", app.getJobData().getFailure().getMessage());
  }

  private void setJobData(RdfIndexApp app, EventPublisherJob jobConfig) throws Exception {
    var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
    jobDataField.setAccessible(true);
    jobDataField.set(app, jobConfig);
  }
}

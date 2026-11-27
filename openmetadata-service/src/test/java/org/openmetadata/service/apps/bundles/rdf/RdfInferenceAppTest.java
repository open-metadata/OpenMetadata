/*
 *  Copyright 2026 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.JOB_LISTENER_NAME;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.SchedulerException;

class RdfInferenceAppTest {

  @Test
  void aStoreWithoutMaterializedInferenceCompletesWithoutRunningRules() throws SchedulerException {
    final RdfConfiguration qlever =
        new RdfConfiguration()
            .withMaterializedInferenceEnabled(true)
            .withStorageType(RdfConfiguration.StorageType.QLEVER);

    assertEquals(List.of(AppRunRecord.Status.RUNNING, AppRunRecord.Status.COMPLETED), run(qlever));
  }

  private static List<AppRunRecord.Status> run(final RdfConfiguration configuration)
      throws SchedulerException {
    final RdfRepository repository = mock(RdfRepository.class);
    when(repository.getConfig()).thenReturn(configuration);
    final List<AppRunRecord.Status> statuses = new ArrayList<>();
    final OmAppJobListener listener = mock(OmAppJobListener.class);
    when(listener.getAppRunRecordForJob(any())).thenAnswer(invocation -> new AppRunRecord());
    doAnswer(
            invocation -> {
              statuses.add(invocation.<AppRunRecord>getArgument(1).getStatus());
              return null;
            })
        .when(listener)
        .pushApplicationStatusUpdates(any(), any(), anyBoolean());
    try (MockedStatic<RdfRepository> repositories = mockStatic(RdfRepository.class)) {
      repositories.when(RdfRepository::getInstanceOrNull).thenReturn(repository);
      repositories
          .when(() -> RdfRepository.supportsMaterializedInference(any()))
          .thenCallRealMethod();
      new RdfInferenceApp(mock(CollectionDAO.class), mock(SearchRepository.class))
          .startApp(jobContext(listener));
    }
    return statuses;
  }

  private static JobExecutionContext jobContext(final OmAppJobListener listener)
      throws SchedulerException {
    final JobExecutionContext context = mock(JobExecutionContext.class, RETURNS_DEEP_STUBS);
    when(context.getJobDetail().getJobDataMap()).thenReturn(new JobDataMap());
    when(context.getScheduler().getListenerManager().getJobListener(JOB_LISTENER_NAME))
        .thenReturn(listener);
    return context;
  }
}

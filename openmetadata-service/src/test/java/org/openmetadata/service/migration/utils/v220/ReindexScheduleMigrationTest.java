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
package org.openmetadata.service.migration.utils.v220;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDataDAOs.ApplicationDAO;
import org.openmetadata.service.jdbi3.ListFilter;

class ReindexScheduleMigrationTest {
  private static final String SEARCH_INDEXING = "SearchIndexingApplication";
  private static final String RDF_INDEXING = "RdfIndexApp";

  @Test
  void onlyTheShippedWeeklySchedulesMoveToOnDemandRuns() {
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final ApplicationDAO applicationDAO = mock(ApplicationDAO.class);
    when(collectionDAO.applicationDAO()).thenReturn(applicationDAO);
    when(applicationDAO.listAfter(any(ListFilter.class), eq(Integer.MAX_VALUE), eq(""), eq("")))
        .thenReturn(
            List.of(
                appJson(SEARCH_INDEXING, ScheduleTimeline.CUSTOM, "30 0 * * 0"),
                appJson(SEARCH_INDEXING, ScheduleTimeline.CUSTOM, "0 3 * * *"),
                appJson(SEARCH_INDEXING, ScheduleTimeline.WEEKLY, null),
                appJson(RDF_INDEXING, ScheduleTimeline.CUSTOM, "0 0 * * 6"),
                appJson(RDF_INDEXING, ScheduleTimeline.CUSTOM, "0 0 * * *"),
                appJson(RDF_INDEXING, ScheduleTimeline.CUSTOM, "30 0 * * 0"),
                appJson("DataInsightsApplication", ScheduleTimeline.CUSTOM, "0 0 * * 6")));

    ReindexScheduleMigration.retireShippedWeeklyReindexes(collectionDAO);

    final ArgumentCaptor<App> migrated = ArgumentCaptor.forClass(App.class);
    verify(applicationDAO, times(2)).update(migrated.capture());
    assertEquals(
        List.of(SEARCH_INDEXING, RDF_INDEXING),
        migrated.getAllValues().stream().map(App::getName).toList());
    for (final App app : migrated.getAllValues()) {
      assertEquals(ScheduleTimeline.NONE, app.getAppSchedule().getScheduleTimeline());
      assertNull(app.getAppSchedule().getCronExpression());
    }
  }

  private static String appJson(
      final String name, final ScheduleTimeline scheduleTimeline, final String cronExpression) {
    return JsonUtils.pojoToJson(
        new App()
            .withName(name)
            .withAppSchedule(
                new AppSchedule()
                    .withScheduleTimeline(scheduleTimeline)
                    .withCronExpression(cronExpression)));
  }
}

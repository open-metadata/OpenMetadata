/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this copy of the License except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.utils.v131;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

class MigrationUtilTest {

  @Test
  void migratesAllCustomAppsEvenWhenANonCustomAppWithNullCronSortsAhead() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    ApplicationDAO applicationDAO = mock(ApplicationDAO.class);
    when(collectionDAO.applicationDAO()).thenReturn(applicationDAO);
    when(applicationDAO.listAfter(any(ListFilter.class), eq(Integer.MAX_VALUE), eq(""), eq("")))
        .thenReturn(
            List.of(
                appJson("DataInsightsApplication", ScheduleTimeline.CUSTOM, "0 0 0 * * ?"),
                appJson("DataInsightsReportApplication", ScheduleTimeline.WEEKLY, null),
                appJson("SearchIndexingApplication", ScheduleTimeline.CUSTOM, "0 0 0 1/1 * ? *")));

    MigrationUtil.migrateCronExpression(collectionDAO);

    ArgumentCaptor<App> appCaptor = ArgumentCaptor.forClass(App.class);
    verify(applicationDAO, times(2)).update(appCaptor.capture());
    List<App> updated = appCaptor.getAllValues();
    assertEquals("DataInsightsApplication", updated.get(0).getName());
    assertEquals("0 0 * * *", updated.get(0).getAppSchedule().getCronExpression());
    assertEquals("SearchIndexingApplication", updated.get(1).getName());
    assertEquals("0 0 1/1 * *", updated.get(1).getAppSchedule().getCronExpression());
  }

  @Test
  void isIdempotentWhenReRunOverAlreadyMigratedCustomCron() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    ApplicationDAO applicationDAO = mock(ApplicationDAO.class);
    when(collectionDAO.applicationDAO()).thenReturn(applicationDAO);
    when(applicationDAO.listAfter(any(ListFilter.class), eq(Integer.MAX_VALUE), eq(""), eq("")))
        .thenReturn(
            List.of(
                appJson("AlreadyMigratedApp", ScheduleTimeline.CUSTOM, "0 0 * * *"),
                appJson("StillQuartzApp", ScheduleTimeline.CUSTOM, "0 0 0 1/1 * ? *")));

    MigrationUtil.migrateCronExpression(collectionDAO);

    ArgumentCaptor<App> appCaptor = ArgumentCaptor.forClass(App.class);
    verify(applicationDAO, times(1)).update(appCaptor.capture());
    assertEquals("StillQuartzApp", appCaptor.getValue().getName());
    assertEquals("0 0 1/1 * *", appCaptor.getValue().getAppSchedule().getCronExpression());
  }

  @Test
  void skipsAppWithMissingAppScheduleAndContinues() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    ApplicationDAO applicationDAO = mock(ApplicationDAO.class);
    when(collectionDAO.applicationDAO()).thenReturn(applicationDAO);
    when(applicationDAO.listAfter(any(ListFilter.class), eq(Integer.MAX_VALUE), eq(""), eq("")))
        .thenReturn(
            List.of(
                appJsonNoSchedule("NoScheduleApp"),
                appJson("CustomApp", ScheduleTimeline.CUSTOM, "0 0 0 1/1 * ? *")));

    MigrationUtil.migrateCronExpression(collectionDAO);

    ArgumentCaptor<App> appCaptor = ArgumentCaptor.forClass(App.class);
    verify(applicationDAO, times(1)).update(appCaptor.capture());
    assertEquals("CustomApp", appCaptor.getValue().getName());
    assertEquals("0 0 1/1 * *", appCaptor.getValue().getAppSchedule().getCronExpression());
  }

  @Test
  void skipsCustomAppWithNullCronAndContinues() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    ApplicationDAO applicationDAO = mock(ApplicationDAO.class);
    when(collectionDAO.applicationDAO()).thenReturn(applicationDAO);
    when(applicationDAO.listAfter(any(ListFilter.class), eq(Integer.MAX_VALUE), eq(""), eq("")))
        .thenReturn(
            List.of(
                appJson("CustomNullCronApp", ScheduleTimeline.CUSTOM, null),
                appJson("CustomApp", ScheduleTimeline.CUSTOM, "0 0 0 1/1 * ? *")));

    MigrationUtil.migrateCronExpression(collectionDAO);

    ArgumentCaptor<App> appCaptor = ArgumentCaptor.forClass(App.class);
    verify(applicationDAO, times(1)).update(appCaptor.capture());
    assertEquals("CustomApp", appCaptor.getValue().getName());
    assertEquals("0 0 1/1 * *", appCaptor.getValue().getAppSchedule().getCronExpression());
  }

  private static String appJson(
      String name, ScheduleTimeline scheduleTimeline, String cronExpression) {
    App app =
        new App()
            .withName(name)
            .withAppSchedule(
                new AppSchedule()
                    .withScheduleTimeline(scheduleTimeline)
                    .withCronExpression(cronExpression));
    return JsonUtils.pojoToJson(app);
  }

  private static String appJsonNoSchedule(String name) {
    App app = new App().withName(name);
    return JsonUtils.pojoToJson(app);
  }
}

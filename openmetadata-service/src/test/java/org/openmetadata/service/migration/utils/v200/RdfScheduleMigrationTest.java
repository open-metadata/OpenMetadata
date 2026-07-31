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
package org.openmetadata.service.migration.utils.v200;

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
import org.openmetadata.service.jdbi3.CollectionDAO.ApplicationDAO;
import org.openmetadata.service.jdbi3.ListFilter;

class RdfScheduleMigrationTest {

  @Test
  void migratesOnlyTheFormerRdfDailyDefault() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    ApplicationDAO applicationDAO = mock(ApplicationDAO.class);
    when(collectionDAO.applicationDAO()).thenReturn(applicationDAO);
    when(applicationDAO.listAfter(any(ListFilter.class), eq(Integer.MAX_VALUE), eq(""), eq("")))
        .thenReturn(
            List.of(
                appJson("RdfIndexApp", ScheduleTimeline.CUSTOM, "0 0 * * *"),
                appJson("RdfIndexApp", ScheduleTimeline.CUSTOM, "15 2 * * *"),
                appJson("RdfIndexApp", ScheduleTimeline.NONE, "0 0 * * *"),
                appJson("RdfIndexApp", ScheduleTimeline.CUSTOM, "0 0 * * 6"),
                appJson("OtherApp", ScheduleTimeline.CUSTOM, "0 0 * * *")));

    MigrationUtil.migrateRdfIndexAppScheduleToWeekly(collectionDAO);

    ArgumentCaptor<App> appCaptor = ArgumentCaptor.forClass(App.class);
    verify(applicationDAO, times(1)).update(appCaptor.capture());
    assertEquals("RdfIndexApp", appCaptor.getValue().getName());
    assertEquals("0 0 * * 6", appCaptor.getValue().getAppSchedule().getCronExpression());
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
}

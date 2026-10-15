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

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * Search and the RDF graph stay in step through live writes and their scheduled repairs, so the
 * weekly full reindexes the Search Indexing and RDF Knowledge Graph Indexing applications shipped
 * with are retired: installs still on a shipped schedule are moved to on-demand runs. A schedule an
 * operator chose is kept.
 */
@Slf4j
public final class ReindexScheduleMigration {
  /** Each reindex application and the weekly cron it shipped with. */
  static final Map<String, String> SHIPPED_WEEKLY_CRONS =
      Map.of(
          "SearchIndexingApplication", "30 0 * * 0",
          "RdfIndexApp", "0 0 * * 6");

  private ReindexScheduleMigration() {}

  public static void retireShippedWeeklyReindexes(final CollectionDAO collectionDAO) {
    try {
      final List<String> applications =
          collectionDAO
              .applicationDAO()
              .listAfter(new ListFilter(Include.ALL), Integer.MAX_VALUE, "", "");
      for (final String applicationJson : applications) {
        retireIfShipped(collectionDAO, JsonUtils.readValue(applicationJson, App.class));
      }
    } catch (RuntimeException e) {
      LOG.error("Could not retire the weekly reindex schedules; continuing the upgrade", e);
    }
  }

  private static void retireIfShipped(final CollectionDAO collectionDAO, final App application) {
    if (isOnShippedWeeklySchedule(application)) {
      application.setAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE));
      collectionDAO.applicationDAO().update(application);
      LOG.info(
          "Moved {} from its shipped weekly schedule to on-demand runs", application.getName());
    }
  }

  static boolean isOnShippedWeeklySchedule(final App application) {
    final AppSchedule schedule = application.getAppSchedule();
    final String shippedCron = SHIPPED_WEEKLY_CRONS.get(application.getName());
    return shippedCron != null
        && schedule != null
        && schedule.getScheduleTimeline() == ScheduleTimeline.CUSTOM
        && shippedCron.equals(schedule.getCronExpression());
  }
}

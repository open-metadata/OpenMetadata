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
package org.openmetadata.service.apps.scheduler;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.quartz.CronTrigger;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;

@DisplayName("AppScheduler misfire policy per app")
class AppSchedulerMisfireTest {

  /**
   * Heavy weekend full-reindex apps must skip a missed fire instead of running it on startup: a
   * pod restarted more than misfireThreshold (60s) after Sat 00:00 / Sun 00:30 would otherwise
   * immediately launch a multi-hour full reindex at deploy time.
   */
  @Test
  @DisplayName("weekend full-reindex apps skip missed runs")
  void heavyReindexAppsSkipMissedRuns() {
    for (String appName : AppScheduler.SKIP_MISSED_RUN_APPS) {
      assertEquals(
          CronTrigger.MISFIRE_INSTRUCTION_DO_NOTHING,
          misfireInstructionFor(appName, "0 0 * * 6"),
          appName + " must not fire a missed weekend run on startup");
    }
  }

  @Test
  @DisplayName("light daily apps keep the catch-up default")
  void lightDailyAppsKeepCatchUpDefault() {
    // FIRE_ONCE_NOW via SMART_POLICY is desirable for a missed 03:00 daily insights run.
    assertEquals(
        Trigger.MISFIRE_INSTRUCTION_SMART_POLICY,
        misfireInstructionFor("DataInsightsApplication", "0 3 * * *"),
        "daily apps should catch up a missed run");
  }

  private static int misfireInstructionFor(String appName, String unixCron) {
    App app =
        new App()
            .withName(appName)
            .withAppSchedule(
                new AppSchedule()
                    .withScheduleTimeline(ScheduleTimeline.CUSTOM)
                    .withCronExpression(unixCron));
    CronTrigger trigger =
        (CronTrigger)
            TriggerBuilder.newTrigger().withSchedule(AppScheduler.scheduleFor(app)).build();
    return trigger.getMisfireInstruction();
  }
}

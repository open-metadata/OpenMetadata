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

package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Alert jobs have one writer. A second one is how a disable and an enable that arrive out of order,
 * or a repair racing a save, leave an enabled alert without a job.
 */
class AlertJobsOwnershipTest {
  private static final Path MAIN_SOURCES = Path.of("src/main/java/org/openmetadata/service");
  private static final List<String> SCANNED =
      List.of(
          "events/",
          "apps/bundles/changeEvent/",
          "resources/events/",
          "jdbi3/EventSubscriptionRepository.java");
  // The audit log and service status jobs are not alert jobs.
  private static final List<String> WRITERS =
      List.of(
          "events/scheduled/AlertJobs.java",
          "events/scheduled/AuditLogSchedule.java",
          "events/scheduled/ServicesStatusJobHandler.java");
  private static final Pattern WRITES_A_JOB =
      Pattern.compile(
          "\\.(scheduleJob|deleteJob|unscheduleJob|triggerJob|rescheduleJob|addJob|pauseJob"
              + "|resumeJob|pauseTrigger|resumeTrigger)\\(|(?<!factory)\\.getScheduler\\(\\)");

  private static final List<String> READERS =
      List.of("events/scheduled/AlertJobs.java", "events/scheduled/AlertJobView.java");
  private static final Pattern NAMES_THE_ALERT_GROUP =
      Pattern.compile("AlertJobs\\.(JOB_GROUP|TRIGGER_GROUP)|\"OMAlertJobGroup\"");

  @Test
  void onlyAlertJobsAndItsViewNameTheAlertGroup() throws IOException {
    try (Stream<Path> sources = Files.walk(MAIN_SOURCES)) {
      List<String> offenders =
          sources
              .filter(path -> path.toString().endsWith(".java"))
              .map(path -> MAIN_SOURCES.relativize(path).toString().replace('\\', '/'))
              .filter(relative -> !READERS.contains(relative))
              .filter(relative -> matches(NAMES_THE_ALERT_GROUP, relative))
              .sorted()
              .toList();

      assertEquals(List.of(), offenders, "Reach alert jobs through AlertJobs or AlertJobView");
    }
  }

  @Test
  void onlyAlertJobsWritesAlertJobs() throws IOException {
    try (Stream<Path> sources = Files.walk(MAIN_SOURCES)) {
      List<String> offenders =
          sources
              .filter(path -> path.toString().endsWith(".java"))
              .map(path -> MAIN_SOURCES.relativize(path).toString().replace('\\', '/'))
              .filter(relative -> SCANNED.stream().anyMatch(relative::startsWith))
              .filter(relative -> !WRITERS.contains(relative))
              .filter(relative -> matches(WRITES_A_JOB, relative))
              .sorted()
              .toList();

      assertEquals(List.of(), offenders, "Call AlertJobs instead of changing a job directly");
    }
  }

  private static boolean matches(Pattern pattern, String relative) {
    try {
      return pattern.matcher(Files.readString(MAIN_SOURCES.resolve(relative))).find();
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }
}

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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("RDF background scheduler")
class RdfBackgroundSchedulerTest {
  private final RdfBackgroundScheduler scheduler =
      new RdfBackgroundScheduler(RdfBackgroundScheduler.DEFAULT_POOL_SIZE);
  private final CountDownLatch blockedTaskStarted = new CountDownLatch(1);
  private final CountDownLatch releaseBlockedTask = new CountDownLatch(1);

  @AfterEach
  void tearDown() {
    releaseBlockedTask.countDown();
    scheduler.stop();
  }

  @Test
  @DisplayName("a blocked task does not delay another periodic task")
  void blockedTaskDoesNotDelayAnotherTask() throws InterruptedException {
    CountDownLatch secondTaskRan = new CountDownLatch(1);
    scheduler.scheduleWithFixedDelay(
        () -> awaitRelease(blockedTaskStarted, releaseBlockedTask), 0, 1, TimeUnit.DAYS);
    assertTrue(blockedTaskStarted.await(5, TimeUnit.SECONDS));
    scheduler.scheduleWithFixedDelay(secondTaskRan::countDown, 0, 1, TimeUnit.DAYS);
    assertTrue(secondTaskRan.await(5, TimeUnit.SECONDS));
  }

  @Test
  @DisplayName("stopping the managed scheduler cancels periodic tasks")
  void stopCancelsPeriodicTasks() {
    ScheduledFuture<?> task =
        scheduler.scheduleWithFixedDelay(releaseBlockedTask::countDown, 1, 1, TimeUnit.DAYS);
    scheduler.stop();
    assertTrue(task.isCancelled());
  }

  private static void awaitRelease(CountDownLatch started, CountDownLatch release) {
    started.countDown();
    try {
      release.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}

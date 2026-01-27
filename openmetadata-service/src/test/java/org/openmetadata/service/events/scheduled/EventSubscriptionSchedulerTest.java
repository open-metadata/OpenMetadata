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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EventSubscriptionSchedulerTest {

  @Test
  @DisplayName("Scheduler should use ALERT_JOB_GROUP for job grouping")
  void testAlertJobGroupConstant() {
    assertEquals(
        "OMAlertJobGroup",
        EventSubscriptionScheduler.ALERT_JOB_GROUP,
        "Job group should be OMAlertJobGroup");
  }

  @Test
  @DisplayName("Scheduler should use ALERT_TRIGGER_GROUP for trigger grouping")
  void testAlertTriggerGroupConstant() {
    assertEquals(
        "OMAlertJobGroup",
        EventSubscriptionScheduler.ALERT_TRIGGER_GROUP,
        "Trigger group should be OMAlertJobGroup");
  }

  @Test
  @DisplayName("Scheduler constants should be defined")
  void testSchedulerConstantsExist() {
    assertNotNull(EventSubscriptionScheduler.ALERT_JOB_GROUP, "ALERT_JOB_GROUP should be defined");
    assertNotNull(
        EventSubscriptionScheduler.ALERT_TRIGGER_GROUP, "ALERT_TRIGGER_GROUP should be defined");
  }
}

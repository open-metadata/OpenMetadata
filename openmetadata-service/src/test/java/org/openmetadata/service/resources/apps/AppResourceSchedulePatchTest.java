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

package org.openmetadata.service.resources.apps;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import java.io.StringReader;
import org.junit.jupiter.api.Test;

/** An app patch that can change the schedule or configuration must reschedule and need EditAll. */
class AppResourceSchedulePatchTest {

  @Test
  void aRootReplaceBundledWithADescriptionEditTouchesScheduleOrConfig() {
    assertTrue(
        AppResource.touchesScheduleOrConfig(
            patch(
                "[{\"op\":\"replace\",\"path\":\"\",\"value\":{\"appSchedule\":"
                    + "{\"scheduleTimeline\":\"Hourly\"}}},"
                    + "{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"tidy up\"}]")));
  }

  @Test
  void aScheduleEditTouchesScheduleOrConfig() {
    assertTrue(
        AppResource.touchesScheduleOrConfig(
            patch(
                "[{\"op\":\"replace\",\"path\":\"/appSchedule/scheduleTimeline\","
                    + "\"value\":\"Hourly\"}]")));
  }

  @Test
  void aDescriptionEditDoesNotTouchScheduleOrConfig() {
    assertFalse(
        AppResource.touchesScheduleOrConfig(
            patch("[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"tidy up\"}]")));
  }

  private static JsonPatch patch(String json) {
    try (JsonReader reader = Json.createReader(new StringReader(json))) {
      return Json.createPatch(reader.readArray());
    }
  }
}

/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.DataAccessRequestPayload;
import org.openmetadata.schema.type.DataAccessType;
import org.openmetadata.schema.type.TaskEntityType;

/**
 * Unit tests for {@link TaskFieldValidator#validateDataAccessRequestDuration}. Every approved Data
 * Access Request reaches an {@code expiryTimer} boundary node. Creation-time validation requires a
 * usable expiry, either a future {@code expirationDate} timestamp or a legacy ISO 8601 duration,
 * so malformed payloads are rejected up front with a 400 ({@link IllegalArgumentException}). ISO
 * 8601 parsing itself is covered in {@code DurationUtilTest}.
 */
class TaskFieldValidatorTest {

  private static Task darTask(String duration) {
    return new Task()
        .withType(TaskEntityType.DataAccessRequest)
        .withPayload(
            new DataAccessRequestPayload()
                .withAccessType(DataAccessType.FullAccess)
                .withReason("need access")
                .withDuration(duration));
  }

  private static Task darTaskWithExpirationDate(long expirationDate) {
    return new Task()
        .withType(TaskEntityType.DataAccessRequest)
        .withPayload(
            new DataAccessRequestPayload()
                .withAccessType(DataAccessType.FullAccess)
                .withReason("need access")
                .withExpirationDate(expirationDate));
  }

  @Test
  void nonDataAccessRequestTaskIsIgnored() {
    // Only DAR tasks carry an access duration; other task types must not be touched.
    Task task = new Task().withType(TaskEntityType.DescriptionUpdate);
    assertDoesNotThrow(() -> TaskFieldValidator.validateDataAccessRequestDuration(task));
  }

  @Test
  void validDayDurationPasses() {
    assertDoesNotThrow(() -> TaskFieldValidator.validateDataAccessRequestDuration(darTask("P14D")));
  }

  @Test
  void validTimeDurationPasses() {
    assertDoesNotThrow(
        () -> TaskFieldValidator.validateDataAccessRequestDuration(darTask("PT30S")));
  }

  @Test
  void futureExpirationDatePasses() {
    long expiresAt = System.currentTimeMillis() + Duration.ofDays(1).toMillis();
    assertDoesNotThrow(
        () ->
            TaskFieldValidator.validateDataAccessRequestDuration(
                darTaskWithExpirationDate(expiresAt)));
  }

  @Test
  void missingDurationIsRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () -> TaskFieldValidator.validateDataAccessRequestDuration(darTask(null)));
  }

  @Test
  void blankDurationIsRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () -> TaskFieldValidator.validateDataAccessRequestDuration(darTask("   ")));
  }

  @Test
  void nonIsoDurationIsRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () -> TaskFieldValidator.validateDataAccessRequestDuration(darTask("14 days")));
  }

  @Test
  void pastExpirationDateIsRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            TaskFieldValidator.validateDataAccessRequestDuration(
                darTaskWithExpirationDate(System.currentTimeMillis() - 1)));
  }
}

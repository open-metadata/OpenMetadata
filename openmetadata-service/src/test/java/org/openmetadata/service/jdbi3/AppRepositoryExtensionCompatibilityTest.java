/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Regression guard for forward-compatible app-extension reads.
 *
 * <p>Extension rows outlive the code that wrote them. A newer build can add a field to an extension
 * payload and later be rolled back, leaving rows the running schema does not recognise. Every
 * {@code listAppExtension*} caller aggregates rows in bulk, so one unparseable row fails the entire
 * scan instead of being skipped — which is how a single row written by a newer build can make an
 * app's whole history unreadable.
 */
class AppRepositoryExtensionCompatibilityTest {

  /** An extension row written by a newer build that knows a field this schema does not. */
  private static final String RUN_RECORD_FROM_NEWER_BUILD =
      """
      {"appName":"TestApp","status":"success","fieldAddedByANewerBuild":"abc"}
      """;

  @Test
  void readExtension_ignoresFieldsTheRunningSchemaDoesNotKnow() {
    AppRunRecord record =
        AppRepository.readExtension(RUN_RECORD_FROM_NEWER_BUILD, AppRunRecord.class);

    assertNotNull(record);
    assertEquals("TestApp", record.getAppName());
    assertEquals(AppRunRecord.Status.SUCCESS, record.getStatus());
  }

  /**
   * Documents why {@link AppRepository#readExtension} exists: the default strict mapper rejects the
   * same payload outright, and that exception is what used to abort a whole bulk scan.
   */
  @Test
  void strictReadRejectsTheSamePayload() {
    assertThrows(
        JsonParsingException.class,
        () -> JsonUtils.readValue(RUN_RECORD_FROM_NEWER_BUILD, AppRunRecord.class));
  }
}

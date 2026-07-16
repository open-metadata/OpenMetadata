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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.FormSchema;
import org.openmetadata.schema.entity.feed.TaskFormSchema;

class TaskFormSchemaRepositoryTest {

  @Test
  void legacyDataAccessRequestSchemaIsDetectedWhenDurationIsRequired() {
    TaskFormSchema schema =
        dataAccessRequestSchema(
            Map.of(
                "required",
                List.of("accessType", "reason", "duration"),
                "properties",
                Map.of("duration", Map.of("type", "string"))));

    assertTrue(TaskFormSchemaRepository.isLegacyDataAccessRequestSchema(schema));
  }

  @Test
  void currentDataAccessRequestSchemaIsNotLegacy() {
    TaskFormSchema schema =
        dataAccessRequestSchema(
            Map.of(
                "required",
                List.of("accessType", "reason", "expirationDate"),
                "properties",
                Map.of("expirationDate", Map.of("type", "number"))));

    assertFalse(TaskFormSchemaRepository.isLegacyDataAccessRequestSchema(schema));
  }

  @Test
  void nonDataAccessRequestSchemaIsNotLegacy() {
    TaskFormSchema schema =
        new TaskFormSchema()
            .withName("CustomTask")
            .withFormSchema(
                formSchema(
                    Map.of(
                        "required",
                        List.of("duration"),
                        "properties",
                        Map.of("duration", Map.of("type", "string")))));

    assertFalse(TaskFormSchemaRepository.isLegacyDataAccessRequestSchema(schema));
  }

  private static TaskFormSchema dataAccessRequestSchema(Map<String, Object> fields) {
    return new TaskFormSchema().withName("DataAccessRequest").withFormSchema(formSchema(fields));
  }

  private static FormSchema formSchema(Map<String, Object> fields) {
    FormSchema formSchema = new FormSchema();
    fields.forEach(formSchema::setAdditionalProperty);
    return formSchema;
  }
}

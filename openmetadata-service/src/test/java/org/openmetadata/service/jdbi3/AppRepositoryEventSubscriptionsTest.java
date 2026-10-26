/*
 *  Copyright 2026 Collate.
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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * An app's eventSubscriptions are the alerts its own code created. The app->alert CONTAINS
 * relationship is their only record, so the list is never stored and a patch cannot change it.
 * AppEventSubscriptionRemovalIT checks the stored relationship itself.
 */
class AppRepositoryEventSubscriptionsTest {

  private static AppRepository repository() {
    return mock(AppRepository.class, CALLS_REAL_METHODS);
  }

  private static App appWithAlert() {
    return new App()
        .withId(UUID.randomUUID())
        .withName("AlertOwningApp")
        .withEventSubscriptions(
            List.of(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(Entity.EVENT_SUBSCRIPTION)
                    .withName("someone-elses-alert")));
  }

  private static JsonPatch patch(final String path) {
    return Json.createPatchBuilder().add(path, "value").build();
  }

  @Test
  void storageJsonLeavesOutTheAlertList() {
    final ObjectNode stored = repository().storageJsonNode(appWithAlert());

    assertFalse(stored.has("eventSubscriptions"));
  }

  @Test
  void versionHistoryLeavesOutTheAlertList() {
    final ObjectNode snapshot =
        (ObjectNode) JsonUtils.readTree(repository().serializeForVersionHistory(appWithAlert()));

    assertFalse(snapshot.has("eventSubscriptions"));
    assertTrue(snapshot.has("name"));
  }

  @Test
  void aPatchOfTheAlertListIsRejected() {
    final App app = appWithAlert();

    assertThrows(
        BadRequestException.class,
        () -> repository().validatePatch(app, app, patch("/eventSubscriptions/-")));
    assertDoesNotThrow(() -> repository().validatePatch(app, app, patch("/description")));
  }
}

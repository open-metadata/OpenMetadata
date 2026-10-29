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

package org.openmetadata.service.resources.query;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import java.io.StringReader;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;

/**
 * Every query write authorizes the assets it attaches the query to or detaches it from, and only
 * those: an asset the query stays on is not being curated by the write.
 */
class QueryTargetChangesTest {
  private static final EntityReference ORDERS = table();
  private static final EntityReference CUSTOMERS = table();
  private static final EntityReference PAYMENTS = table();

  @Test
  void aNewQueryAttachesToEveryAssetItNames() {
    assertEquals(
        List.of(ORDERS, CUSTOMERS),
        QueryResource.changedQueryTargets(null, List.of(ORDERS, CUSTOMERS)));
  }

  @Test
  void anUpdateCoversTheAssetsItAddsAndTheOnesItDrops() {
    assertEquals(
        List.of(PAYMENTS, ORDERS),
        QueryResource.changedQueryTargets(
            List.of(ORDERS, CUSTOMERS), List.of(CUSTOMERS, PAYMENTS)));
  }

  @Test
  void anUpdateThatKeepsItsAssetsChangesNone() {
    assertEquals(
        List.of(),
        QueryResource.changedQueryTargets(
            List.of(ORDERS, CUSTOMERS), List.of(copyOf(CUSTOMERS), copyOf(ORDERS))));
  }

  /** A PUT that leaves out queryUsedIn detaches the query from all of them, as the update stores it. */
  @Test
  void anUpdateWithoutAssetsDetachesAllOfThem() {
    assertEquals(
        List.of(ORDERS, CUSTOMERS),
        QueryResource.changedQueryTargets(List.of(ORDERS, CUSTOMERS), null));
  }

  /** The same id under another type is another asset, so it is authorized as such. */
  @Test
  void theSameIdUnderAnotherTypeIsAnotherAsset() {
    EntityReference asDashboard = copyOf(ORDERS).withType("dashboard");

    assertEquals(
        List.of(asDashboard, ORDERS),
        QueryResource.changedQueryTargets(List.of(ORDERS), List.of(asDashboard)));
  }

  @Test
  void aPatchThatNamesQueryUsedInCanChangeTheAssets() {
    assertTrue(
        QueryResource.patchMayChangeQueryTargets(
            patch(
                "[{\"op\":\"add\",\"path\":\"/queryUsedIn/-\",\"value\":{\"id\":\""
                    + ORDERS.getId()
                    + "\",\"type\":\"table\"}}]")));
  }

  /** A move takes the entry out of queryUsedIn even though only its {@code from} names it. */
  @Test
  void aMoveOutOfQueryUsedInCanChangeTheAssets() {
    assertTrue(
        QueryResource.patchMayChangeQueryTargets(
            patch("[{\"op\":\"move\",\"from\":\"/queryUsedIn/0\",\"path\":\"/usedBy/0\"}]")));
  }

  @Test
  void aRootReplaceBundledWithADescriptionEditCanChangeTheAssets() {
    assertTrue(
        QueryResource.patchMayChangeQueryTargets(
            patch(
                "[{\"op\":\"replace\",\"path\":\"\",\"value\":{\"queryUsedIn\":[]}},"
                    + "{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"tidy up\"}]")));
  }

  @Test
  void aDescriptionEditCannotChangeTheAssets() {
    assertFalse(
        QueryResource.patchMayChangeQueryTargets(
            patch("[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"tidy up\"}]")));
  }

  private static EntityReference table() {
    return new EntityReference().withId(UUID.randomUUID()).withType("table");
  }

  private static EntityReference copyOf(EntityReference reference) {
    return new EntityReference().withId(reference.getId()).withType(reference.getType());
  }

  private static JsonPatch patch(String json) {
    try (JsonReader reader = Json.createReader(new StringReader(json))) {
      return Json.createPatch(reader.readArray());
    }
  }
}

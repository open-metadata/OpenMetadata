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
package org.openmetadata.sdk.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.storages.SpreadsheetService;

/**
 * Regression tests for {@link EntityServiceBase#update}: a detached (no prior get()) partial-entity
 * update must not emit RFC-6902 {@code remove} ops for server-populated fields the caller never
 * submitted. The no-snapshot fallback baseline is pruned to the fields present in the submitted
 * entity before diffing, mirroring {@link
 * org.openmetadata.sdk.resources.BaseResource#update}.
 */
class UpdatePruneBaselineTest {

  private static final String BASE_PATH = "/v1/drives/spreadsheets";
  private static final UUID ENTITY_ID = UUID.randomUUID();
  private static final UUID SERVICE_ID = UUID.randomUUID();
  private static final String ID = ENTITY_ID.toString();
  private static final String NAME = "orders";
  private static final String FQN = "MyDrive.Sheets.orders";
  private static final String DISPLAY_NAME = "Orders Sheet";

  @Mock private HttpClient httpClient;

  private SpreadsheetService spreadsheets;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    spreadsheets = new SpreadsheetService(httpClient);
  }

  /** A realistic default-GET projection the OpenMetadata server returns for a Spreadsheet. */
  private Spreadsheet serverProjection() {
    EntityReference serviceRef =
        new EntityReference()
            .withId(SERVICE_ID)
            .withType("driveService")
            .withName("MyDrive")
            .withFullyQualifiedName("MyDrive");
    return new Spreadsheet()
        .withId(ENTITY_ID)
        .withName(NAME)
        .withFullyQualifiedName(FQN)
        .withDisplayName(DISPLAY_NAME)
        .withDescription("old")
        .withService(serviceRef)
        .withServiceType(
            org.openmetadata.schema.api.services.CreateDriveService.DriveServiceType.GoogleDrive)
        .withVersion(0.1)
        .withUpdatedAt(1700000000000L)
        .withUpdatedBy("admin")
        .withDeleted(false);
  }

  @Test
  void updateWithoutSnapshotDoesNotRemoveUnspecifiedFields() {
    Spreadsheet stored = serverProjection();
    stubDefaultGet(stored);
    ArgumentCaptor<JsonNode> patchCaptor = stubPatch(stored);

    // Detached partial submission: only id, name, description — no prior get(), so no snapshot.
    Spreadsheet detached =
        new Spreadsheet().withId(ENTITY_ID).withName(NAME).withDescription("changed");
    Spreadsheet saved = spreadsheets.update(ID, detached);

    assertNotNull(saved);
    JsonNode patch = patchCaptor.getValue();
    List<String> removedPaths = collectOps(patch, "remove");
    assertTrue(
        removedPaths.isEmpty(),
        "no remove ops should be emitted for unspecified fields, got: " + removedPaths);
    assertTrue(
        hasOp(patch, "replace", "/description"), "the intended description change must be present");
    // The fallback re-fetches the default projection (no fields param) since id/name/description
    // are basic.
    verify(httpClient, times(1))
        .execute(eq(HttpMethod.GET), eq(BASE_PATH + "/" + ID), isNull(), eq(Spreadsheet.class));
  }

  @Test
  void updateWithoutSnapshotDoesNotRemoveServiceReference() {
    Spreadsheet stored = serverProjection();
    stubDefaultGet(stored);
    ArgumentCaptor<JsonNode> patchCaptor = stubPatch(stored);

    Spreadsheet detached =
        new Spreadsheet().withId(ENTITY_ID).withName(NAME).withDescription("changed");
    spreadsheets.update(ID, detached);

    JsonNode patch = patchCaptor.getValue();
    assertFalse(
        hasOp(patch, "remove", "/service"),
        "remove /service causes a server-side NPE in SpreadsheetRepository.prepare");
    assertFalse(hasOp(patch, "remove", "/serviceType"));
  }

  @Test
  void updateWithoutSnapshotDoesNotRemoveBasicServerFields() {
    Spreadsheet stored = serverProjection();
    stubDefaultGet(stored);
    ArgumentCaptor<JsonNode> patchCaptor = stubPatch(stored);

    Spreadsheet detached =
        new Spreadsheet().withId(ENTITY_ID).withName(NAME).withDescription("changed");
    spreadsheets.update(ID, detached);

    JsonNode patch = patchCaptor.getValue();
    assertFalse(hasOp(patch, "remove", "/fullyQualifiedName"));
    assertFalse(
        hasOp(patch, "remove", "/displayName"),
        "remove /displayName silently clears a curated field");
    assertFalse(hasOp(patch, "remove", "/updatedAt"));
    assertFalse(hasOp(patch, "remove", "/updatedBy"));
  }

  @Test
  void updateWithoutSnapshotStillDiffExplicitlySubmittedFields() {
    Spreadsheet stored = serverProjection();
    stubDefaultGet(stored);
    ArgumentCaptor<JsonNode> patchCaptor = stubPatch(stored);

    // The caller explicitly changes displayName in a detached update — that change must be sent.
    Spreadsheet detached =
        new Spreadsheet()
            .withId(ENTITY_ID)
            .withName(NAME)
            .withDisplayName("Renamed Sheet")
            .withDescription("changed");
    spreadsheets.update(ID, detached);

    JsonNode patch = patchCaptor.getValue();
    assertTrue(
        hasOp(patch, "replace", "/displayName"),
        "an explicitly submitted displayName change must be diffed");
    assertTrue(hasOp(patch, "replace", "/description"));
    assertFalse(
        hasOp(patch, "remove", "/service"), "unspecified service must still not be removed");
  }

  @Test
  void updateWithSnapshotCanEmitRemoveForClearedField() {
    Spreadsheet stored = serverProjection();
    stubDefaultGet(stored);
    ArgumentCaptor<JsonNode> patchCaptor = stubPatch(stored);

    // Fetch-then-mutate: the snapshot stores the full projection.
    Spreadsheet fetched = spreadsheets.get(ID);
    assertEquals(DISPLAY_NAME, fetched.getDisplayName());
    fetched.setDisplayName(null); // explicit clear after a fetch must emit a remove op

    spreadsheets.update(ID, fetched);

    JsonNode patch = patchCaptor.getValue();
    assertTrue(
        hasOp(patch, "remove", "/displayName"),
        "snapshot-baselined clear must still emit a remove op");
    assertFalse(hasOp(patch, "remove", "/service"), "unchanged service must not be removed");
  }

  @Test
  void updateWithFullServerPojoProducesNoSpuriousRemoves() {
    Spreadsheet stored = serverProjection();
    stubDefaultGet(stored);
    ArgumentCaptor<JsonNode> patchCaptor = stubPatch(stored);

    // Documented fetch-then-mutate: re-submit the full server POJO with only description changed.
    Spreadsheet fetched = spreadsheets.get(ID);
    fetched.setDescription("changed");
    spreadsheets.update(ID, fetched);

    JsonNode patch = patchCaptor.getValue();
    List<String> removedPaths = collectOps(patch, "remove");
    assertTrue(
        removedPaths.isEmpty(), "fetch-then-mutate must not emit remove ops, got: " + removedPaths);
    assertTrue(hasOp(patch, "replace", "/description"));
  }

  private void stubDefaultGet(Spreadsheet stored) {
    when(httpClient.execute(
            eq(HttpMethod.GET), eq(BASE_PATH + "/" + ID), isNull(), eq(Spreadsheet.class)))
        .thenReturn(stored);
  }

  private ArgumentCaptor<JsonNode> stubPatch(Spreadsheet stored) {
    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    when(httpClient.execute(
            eq(HttpMethod.PATCH),
            eq(BASE_PATH + "/" + ID),
            patchCaptor.capture(),
            eq(Spreadsheet.class),
            isNull()))
        .thenReturn(stored);
    return patchCaptor;
  }

  private static boolean hasOp(JsonNode patch, String op, String path) {
    if (patch == null || !patch.isArray()) {
      return false;
    }
    for (JsonNode operation : patch) {
      if (op.equals(operation.path("op").asText())
          && path.equals(operation.path("path").asText())) {
        return true;
      }
    }
    return false;
  }

  private static List<String> collectOps(JsonNode patch, String op) {
    List<String> paths = new ArrayList<>();
    if (patch == null || !patch.isArray()) {
      return paths;
    }
    for (JsonNode operation : patch) {
      if (op.equals(operation.path("op").asText())) {
        paths.add(operation.path("path").asText());
      }
    }
    return paths;
  }
}

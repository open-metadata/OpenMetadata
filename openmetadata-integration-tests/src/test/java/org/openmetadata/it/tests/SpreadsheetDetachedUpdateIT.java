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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Spreadsheets;

/**
 * End-to-end integration tests for detached (no prior get()) partial-entity updates of
 * Spreadsheet, exercising the real server-side {@code SpreadsheetRepository.prepare} / {@code
 * EntityUpdater} path. Guards against the SDK emitting {@code remove} ops for server-populated
 * fields the caller never submitted, which previously caused a 500 (remove /service NPE) or
 * silent clearing of curated fields (remove /displayName).
 */
@ExtendWith(TestNamespaceExtension.class)
class SpreadsheetDetachedUpdateIT {

  private static OpenMetadataClient admin;

  @BeforeAll
  static void setup() {
    Spreadsheets.setDefaultClient(SdkClients.adminClient());
    admin = SdkClients.adminClient();
  }

  private DriveService newDriveService(TestNamespace ns) {
    return DriveServiceTestFactory.createGoogleDrive(ns);
  }

  /**
   * C1 — a detached partial update (no prior get) must not 500 and must not clear server-populated
   * fields the caller never submitted (service, displayName).
   */
  @Test
  void detachedPartialUpdateDoesNotClearServerFields(TestNamespace ns) {
    DriveService service = newDriveService(ns);
    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.shortPrefix("detached_update"))
            .withDisplayName("Curated Display Name")
            .withDescription("original")
            .withService(service.getFullyQualifiedName())
            .execute();
    assertNotNull(created);
    String id = created.getId().toString();

    // Detached partial POJO: only id, name, description. No prior get() stored a snapshot.
    Spreadsheet detached =
        new Spreadsheet()
            .withId(created.getId())
            .withName(created.getName())
            .withDescription("changed");

    Spreadsheet saved = Spreadsheets.update(id).entity(detached).execute();

    assertEquals("changed", saved.getDescription(), "the submitted description change must apply");
    assertNotNull(saved.getService(), "service reference must not be cleared by a detached update");
    assertEquals(
        created.getService().getId(),
        saved.getService().getId(),
        "service must be the same as the created one");
    assertEquals(
        "Curated Display Name",
        saved.getDisplayName(),
        "displayName must be preserved when the caller did not submit it");

    // Re-fetch the default projection to confirm server-side persistence (not just PATCH echo).
    Spreadsheet refetched = admin.spreadsheets().get(id);
    assertEquals("Curated Display Name", refetched.getDisplayName());
    assertEquals("changed", refetched.getDescription());
    assertNotNull(refetched.getService());
    assertEquals(created.getService().getId(), refetched.getService().getId());
  }

  /**
   * C2 — explicitly submitted fields are still diffed in the no-snapshot path (pruning only drops
   * fields absent from the submission).
   */
  @Test
  void detachedUpdateWithExplicitDisplayNameChangesIt(TestNamespace ns) {
    DriveService service = newDriveService(ns);
    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.shortPrefix("detached_rename"))
            .withDisplayName("Old Display")
            .withDescription("original")
            .withService(service.getFullyQualifiedName())
            .execute();
    String id = created.getId().toString();

    Spreadsheet detached =
        new Spreadsheet()
            .withId(created.getId())
            .withName(created.getName())
            .withDisplayName("New Display")
            .withDescription("changed");

    Spreadsheet saved = Spreadsheets.update(id).entity(detached).execute();
    assertEquals(
        "New Display", saved.getDisplayName(), "explicitly submitted displayName must change");
    assertEquals("changed", saved.getDescription());
    assertEquals(
        created.getService().getId(), saved.getService().getId(), "service must be preserved");

    Spreadsheet refetched = admin.spreadsheets().get(id);
    assertEquals("New Display", refetched.getDisplayName());
  }

  /**
   * C4 — fetch-then-clear of tags still clears them on the server (the snapshot path emits
   * effective remove ops). Confirms the snapshot branch is unaffected by the fix.
   */
  @Test
  void fetchThenClearTagsRemovesStoredTags(TestNamespace ns) {
    DriveService service = newDriveService(ns);
    TagLabel tag = SharedEntities.get().PERSONAL_DATA_TAG_LABEL;
    Spreadsheet created =
        Spreadsheets.create()
            .name(ns.shortPrefix("detached_cleartags"))
            .withDescription("original")
            .withService(service.getFullyQualifiedName())
            .execute();
    String id = created.getId().toString();

    // Add a tag via get(tags) -> set -> update so a snapshot is stored for id.
    Spreadsheet withTags = admin.spreadsheets().get(id, "tags");
    withTags.setTags(List.of(tag));
    admin.spreadsheets().update(id, withTags);

    Spreadsheet fetched = admin.spreadsheets().get(id, "tags");
    assertEquals(1, fetched.getTags().size(), "tag must be stored");
    assertTrue(
        fetched.getTags().stream().anyMatch(t -> tag.getTagFQN().equals(t.getTagFQN())),
        "the added tag must be present");

    // Clear the tags list (snapshot is stored from the prior get with tags).
    fetched.getTags().clear();
    admin.spreadsheets().update(id, fetched);

    Spreadsheet refetched = admin.spreadsheets().get(id, "tags");
    assertTrue(
        refetched.getTags() == null || refetched.getTags().isEmpty(), "tags must be cleared");
  }
}

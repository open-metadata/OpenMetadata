/*
 *  Copyright 2024 Collate
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

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.feed.CreateAnnouncement;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.AnnouncementColor;
import org.openmetadata.schema.type.AnnouncementStatus;
import org.openmetadata.schema.type.AnnouncementType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class AnnouncementResourceIT extends BaseEntityIT<Announcement, CreateAnnouncement> {

  public AnnouncementResourceIT() {
    supportsEntityStatus = false;
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = true;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = true;
    supportsSearchIndex = false;
    supportsVersionHistory = false;
    supportsGetByVersion = false;
  }

  @Override
  protected CreateAnnouncement createMinimalRequest(TestNamespace ns) {
    long now = System.currentTimeMillis();
    return new CreateAnnouncement()
        .withName(ns.prefix("announcement"))
        .withDescription("Test announcement")
        .withStartTime(now)
        .withEndTime(now + 86400000L);
  }

  @Override
  protected CreateAnnouncement createRequest(String name, TestNamespace ns) {
    long now = System.currentTimeMillis();
    return new CreateAnnouncement()
        .withName(name)
        .withDescription("Test announcement")
        .withStartTime(now)
        .withEndTime(now + 86400000L);
  }

  @Override
  protected Announcement createEntity(CreateAnnouncement createRequest) {
    return SdkClients.adminClient().announcements().create(createRequest);
  }

  @Override
  protected Announcement getEntity(String id) {
    return SdkClients.adminClient().announcements().get(id);
  }

  @Override
  protected Announcement getEntityByName(String fqn) {
    return SdkClients.adminClient().announcements().getByName(fqn);
  }

  @Override
  protected Announcement patchEntity(String id, Announcement entity) {
    return SdkClients.adminClient().announcements().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().announcements().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().announcements().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .announcements()
        .delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "announcement";
  }

  @Override
  protected ListResponse<Announcement> listEntities(ListParams params) {
    return SdkClients.adminClient().announcements().list(params);
  }

  @Override
  protected Announcement getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().announcements().get(id, fields);
  }

  @Override
  protected Announcement getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().announcements().getByName(fqn, fields);
  }

  @Override
  protected Announcement getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().announcements().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().announcements().getVersionList(id);
  }

  @Override
  protected Announcement getVersion(UUID id, Double version) {
    return SdkClients.adminClient().announcements().getVersion(id.toString(), version);
  }

  @Override
  protected void validateCreatedEntity(Announcement created, CreateAnnouncement request) {
    assertEquals(request.getName(), created.getName());
    assertEquals(request.getDescription(), created.getDescription());
    assertNotNull(created.getStartTime());
    assertNotNull(created.getEndTime());
    assertNotNull(created.getStatus());
  }

  @Test
  void testActiveAnnouncementGetsActiveStatus(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("active-ann"))
            .withDescription("Active announcement")
            .withStartTime(now - 3600000L)
            .withEndTime(now + 3600000L);

    Announcement created = createEntity(request);
    assertEquals(AnnouncementStatus.Active, created.getStatus());
  }

  @Test
  void testScheduledAnnouncementGetsScheduledStatus(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("scheduled-ann"))
            .withDescription("Scheduled announcement")
            .withStartTime(now + 86400000L)
            .withEndTime(now + 172800000L);

    Announcement created = createEntity(request);
    assertEquals(AnnouncementStatus.Scheduled, created.getStatus());
  }

  @Test
  void testExpiredAnnouncementGetsExpiredStatus(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("expired-ann"))
            .withDescription("Expired announcement")
            .withStartTime(now - 172800000L)
            .withEndTime(now - 86400000L);

    Announcement created = createEntity(request);
    assertEquals(AnnouncementStatus.Expired, created.getStatus());
  }

  @Test
  void testCreateAnnouncementWithDisplayName(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("display-ann"))
            .withDisplayName("Important Maintenance Window")
            .withDescription("System maintenance scheduled")
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    Announcement created = createEntity(request);
    assertEquals("Important Maintenance Window", created.getDisplayName());
  }

  @Test
  void testAnnouncementTypeDefaultsToNotice(TestNamespace ns) {
    Announcement created = createEntity(createMinimalRequest(ns));
    assertEquals(AnnouncementType.Notice, created.getType());

    Announcement fetched = getEntity(created.getId().toString());
    assertEquals(AnnouncementType.Notice, fetched.getType());
  }

  @Test
  void testAnnouncementTypeRoundTrips(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("warning-ann"))
            .withDescription("Schema change coming")
            .withType(AnnouncementType.Warning)
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    Announcement created = createEntity(request);
    assertEquals(AnnouncementType.Warning, created.getType());

    Announcement fetched = getEntity(created.getId().toString());
    assertEquals(AnnouncementType.Warning, fetched.getType());
  }

  @Test
  void testAnnouncementExplicitNullTypeBackfillsNotice(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("null-type-ann"))
            .withDescription("Type omitted explicitly")
            .withType(null)
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    Announcement created = createEntity(request);
    assertEquals(AnnouncementType.Notice, created.getType());

    Announcement fetched = getEntity(created.getId().toString());
    assertEquals(AnnouncementType.Notice, fetched.getType());
  }

  @Test
  void testPatchAnnouncementType(TestNamespace ns) {
    Announcement created = createEntity(createMinimalRequest(ns));
    assertEquals(AnnouncementType.Notice, created.getType());

    created.setType(AnnouncementType.Critical);
    Announcement updated = patchEntity(created.getId().toString(), created);
    assertEquals(AnnouncementType.Critical, updated.getType());

    Announcement fetched = getEntity(created.getId().toString());
    assertEquals(AnnouncementType.Critical, fetched.getType());
  }

  @Test
  void testCustomAnnouncementRoundTripsItsColourAndName(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("custom-ann"))
            .withDescription("Custom announcement")
            .withType(AnnouncementType.Custom)
            .withColor(AnnouncementColor.Pink)
            .withCustomTypeName("Release")
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    Announcement created = createEntity(request);
    assertEquals(AnnouncementColor.Pink, created.getColor());
    assertEquals("Release", created.getCustomTypeName());

    Announcement fetched = getEntity(created.getId().toString());
    assertEquals(AnnouncementColor.Pink, fetched.getColor());
    assertEquals("Release", fetched.getCustomTypeName());
  }

  /**
   * Without a {@code recordChange} for each field, a patch that touches only the colour or only the
   * custom name is silently a no-op - the same way a type-only patch was before the type field
   * recorded its change.
   */
  @Test
  void testPatchAnnouncementColourOnly(TestNamespace ns) {
    long now = System.currentTimeMillis();
    Announcement created =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("colour-patch-ann"))
                .withDescription("Custom announcement")
                .withType(AnnouncementType.Custom)
                .withColor(AnnouncementColor.Pink)
                .withCustomTypeName("Release")
                .withStartTime(now)
                .withEndTime(now + 86400000L));

    created.setColor(AnnouncementColor.Blue);
    Announcement updated = patchEntity(created.getId().toString(), created);
    assertEquals(AnnouncementColor.Blue, updated.getColor());
    assertEquals(AnnouncementColor.Blue, getEntity(created.getId().toString()).getColor());
  }

  @Test
  void testPatchAnnouncementCustomTypeNameOnly(TestNamespace ns) {
    long now = System.currentTimeMillis();
    Announcement created =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("custom-name-patch-ann"))
                .withDescription("Custom announcement")
                .withType(AnnouncementType.Custom)
                .withColor(AnnouncementColor.Pink)
                .withCustomTypeName("Release")
                .withStartTime(now)
                .withEndTime(now + 86400000L));

    created.setCustomTypeName("Rollout");
    Announcement updated = patchEntity(created.getId().toString(), created);
    assertEquals("Rollout", updated.getCustomTypeName());
    assertEquals("Rollout", getEntity(created.getId().toString()).getCustomTypeName());
  }

  /**
   * The drawer's status tabs rely on the window, not on the stored {@code status}. An announcement
   * whose window has closed since it was written still carries {@code status: Active} in its JSON,
   * so a filter reading that column would put it under the wrong tab.
   */
  @Test
  void testListAnnouncementsByStatusDerivesTheWindow(TestNamespace ns) {
    long now = System.currentTimeMillis();
    long day = 86400000L;
    String entityLink = "<#E::table::" + ns.prefix("service.db.schema.status") + ">";

    Announcement active =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("status-active"))
                .withDescription("Active announcement")
                .withEntityLink(entityLink)
                .withStartTime(now - day)
                .withEndTime(now + day));
    Announcement scheduled =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("status-scheduled"))
                .withDescription("Scheduled announcement")
                .withEntityLink(entityLink)
                .withStartTime(now + day)
                .withEndTime(now + 2 * day));
    Announcement expired =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("status-expired"))
                .withDescription("Expired announcement")
                .withEntityLink(entityLink)
                .withStartTime(now - 2 * day)
                .withEndTime(now - day));

    assertEquals(List.of(active.getId()), idsForStatus(entityLink, AnnouncementStatus.Active));
    assertEquals(
        List.of(scheduled.getId()), idsForStatus(entityLink, AnnouncementStatus.Scheduled));
    assertEquals(List.of(expired.getId()), idsForStatus(entityLink, AnnouncementStatus.Expired));
  }

  /**
   * `status` and `active` have to compose. They used to travel different paths: a custom DAO query
   * took over whenever `active` was set and read the stored `status` column, so once the resource
   * moved status onto its own filter param the predicate was silently dropped and
   * {@code ?active=true&status=Scheduled} returned every active announcement.
   */
  @Test
  void testListAnnouncementsByStatusAndActiveTogether(TestNamespace ns) {
    long now = System.currentTimeMillis();
    long day = 86400000L;
    String entityLink = "<#E::table::" + ns.prefix("service.db.schema.statusactive") + ">";

    createEntity(
        new CreateAnnouncement()
            .withName(ns.prefix("combo-active"))
            .withDescription("Active announcement")
            .withEntityLink(entityLink)
            .withStartTime(now - day)
            .withEndTime(now + day));
    Announcement scheduled =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("combo-scheduled"))
                .withDescription("Scheduled announcement")
                .withEntityLink(entityLink)
                .withStartTime(now + day)
                .withEndTime(now + 2 * day));

    // Contradictory by construction: nothing is both currently active and scheduled.
    assertEquals(List.of(), idsForStatusAndActive(entityLink, AnnouncementStatus.Active, false));
    assertEquals(List.of(), idsForStatusAndActive(entityLink, AnnouncementStatus.Scheduled, true));
    // And the agreeing combination still narrows to the one announcement.
    assertEquals(
        List.of(scheduled.getId()),
        idsForStatusAndActive(entityLink, AnnouncementStatus.Scheduled, false));
  }

  /**
   * The list filter derives status from the window, so the payload has to as well — otherwise
   * `?status=Expired` returns an announcement whose own `status` field still reads `Active`.
   */
  @Test
  void testStatusOnReadTracksTheWindowNotTheStoredValue(TestNamespace ns) {
    long now = System.currentTimeMillis();
    long day = 86400000L;

    Announcement created =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("status-on-read"))
                .withDescription("Born active")
                .withStartTime(now - day)
                .withEndTime(now + day));
    assertEquals(AnnouncementStatus.Active, created.getStatus());

    // Push the window into the past; the stored snapshot is not rewritten by a patch.
    created.setStartTime(now - 2 * day);
    created.setEndTime(now - day);
    patchEntity(created.getId().toString(), created);

    assertEquals(AnnouncementStatus.Expired, getEntity(created.getId().toString()).getStatus());

    // And on the list path, which reaches setFieldsInBulk rather than setFields. Asserting only
    // the GET above is how the two came to disagree: `?status=Expired` matched this row while the
    // payload it returned still said `Active`.
    Announcement listed =
        listEntities(
                new ListParams()
                    .addQueryParam("status", AnnouncementStatus.Expired.value())
                    .setLimit(100))
            .getData()
            .stream()
            .filter(a -> a.getId().equals(created.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(AnnouncementStatus.Expired, listed.getStatus());
  }

  /**
   * The schema requires both times, but only on the create/PUT body: PATCH binds the patched JSON
   * with no bean validation, so a remove op could leave an announcement with no window at all.
   */
  @Test
  void testPatchCannotRemoveTheTimeWindow(TestNamespace ns) {
    long now = System.currentTimeMillis();
    Announcement created =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("window-required"))
                .withDescription("Keeps its window")
                .withStartTime(now)
                .withEndTime(now + 86400000L));
    String id = created.getId().toString();

    for (String field : List.of("startTime", "endTime")) {
      assertThrows(
          InvalidRequestException.class,
          () ->
              SdkClients.adminClient()
                  .announcements()
                  .patch(
                      id, JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/" + field + "\"}]")),
          field);
    }

    Announcement unchanged = getEntity(id);
    assertEquals(created.getStartTime(), unchanged.getStartTime());
    assertEquals(created.getEndTime(), unchanged.getEndTime());
    assertEquals(AnnouncementStatus.Active, unchanged.getStatus());
  }

  @Test
  void testCustomAnnouncementRequiresItsName(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("custom-no-name"))
            .withDescription("Custom with no label")
            .withType(AnnouncementType.Custom)
            .withColor(AnnouncementColor.Pink)
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    // InvalidRequestException is the SDK's 400 and only its 400 — a 500 surfaces as ApiException,
    // so this pins the rejection to a bad request rather than any failure at all.
    assertThrows(InvalidRequestException.class, () -> createEntity(request));
  }

  /**
   * The form marks colour required for Custom, but API, MCP and script callers do not go through
   * the form. Without the server check a Custom announcement arrives with no colour and renders in
   * the UI's pink fallback, which reads as a colour its author chose.
   */
  @Test
  void testCustomAnnouncementRequiresItsColour(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("custom-no-colour"))
            .withDescription("Custom with no colour")
            .withType(AnnouncementType.Custom)
            .withCustomTypeName("Release")
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    assertThrows(InvalidRequestException.class, () -> createEntity(request));
  }

  /**
   * {@code maxLength: 64} rides on {@code @Valid CreateAnnouncement}, so it runs on create and PUT
   * only. PATCH binds the patched JSON straight to the POJO with no bean validation, which let an
   * over-length name through until the repository checked it itself.
   */
  @Test
  void testPatchCannotExceedCustomTypeNameLength(TestNamespace ns) {
    long now = System.currentTimeMillis();
    Announcement created =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("custom-long-name-patch"))
                .withDescription("Custom announcement")
                .withType(AnnouncementType.Custom)
                .withColor(AnnouncementColor.Pink)
                .withCustomTypeName("Release")
                .withStartTime(now)
                .withEndTime(now + 86400000L));

    created.setCustomTypeName("x".repeat(200));

    // Asserted on the cause, not the thrown type: unlike create, the SDK's update() wraps every
    // failure in a bare OpenMetadataException, so the typed 400 only survives underneath it.
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> patchEntity(created.getId().toString(), created));
    InvalidRequestException rejected =
        assertInstanceOf(InvalidRequestException.class, error.getCause());
    assertTrue(rejected.getMessage().contains("64"));
    assertEquals("Release", getEntity(created.getId().toString()).getCustomTypeName());
  }

  /** 64 characters exactly is the limit, not one past it. */
  @Test
  void testCustomTypeNameAtTheLengthLimitIsAccepted(TestNamespace ns) {
    long now = System.currentTimeMillis();
    String name = "x".repeat(64);
    Announcement created =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("custom-limit-name"))
                .withDescription("Custom announcement")
                .withType(AnnouncementType.Custom)
                .withColor(AnnouncementColor.Pink)
                .withCustomTypeName(name)
                .withStartTime(now)
                .withEndTime(now + 86400000L));

    assertEquals(name, created.getCustomTypeName());
    assertEquals(name, getEntity(created.getId().toString()).getCustomTypeName());
  }

  /** Colour and name are Custom-only, so the server drops them rather than storing dead data. */
  @Test
  void testNonCustomAnnouncementDropsColourAndName(TestNamespace ns) {
    long now = System.currentTimeMillis();
    Announcement created =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("warning-with-colour"))
                .withDescription("Warning that tried to carry a colour")
                .withType(AnnouncementType.Warning)
                .withColor(AnnouncementColor.Pink)
                .withCustomTypeName("Ignored")
                .withStartTime(now)
                .withEndTime(now + 86400000L));

    assertNull(created.getColor());
    assertNull(created.getCustomTypeName());
  }

  private List<UUID> idsForStatusAndActive(
      String entityLink, AnnouncementStatus status, boolean active) {
    return listEntities(
            new ListParams()
                .addQueryParam("status", status.value())
                .addQueryParam("active", String.valueOf(active))
                .addQueryParam("entityLink", entityLink)
                .setLimit(100))
        .getData()
        .stream()
        .map(Announcement::getId)
        .toList();
  }

  private List<UUID> idsForStatus(String entityLink, AnnouncementStatus status) {
    return listEntities(
            new ListParams()
                .addQueryParam("status", status.value())
                .addQueryParam("entityLink", entityLink)
                .setLimit(100))
        .getData()
        .stream()
        .map(Announcement::getId)
        .toList();
  }

  @Test
  void testUpdateAnnouncementDescription(TestNamespace ns) {
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("update-ann"))
            .withDescription("Original description")
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    Announcement created = createEntity(request);
    assertEquals("Original description", created.getDescription());

    created.setDescription("Updated description");
    Announcement updated = patchEntity(created.getId().toString(), created);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void testListAnnouncements(TestNamespace ns) {
    long now = System.currentTimeMillis();
    for (int i = 0; i < 3; i++) {
      CreateAnnouncement request =
          new CreateAnnouncement()
              .withName(ns.prefix("list-ann-" + i))
              .withDescription("Announcement " + i)
              .withStartTime(now)
              .withEndTime(now + 86400000L);
      createEntity(request);
    }

    ListResponse<Announcement> list = listEntities(new ListParams().setLimit(100));
    assertNotNull(list);
    assertNotNull(list.getData());
    assertTrue(list.getData().size() >= 3);
  }

  @Test
  void testListAnnouncementsByEntityLink(TestNamespace ns) {
    long now = System.currentTimeMillis();
    String entityLink = "<#E::table::" + ns.prefix("service.db.schema.table") + ">";
    CreateAnnouncement matching =
        new CreateAnnouncement()
            .withName(ns.prefix("entity-link-match"))
            .withDescription("Entity scoped announcement")
            .withEntityLink(entityLink)
            .withStartTime(now)
            .withEndTime(now + 86400000L);
    CreateAnnouncement nonMatching =
        new CreateAnnouncement()
            .withName(ns.prefix("entity-link-other"))
            .withDescription("Other entity announcement")
            .withEntityLink("<#E::table::" + ns.prefix("service.db.schema.other") + ">")
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    Announcement createdMatching = createEntity(matching);
    createEntity(nonMatching);

    ListResponse<Announcement> list =
        listEntities(new ListParams().addQueryParam("entityLink", entityLink).setLimit(100));

    assertEquals(1, list.getData().size());
    assertEquals(createdMatching.getId(), list.getData().get(0).getId());
  }

  @Test
  void testListAnnouncementsByType(TestNamespace ns) {
    long now = System.currentTimeMillis();
    String entityLink = "<#E::table::" + ns.prefix("service.db.schema.typed") + ">";
    Announcement warning =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("type-filter-warning"))
                .withDescription("Warning announcement")
                .withType(AnnouncementType.Warning)
                .withEntityLink(entityLink)
                .withStartTime(now)
                .withEndTime(now + 86400000L));
    Announcement information =
        createEntity(
            new CreateAnnouncement()
                .withName(ns.prefix("type-filter-info"))
                .withDescription("Notice announcement")
                .withEntityLink(entityLink)
                .withStartTime(now)
                .withEndTime(now + 86400000L));

    ListResponse<Announcement> warnings =
        listEntities(
            new ListParams()
                .addQueryParam("type", "Warning")
                .addQueryParam("entityLink", entityLink)
                .setLimit(100));
    assertEquals(
        List.of(warning.getId()), warnings.getData().stream().map(Announcement::getId).toList());

    ListResponse<Announcement> informational =
        listEntities(
            new ListParams()
                .addQueryParam("type", "Notice")
                .addQueryParam("entityLink", entityLink)
                .setLimit(100));
    assertEquals(
        List.of(information.getId()),
        informational.getData().stream().map(Announcement::getId).toList());

    ListResponse<Announcement> activeWarnings =
        listEntities(
            new ListParams()
                .addQueryParam("type", "Warning")
                .addQueryParam("active", "true")
                .addQueryParam("entityLink", entityLink)
                .setLimit(100));
    assertEquals(
        List.of(warning.getId()),
        activeWarnings.getData().stream().map(Announcement::getId).toList());
  }

  @Test
  void testListActiveAnnouncements(TestNamespace ns) {
    long now = System.currentTimeMillis();
    String entityLink = "<#E::table::" + ns.prefix("service.db.schema.active") + ">";
    CreateAnnouncement activeAnnouncement =
        new CreateAnnouncement()
            .withName(ns.prefix("active-filter-match"))
            .withDescription("Active announcement")
            .withEntityLink(entityLink)
            .withStartTime(now - 3600000L)
            .withEndTime(now + 3600000L);
    CreateAnnouncement inactiveAnnouncement =
        new CreateAnnouncement()
            .withName(ns.prefix("active-filter-miss"))
            .withDescription("Inactive announcement")
            .withEntityLink(entityLink)
            .withStartTime(now + 86400000L)
            .withEndTime(now + 172800000L);

    Announcement createdActive = createEntity(activeAnnouncement);
    createEntity(inactiveAnnouncement);

    ListResponse<Announcement> list =
        listEntities(
            new ListParams()
                .addQueryParam("active", "true")
                .addQueryParam("entityLink", entityLink)
                .setLimit(100));

    assertTrue(list.getData().stream().anyMatch(a -> a.getId().equals(createdActive.getId())));
    assertTrue(
        list.getData().stream().noneMatch(a -> a.getName().equals(inactiveAnnouncement.getName())));
  }

  @Test
  void testGetAnnouncementById(TestNamespace ns) {
    CreateAnnouncement request = createMinimalRequest(ns);
    Announcement created = createEntity(request);

    Announcement fetched = getEntity(created.getId().toString());
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void testGetAnnouncementByName(TestNamespace ns) {
    CreateAnnouncement request = createMinimalRequest(ns);
    Announcement created = createEntity(request);

    Announcement fetched = getEntityByName(created.getFullyQualifiedName());
    assertEquals(created.getId(), fetched.getId());
  }

  @Test
  void testSoftDeleteAndRestore(TestNamespace ns) {
    CreateAnnouncement request = createMinimalRequest(ns);
    Announcement created = createEntity(request);

    deleteEntity(created.getId().toString());

    Announcement deleted = getEntityIncludeDeleted(created.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(created.getId().toString());
    Announcement restored = getEntity(created.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void testVersionHistory(TestNamespace ns) {
    CreateAnnouncement request = createMinimalRequest(ns);
    Announcement created = createEntity(request);

    created.setDescription("Updated for version test");
    patchEntity(created.getId().toString(), created);

    EntityHistory history = getVersionHistory(created.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void testAnnouncementInheritsTargetOwnersAndDomains(TestNamespace ns) throws Exception {
    Table table = createTestTable(ns);
    long now = System.currentTimeMillis();
    CreateAnnouncement request =
        new CreateAnnouncement()
            .withName(ns.prefix("entity-ann"))
            .withDescription("Entity-linked announcement")
            .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
            .withStartTime(now)
            .withEndTime(now + 86400000L);

    Announcement created = createEntity(request);
    Announcement fetched = getEntityWithFields(created.getId().toString(), "owners,domains");

    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
    assertNotNull(fetched.getDomains());
    assertFalse(fetched.getDomains().isEmpty());
  }

  private Table createTestTable(TestNamespace ns) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    table = SdkClients.adminClient().tables().get(table.getId().toString(), "owners,domains");
    table
        .withOwners(List.of(testUser1().getEntityReference()))
        .withDomains(List.of(testDomain().getEntityReference()));
    Table updated = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    return SdkClients.adminClient().tables().get(updated.getId().toString(), "owners,domains");
  }
}

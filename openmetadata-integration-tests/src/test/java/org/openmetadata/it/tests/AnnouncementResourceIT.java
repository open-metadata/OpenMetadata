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
import org.openmetadata.schema.type.AnnouncementStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class AnnouncementResourceIT extends BaseEntityIT<Announcement, CreateAnnouncement> {

  public AnnouncementResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = true;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = true;
    supportsSearchIndex = false;
    supportsVersionHistory = true;
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

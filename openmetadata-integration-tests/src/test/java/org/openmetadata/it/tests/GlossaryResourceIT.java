/*
 *  Copyright 2021 Collate
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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Glossary entity operations.
 *
 * <p>Extends BaseEntityIT to inherit all common entity tests. Adds glossary-specific tests for
 * reviewers, mutually exclusive terms, and term hierarchy.
 *
 * <p>Migrated from: org.openmetadata.service.resources.glossary.GlossaryResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryResourceIT extends BaseEntityIT<Glossary, CreateGlossary> {

  public GlossaryResourceIT() {
    supportsFollowers = false;
    supportsTags = true;
    supportsDomains = true;
    supportsDataProducts = true;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = true;
  }

  @Override
  protected CreateGlossary createMinimalRequest(TestNamespace ns) {
    return new CreateGlossary()
        .withName(ns.prefix("glossary"))
        .withDescription("Test glossary created by integration test");
  }

  @Override
  protected CreateGlossary createRequest(String name, TestNamespace ns) {
    return new CreateGlossary().withName(name).withDescription("Test glossary");
  }

  @Override
  protected Glossary createEntity(CreateGlossary createRequest) {
    return SdkClients.adminClient().glossaries().create(createRequest);
  }

  @Override
  protected Glossary getEntity(String id) {
    return SdkClients.adminClient().glossaries().get(id);
  }

  @Override
  protected Glossary getEntityByName(String fqn) {
    return SdkClients.adminClient().glossaries().getByName(fqn);
  }

  @Override
  protected Glossary patchEntity(String id, Glossary entity) {
    entity.setTermCount(null);
    entity.setUsageCount(null);
    return SdkClients.adminClient().glossaries().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().glossaries().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().glossaries().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .glossaries()
        .delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "glossary";
  }

  @Override
  protected void validateCreatedEntity(Glossary entity, CreateGlossary createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
    if (createRequest.getMutuallyExclusive() != null) {
      assertEquals(createRequest.getMutuallyExclusive(), entity.getMutuallyExclusive());
    }
  }

  @Override
  protected Glossary getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().glossaries().get(id, fields);
  }

  @Override
  protected Glossary getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().glossaries().getByName(fqn, fields);
  }

  @Override
  protected Glossary getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().glossaries().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<Glossary> listEntities(ListParams params) {
    return SdkClients.adminClient().glossaries().list(params);
  }

  // ===================================================================
  // GLOSSARY-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createGlossaryWithDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossaryDisplayName"))
            .withDisplayName("My Custom Glossary")
            .withDescription("Glossary with display name");

    Glossary glossary = createEntity(create);
    assertEquals("My Custom Glossary", glossary.getDisplayName());
  }

  @Test
  void test_createGlossaryMutuallyExclusive(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossaryMutuallyExclusive"))
            .withMutuallyExclusive(true)
            .withDescription("Mutually exclusive glossary");

    Glossary glossary = createEntity(create);
    assertTrue(glossary.getMutuallyExclusive());
  }

  @Test
  void test_createGlossaryWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference ownerRef = testUser1().getEntityReference();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("ownedGlossary"))
            .withOwners(List.of(ownerRef))
            .withDescription("Glossary with owner");

    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
  }

  @Test
  void test_createGlossaryWithReviewers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference reviewerRef = testUser1().getEntityReference();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("reviewedGlossary"))
            .withReviewers(List.of(reviewerRef))
            .withDescription("Glossary with reviewers");

    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "reviewers");
    assertNotNull(fetched.getReviewers());
    assertFalse(fetched.getReviewers().isEmpty());
  }

  @Test
  void test_updateGlossaryDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    glossary.setDescription("Updated glossary description");
    Glossary updated = patchEntity(glossary.getId().toString(), glossary);

    assertEquals("Updated glossary description", updated.getDescription());
  }

  @Test
  void test_updateGlossaryDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    glossary.setDisplayName("My Updated Glossary");
    Glossary updated = patchEntity(glossary.getId().toString(), glossary);

    assertEquals("My Updated Glossary", updated.getDisplayName());
  }

  @Test
  void test_mutuallyExclusiveImmutableAfterCreation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("immutableMutuallyExclusive"))
            .withMutuallyExclusive(false)
            .withDescription("Glossary with immutable mutuallyExclusive");

    Glossary glossary = createEntity(create);
    assertFalse(glossary.getMutuallyExclusive());

    glossary.setMutuallyExclusive(true);
    Glossary updated = patchEntity(glossary.getId().toString(), glossary);

    assertFalse(updated.getMutuallyExclusive());
  }

  @Test
  void test_addReviewersToGlossary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "reviewers");
    EntityReference reviewerRef = testUser1().getEntityReference();
    fetched.setReviewers(List.of(reviewerRef));

    Glossary updated = patchEntity(fetched.getId().toString(), fetched);

    Glossary verify = client.glossaries().get(updated.getId().toString(), "reviewers");
    assertNotNull(verify.getReviewers());
    assertTrue(verify.getReviewers().stream().anyMatch(r -> r.getId().equals(reviewerRef.getId())));
  }

  @Test
  void test_softDeleteAndRestoreGlossary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);
    String glossaryId = glossary.getId().toString();

    deleteEntity(glossaryId);

    assertThrows(
        Exception.class, () -> getEntity(glossaryId), "Deleted glossary should not be retrievable");

    Glossary deleted = getEntityIncludeDeleted(glossaryId);
    assertTrue(deleted.getDeleted());

    restoreEntity(glossaryId);

    Glossary restored = getEntity(glossaryId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_hardDeleteGlossary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);
    String glossaryId = glossary.getId().toString();

    hardDeleteEntity(glossaryId);

    assertThrows(
        Exception.class,
        () -> getEntity(glossaryId),
        "Hard deleted glossary should not be retrievable");
  }

  @Test
  void test_glossaryVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);
    assertEquals(0.1, glossary.getVersion(), 0.001);

    glossary.setDescription("Updated description v1");
    Glossary v2 = patchEntity(glossary.getId().toString(), glossary);
    assertEquals(0.2, v2.getVersion(), 0.001);

    var history = client.glossaries().getVersionList(glossary.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_listGlossaries(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      CreateGlossary create =
          new CreateGlossary()
              .withName(ns.prefix("listGlossary" + i))
              .withDescription("Glossary for list test");
      createEntity(create);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Glossary> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_getGlossaryWithReviewersField(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference reviewerRef = testUser1().getEntityReference();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossaryWithReviewersField"))
            .withReviewers(List.of(reviewerRef))
            .withDescription("Glossary to test reviewers field");

    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "reviewers");
    assertNotNull(fetched.getReviewers());
    assertFalse(fetched.getReviewers().isEmpty());

    for (EntityReference reviewer : fetched.getReviewers()) {
      assertNotNull(reviewer.getId());
      assertNotNull(reviewer.getName());
      assertNotNull(reviewer.getType());
    }
  }

  @Test
  void test_getGlossaryWithOwnersField(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference ownerRef = testUser1().getEntityReference();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossaryWithOwnersField"))
            .withOwners(List.of(ownerRef))
            .withDescription("Glossary to test owners field");

    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());

    for (EntityReference owner : fetched.getOwners()) {
      assertNotNull(owner.getId());
      assertNotNull(owner.getName());
      assertNotNull(owner.getType());
    }
  }

  @Test
  void test_createGlossaryNotMutuallyExclusive(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossaryNotMutuallyExclusive"))
            .withMutuallyExclusive(false)
            .withDescription("Not mutually exclusive glossary");

    Glossary glossary = createEntity(create);
    assertFalse(glossary.getMutuallyExclusive());
  }

  @Test
  void test_addMultipleReviewers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "reviewers");

    EntityReference reviewer1 = testUser1().getEntityReference();
    EntityReference reviewer2 = testUser2().getEntityReference();
    fetched.setReviewers(List.of(reviewer1, reviewer2));

    Glossary updated = patchEntity(fetched.getId().toString(), fetched);

    Glossary verify = client.glossaries().get(updated.getId().toString(), "reviewers");
    assertNotNull(verify.getReviewers());
    assertEquals(2, verify.getReviewers().size());
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().glossaries().getVersionList(id);
  }

  @Override
  protected Glossary getVersion(UUID id, Double version) {
    return SdkClients.adminClient().glossaries().getVersion(id.toString(), version);
  }
}

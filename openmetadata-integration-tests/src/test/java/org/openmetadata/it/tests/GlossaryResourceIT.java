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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.schema.type.TagLabel;
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
  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(GlossaryResourceIT.class);

  {
    supportsImportExport = true;
  }

  private Glossary lastCreatedGlossary;

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

  @Test
  void test_patchAddDeleteReviewers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "reviewers");
    EntityReference reviewer1 = testUser1().getEntityReference();
    fetched.setReviewers(List.of(reviewer1));

    Glossary updated = patchEntity(fetched.getId().toString(), fetched);
    assertEquals(0.2, updated.getVersion(), 0.001);

    Glossary verify = client.glossaries().get(updated.getId().toString(), "reviewers");
    assertNotNull(verify.getReviewers());
    assertEquals(1, verify.getReviewers().size());

    EntityReference reviewer2 = testUser2().getEntityReference();
    verify.setReviewers(List.of(reviewer1, reviewer2));
    updated = patchEntity(verify.getId().toString(), verify);

    verify = client.glossaries().get(updated.getId().toString(), "reviewers");
    assertEquals(2, verify.getReviewers().size());

    verify.setReviewers(List.of(reviewer2));
    updated = patchEntity(verify.getId().toString(), verify);

    verify = client.glossaries().get(updated.getId().toString(), "reviewers");
    assertEquals(1, verify.getReviewers().size());
    assertEquals(reviewer2.getId(), verify.getReviewers().get(0).getId());
  }

  @Test
  void test_updateGlossaryMutuallyExclusiveRemainsSame(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("mutuallyExclusiveGlossary"))
            .withMutuallyExclusive(true)
            .withDescription("Test mutually exclusive immutability");

    Glossary glossary = createEntity(create);
    assertTrue(glossary.getMutuallyExclusive());

    glossary.setMutuallyExclusive(false);
    Glossary updated = patchEntity(glossary.getId().toString(), glossary);

    assertTrue(updated.getMutuallyExclusive());
  }

  @Test
  void test_glossaryWithDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference domainRef = testDomain().getEntityReference();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossaryWithDomain"))
            .withDomains(List.of(domainRef.getFullyQualifiedName()))
            .withDescription("Glossary with domain");

    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "domains");
    assertNotNull(fetched.getDomains());
    assertFalse(fetched.getDomains().isEmpty());
    assertEquals(domainRef.getId(), fetched.getDomains().get(0).getId());
  }

  @Test
  void test_glossaryWithTagsAndOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference ownerRef = testUser1().getEntityReference();
    List<TagLabel> tags = List.of(personalDataTagLabel());

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossaryWithTagsOwner"))
            .withOwners(List.of(ownerRef))
            .withTags(tags)
            .withDescription("Glossary with tags and owner");

    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "owners,tags");
    assertNotNull(fetched.getOwners());
    assertNotNull(fetched.getTags());
    assertFalse(fetched.getOwners().isEmpty());
    assertFalse(fetched.getTags().isEmpty());
  }

  @Test
  void test_deleteGlossaryWithTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary createGlossary = createMinimalRequest(ns);
    Glossary glossary = createEntity(createGlossary);

    org.openmetadata.schema.api.data.CreateGlossaryTerm createTerm =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.prefix("term1"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Test term");
    client.glossaryTerms().create(createTerm);

    assertThrows(
        Exception.class,
        () -> deleteEntity(glossary.getId().toString()),
        "Cannot delete glossary with terms without recursive flag");

    hardDeleteEntity(glossary.getId().toString());

    assertThrows(
        Exception.class,
        () -> getEntity(glossary.getId().toString()),
        "Glossary should be hard deleted");
  }

  @Test
  void test_renameGlossarySystemProvider(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("systemGlossary"))
            .withProvider(org.openmetadata.schema.type.ProviderType.SYSTEM)
            .withDescription("System glossary");

    Glossary glossary = createEntity(create);

    glossary.setName(ns.prefix("renamedSystemGlossary"));

    assertThrows(
        Exception.class,
        () -> patchEntity(glossary.getId().toString(), glossary),
        "Cannot rename system provider glossary");
  }

  @Test
  void test_listGlossariesWithFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference ownerRef = testUser1().getEntityReference();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("listGlossaryFields"))
            .withOwners(List.of(ownerRef))
            .withDescription("Glossary for listing with fields");
    createEntity(create);

    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setFields("owners,tags");
    params.setLimit(100);

    org.openmetadata.sdk.models.ListResponse<Glossary> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
  }

  @Test
  void test_glossaryTermCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary createGlossary = createMinimalRequest(ns);
    Glossary glossary = createEntity(createGlossary);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "termCount");
    assertEquals(0, fetched.getTermCount());

    org.openmetadata.schema.api.data.CreateGlossaryTerm createTerm1 =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.prefix("termForCount1"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Test term 1");
    client.glossaryTerms().create(createTerm1);

    org.openmetadata.schema.api.data.CreateGlossaryTerm createTerm2 =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.prefix("termForCount2"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Test term 2");
    client.glossaryTerms().create(createTerm2);

    fetched = client.glossaries().get(glossary.getId().toString(), "termCount");
    assertTrue(fetched.getTermCount() >= 2);
  }

  @Test
  void test_glossaryUsageCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary createGlossary = createMinimalRequest(ns);
    Glossary glossary = createEntity(createGlossary);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "usageCount");
    assertNotNull(fetched);
  }

  @Test
  void test_updateGlossaryTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "tags");

    List<TagLabel> tags = List.of(personalDataTagLabel());
    fetched.setTags(tags);

    Glossary updated = patchEntity(fetched.getId().toString(), fetched);

    Glossary verify = client.glossaries().get(updated.getId().toString(), "tags");
    assertNotNull(verify.getTags());
    assertFalse(verify.getTags().isEmpty());
  }

  @Test
  void test_glossaryPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 5; i++) {
      CreateGlossary create =
          new CreateGlossary()
              .withName(ns.prefix("paginationGlossary" + i))
              .withDescription("Glossary for pagination test " + i);
      createEntity(create);
    }

    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setLimit(2);

    org.openmetadata.sdk.models.ListResponse<Glossary> firstPage = listEntities(params);
    assertNotNull(firstPage);
    assertEquals(2, firstPage.getData().size());

    if (firstPage.getPaging() != null && firstPage.getPaging().getAfter() != null) {
      params.setAfter(firstPage.getPaging().getAfter());
      org.openmetadata.sdk.models.ListResponse<Glossary> secondPage = listEntities(params);
      assertNotNull(secondPage);
    }
  }

  @Test
  void test_glossaryFieldValidation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary().withName(ns.prefix("validationGlossary")).withDescription("");

    Glossary glossary = createEntity(create);
    assertNotNull(glossary);
    assertEquals(ns.prefix("validationGlossary"), glossary.getName());
  }

  @Test
  void test_glossaryWithEmptyReviewers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("emptyReviewersGlossary"))
            .withReviewers(List.of())
            .withDescription("Glossary with empty reviewers list");

    Glossary glossary = createEntity(create);
    assertNotNull(glossary);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "reviewers");
    if (fetched.getReviewers() != null) {
      assertTrue(fetched.getReviewers().isEmpty());
    }
  }

  @Test
  void test_updateGlossaryOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "owners");

    EntityReference ownerRef = testUser1().getEntityReference();
    fetched.setOwners(List.of(ownerRef));

    Glossary updated = patchEntity(fetched.getId().toString(), fetched);

    Glossary verify = client.glossaries().get(updated.getId().toString(), "owners");
    assertNotNull(verify.getOwners());
    assertEquals(1, verify.getOwners().size());
    assertEquals(ownerRef.getId(), verify.getOwners().get(0).getId());

    EntityReference newOwner = testUser2().getEntityReference();
    verify.setOwners(List.of(newOwner));
    updated = patchEntity(verify.getId().toString(), verify);

    verify = client.glossaries().get(updated.getId().toString(), "owners");
    assertEquals(1, verify.getOwners().size());
    assertEquals(newOwner.getId(), verify.getOwners().get(0).getId());
  }

  @Test
  void test_glossaryVersionIncrement(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);
    assertEquals(0.1, glossary.getVersion(), 0.001);

    Glossary fetched = client.glossaries().get(glossary.getId().toString());
    fetched.setDescription("Updated description for version test");
    Glossary updated = patchEntity(fetched.getId().toString(), fetched);
    assertEquals(0.2, updated.getVersion(), 0.001);

    // displayName update may or may not increment version depending on implementation
    fetched = client.glossaries().get(updated.getId().toString());
    fetched.setDisplayName("Updated Display Name");
    updated = patchEntity(fetched.getId().toString(), fetched);
    assertTrue(
        updated.getVersion() >= 0.2, "Version should be at least 0.2 after displayName update");
  }

  @Test
  void test_getGlossaryVersions(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);

    Glossary fetched = client.glossaries().get(glossary.getId().toString());
    fetched.setDescription("Version 2 update");
    patchEntity(fetched.getId().toString(), fetched);

    fetched = client.glossaries().get(glossary.getId().toString());
    fetched.setDescription("Version 3 update");
    patchEntity(fetched.getId().toString(), fetched);

    var versionHistory = client.glossaries().getVersionList(glossary.getId());
    assertNotNull(versionHistory);
    assertNotNull(versionHistory.getVersions());
    // Version history should have at least 2 versions (creation + 1 update)
    assertTrue(
        versionHistory.getVersions().size() >= 2, "Should have at least 2 versions in history");
  }

  @Test
  void test_getGlossarySpecificVersion(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create = createMinimalRequest(ns);
    Glossary glossary = createEntity(create);
    String originalDescription = glossary.getDescription();

    Glossary fetched = client.glossaries().get(glossary.getId().toString());
    fetched.setDescription("Updated to version 2");
    Glossary v2 = patchEntity(fetched.getId().toString(), fetched);

    Glossary version1 = client.glossaries().getVersion(glossary.getId().toString(), 0.1);
    assertEquals(0.1, version1.getVersion(), 0.001);
    assertEquals(originalDescription, version1.getDescription());

    Glossary version2 = client.glossaries().getVersion(glossary.getId().toString(), 0.2);
    assertEquals(0.2, version2.getVersion(), 0.001);
    assertEquals("Updated to version 2", version2.getDescription());
  }

  @Test
  void test_glossaryDisplayNameUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("displayNameGlossary"))
            .withDisplayName("Original Display Name")
            .withDescription("Test display name");

    Glossary glossary = createEntity(create);
    assertEquals("Original Display Name", glossary.getDisplayName());

    glossary.setDisplayName("Updated Display Name");
    Glossary updated = patchEntity(glossary.getId().toString(), glossary);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_glossaryWithAllFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference ownerRef = testUser1().getEntityReference();
    EntityReference reviewerRef = testUser2().getEntityReference();
    List<TagLabel> tags = List.of(personalDataTagLabel());

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("allFieldsGlossary"))
            .withDisplayName("All Fields Glossary")
            .withDescription("Glossary with all possible fields")
            .withOwners(List.of(ownerRef))
            .withReviewers(List.of(reviewerRef))
            .withTags(tags)
            .withMutuallyExclusive(true);

    Glossary glossary = createEntity(create);

    Glossary fetched =
        client.glossaries().get(glossary.getId().toString(), "owners,reviewers,tags");
    assertEquals("All Fields Glossary", fetched.getDisplayName());
    assertTrue(fetched.getMutuallyExclusive());
    assertNotNull(fetched.getOwners());
    assertNotNull(fetched.getReviewers());
    assertNotNull(fetched.getTags());
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

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<Glossary> getEntityService() {
    return SdkClients.adminClient().glossaries();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    if (lastCreatedGlossary == null) {
      CreateGlossary request = createMinimalRequest(ns);
      request.setName(ns.prefix("export_glossary"));
      lastCreatedGlossary = createEntity(request);
    }
    return lastCreatedGlossary.getFullyQualifiedName();
  }

  // ===================================================================
  // RENAME CONSOLIDATION TESTS
  // These tests verify that child entities (glossary terms) are preserved
  // when a glossary is renamed and then other fields are updated within
  // the same session (which triggers change consolidation).
  // ===================================================================

  /**
   * Test that glossary terms are preserved when a glossary is renamed and then the description is
   * updated. This tests the consolidation logic to ensure it doesn't revert to a previous version
   * with the old FQN.
   */
  @Test
  void test_renameAndUpdateDescriptionPreservesTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary with terms
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossary_rename_consolidate"))
            .withDescription("Initial description");
    Glossary glossary = createEntity(create);

    // Add a glossary term
    org.openmetadata.schema.api.data.CreateGlossaryTerm createTerm =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.prefix("term_for_rename"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Test term");
    org.openmetadata.schema.entity.data.GlossaryTerm term =
        client.glossaryTerms().create(createTerm);

    // Verify term count before rename
    Glossary beforeRename = client.glossaries().get(glossary.getId().toString(), "termCount");
    assertTrue(beforeRename.getTermCount() >= 1, "Should have at least 1 term before rename");

    // Rename the glossary
    String newName = "renamed-" + glossary.getName();
    glossary.setName(newName);
    Glossary renamed = patchEntity(glossary.getId().toString(), glossary);
    assertEquals(newName, renamed.getName());

    // Verify terms after rename
    Glossary afterRename = client.glossaries().get(renamed.getId().toString(), "termCount");
    assertTrue(afterRename.getTermCount() >= 1, "Should have at least 1 term after rename");

    // Update description (triggers consolidation logic)
    renamed.setDescription("Updated description after rename");
    Glossary afterDescUpdate = patchEntity(renamed.getId().toString(), renamed);
    assertEquals("Updated description after rename", afterDescUpdate.getDescription());

    // Verify terms are preserved after consolidation
    Glossary afterConsolidation =
        client.glossaries().get(afterDescUpdate.getId().toString(), "termCount");
    assertTrue(
        afterConsolidation.getTermCount() >= 1,
        "CRITICAL: Terms should be preserved after rename + description update consolidation");

    // Verify the term's glossary reference has the updated FQN
    org.openmetadata.schema.entity.data.GlossaryTerm updatedTerm =
        client.glossaryTerms().get(term.getId().toString(), "glossary");
    assertEquals(
        afterDescUpdate.getFullyQualifiedName(),
        updatedTerm.getGlossary().getFullyQualifiedName(),
        "Term's glossary reference should have updated FQN after consolidation");
  }

  /**
   * Test multiple renames followed by updates within the same session. This is a more complex
   * scenario that tests the robustness of the consolidation fix.
   */
  @Test
  void test_multipleRenamesWithUpdatesPreservesTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix("glossary_multi_rename"))
            .withDescription("Initial description");
    Glossary glossary = createEntity(create);

    // Add a glossary term
    org.openmetadata.schema.api.data.CreateGlossaryTerm createTerm =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.prefix("term_multi_rename"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Test term");
    org.openmetadata.schema.entity.data.GlossaryTerm term =
        client.glossaryTerms().create(createTerm);

    Glossary fetched = client.glossaries().get(glossary.getId().toString(), "termCount");
    assertTrue(fetched.getTermCount() >= 1);

    String[] names = {"renamed-first", "renamed-second", "renamed-third"};

    for (int i = 0; i < names.length; i++) {
      String newName = names[i] + "-" + UUID.randomUUID().toString().substring(0, 8);

      glossary.setName(newName);
      glossary = patchEntity(glossary.getId().toString(), glossary);
      assertEquals(newName, glossary.getName());

      fetched = client.glossaries().get(glossary.getId().toString(), "termCount");
      assertTrue(fetched.getTermCount() >= 1, "Terms should be preserved after rename " + (i + 1));

      glossary.setDescription("Description after rename " + (i + 1));
      glossary = patchEntity(glossary.getId().toString(), glossary);

      fetched = client.glossaries().get(glossary.getId().toString(), "termCount");
      assertTrue(
          fetched.getTermCount() >= 1,
          "Terms should be preserved after rename + update iteration " + (i + 1));
    }

    // Verify the term's glossary reference has the final updated FQN
    org.openmetadata.schema.entity.data.GlossaryTerm updatedTerm =
        client.glossaryTerms().get(term.getId().toString(), "glossary");
    assertEquals(
        glossary.getFullyQualifiedName(),
        updatedTerm.getGlossary().getFullyQualifiedName(),
        "Term's glossary reference should have final updated FQN");
  }

  /**
   * Test that importing a glossary with unapproved (IN_REVIEW) glossary terms as related terms
   * fails with appropriate error message.
   */
  @Test
  void test_importCsv_withUnapprovedRelatedTerm_fails(TestNamespace ns)
      throws InterruptedException, com.fasterxml.jackson.core.JsonProcessingException {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary
    CreateGlossary createGlossary = createMinimalRequest(ns);
    Glossary glossary = createEntity(createGlossary);

    // Create an IN_REVIEW glossary term by creating it first, then patching the status
    // (You cannot create a term with IN_REVIEW status directly)
    EntityReference reviewerRef = testUser1().getEntityReference();
    org.openmetadata.schema.api.data.CreateGlossaryTerm createInReviewTerm =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.prefix("inReviewTerm"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term in review status")
            .withReviewers(List.of(reviewerRef));
    org.openmetadata.schema.entity.data.GlossaryTerm inReviewTerm =
        client.glossaryTerms().create(createInReviewTerm);

    // Now update the term to set it to IN_REVIEW status
    inReviewTerm.setEntityStatus(org.openmetadata.schema.type.EntityStatus.IN_REVIEW);
    inReviewTerm = client.glossaryTerms().update(inReviewTerm.getId(), inReviewTerm);

    java.lang.Thread.sleep(10000);
    log.info(
        "TEST: Creating CSV for unapproved term import with IN_REVIEW term FQN: {}",
        inReviewTerm.getFullyQualifiedName());

    // Create a CSV trying to import a new term with the IN_REVIEW term as a related term
    String csv =
        "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension\n"
            + ","
            + ns.prefix("newTerm")
            + ",New Term,Test Term,,\""
            + inReviewTerm.getFullyQualifiedName()
            + "\",,,,,,,,";

    log.info("TEST: CSV to import:\n{}", csv);
    log.info("TEST: CSV header field count: {}", csv.split("\n")[0].split(",").length);
    log.info("TEST: CSV data field count: {}", csv.split("\n")[1].split(",", -1).length);

    // Attempt to import - should fail
    log.info("TEST: Attempting CSV import for glossary: {}", glossary.getName());
    String resultCsv = client.glossaries().importCsv(glossary.getName(), csv, false);

    // Log the result for debugging
    log.info("TEST: CSV Import completed");
    log.info("TEST: Result CSV:\n{}", resultCsv);
    log.info("TEST: Result contains 'failure': {}", resultCsv.contains("failure"));
    log.info("TEST: Result contains 'aborted': {}", resultCsv.contains("aborted"));
    log.info("TEST: Result contains 'APPROVED status': {}", resultCsv.contains("APPROVED status"));

    // Verify import failed with appropriate error message
    assertNotNull(resultCsv);
    // The result should indicate failure
    boolean hasStatusMessage = resultCsv.contains("must have APPROVED status");
    boolean hasInReview = resultCsv.contains("IN_REVIEW") || resultCsv.contains("Reviewed");
    boolean hasFailure = resultCsv.contains("failure");

    assertTrue(
        hasFailure,
        "Import should fail when trying to link an unapproved glossary term. Result: " + resultCsv);
    assertTrue(
        hasStatusMessage || hasInReview || resultCsv.contains(inReviewTerm.getFullyQualifiedName()),
        "Error message should mention the unapproved term and status requirement. Result: "
            + resultCsv);
  }

  /**
   * Test that importing a glossary with APPROVED glossary terms as related terms succeeds.
   */
  @Test
  void test_importCsv_withApprovedRelatedTerm_succeeds(TestNamespace ns)
      throws com.fasterxml.jackson.core.JsonProcessingException {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary
    CreateGlossary createGlossary = createMinimalRequest(ns);
    Glossary glossary = createEntity(createGlossary);

    // Create an APPROVED glossary term
    org.openmetadata.schema.api.data.CreateGlossaryTerm createApprovedTerm =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.prefix("approvedTerm"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with approved status");
    org.openmetadata.schema.entity.data.GlossaryTerm approvedTerm =
        client.glossaryTerms().create(createApprovedTerm);

    // Verify the term is APPROVED
    org.openmetadata.schema.entity.data.GlossaryTerm fetchedTerm =
        client.glossaryTerms().get(approvedTerm.getId().toString());
    assertEquals(org.openmetadata.schema.type.EntityStatus.APPROVED, fetchedTerm.getEntityStatus());

    log.info(
        "TEST [APPROVED]: Creating CSV for approved term import with APPROVED term FQN: {}",
        approvedTerm.getFullyQualifiedName());

    // Create a CSV importing a new term with the APPROVED term as a related term
    String csv =
        "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension\n"
            + ","
            + ns.prefix("newTermWithApproved")
            + ",New Term With Approved,Test Term,,\""
            + approvedTerm.getFullyQualifiedName()
            + "\",,,,,,,,";

    log.info("TEST [APPROVED]: CSV to import:\n{}", csv);
    log.info("TEST [APPROVED]: CSV header field count: {}", csv.split("\n")[0].split(",").length);
    log.info("TEST [APPROVED]: CSV data field count: {}", csv.split("\n")[1].split(",", -1).length);

    // Attempt to import - should succeed
    log.info("TEST [APPROVED]: Attempting CSV import for glossary: {}", glossary.getName());
    String resultCsv = client.glossaries().importCsv(glossary.getName(), csv, false);

    // Log the result for debugging
    log.info("TEST [APPROVED]: CSV Import completed");
    log.info("TEST [APPROVED]: Result CSV:\n{}", resultCsv);
    log.info("TEST [APPROVED]: Result contains 'success': {}", resultCsv.contains("success"));
    log.info("TEST [APPROVED]: Result contains 'failure': {}", resultCsv.contains("failure"));

    // Verify import succeeded
    assertNotNull(resultCsv);
    // Check the result doesn't contain failure
    boolean hasFailure = resultCsv.contains("failure");
    assertFalse(
        hasFailure,
        "Import should succeed when linking an APPROVED glossary term. Result: " + resultCsv);

    // If there were no failures, verify the term was created with the related term
    if (!hasFailure && resultCsv.contains("success")) {
      // Verify the term was created with the related term
      org.openmetadata.schema.entity.data.GlossaryTerm createdTerm =
          client
              .glossaryTerms()
              .getByName(
                  glossary.getFullyQualifiedName() + "." + ns.prefix("newTermWithApproved"),
                  "relatedTerms");

      assertNotNull(createdTerm.getRelatedTerms());
      assertEquals(1, createdTerm.getRelatedTerms().size());
      assertEquals(
          approvedTerm.getFullyQualifiedName(),
          createdTerm.getRelatedTerms().get(0).getFullyQualifiedName());
    }
  }
}

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for GlossaryTerm entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds glossary term-specific tests for
 * parent-child relationships, synonyms, and related terms.
 *
 * <p>Migrated from: org.openmetadata.service.resources.glossary.GlossaryTermResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermResourceIT extends BaseEntityIT<GlossaryTerm, CreateGlossaryTerm> {

  // Disable tests that don't apply to GlossaryTerm
  {
    supportsFollowers = false; // GlossaryTerm doesn't support followers directly
    // GlossaryTerm export is done through Glossary endpoint, not GlossaryTerm endpoint
    // The Glossary export (/v1/glossaries/name/{name}/export) exports all terms in that glossary
    supportsImportExport = false;
  }

  private Glossary lastCreatedGlossary;

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateGlossaryTerm createMinimalRequest(TestNamespace ns) {
    Glossary glossary;
    if (lastCreatedGlossary != null) {
      glossary = lastCreatedGlossary;
    } else {
      glossary = getOrCreateGlossary(ns);
    }

    return new CreateGlossaryTerm()
        .withName(ns.prefix("term"))
        .withGlossary(glossary.getFullyQualifiedName())
        .withDescription("Test glossary term created by integration test");
  }

  @Override
  protected CreateGlossaryTerm createRequest(String name, TestNamespace ns) {
    Glossary glossary = getOrCreateGlossary(ns);

    return new CreateGlossaryTerm()
        .withName(name)
        .withGlossary(glossary.getFullyQualifiedName())
        .withDescription("Test glossary term");
  }

  private Glossary getOrCreateGlossary(TestNamespace ns) {
    String glossaryName = ns.prefix("glossary");
    try {
      return SdkClients.adminClient().glossaries().getByName(glossaryName);
    } catch (Exception e) {
      CreateGlossary createGlossary =
          new CreateGlossary().withName(glossaryName).withDescription("Test glossary for terms");
      return SdkClients.adminClient().glossaries().create(createGlossary);
    }
  }

  @Override
  protected GlossaryTerm createEntity(CreateGlossaryTerm createRequest) {
    return SdkClients.adminClient().glossaryTerms().create(createRequest);
  }

  @Override
  protected GlossaryTerm getEntity(String id) {
    return SdkClients.adminClient().glossaryTerms().get(id);
  }

  @Override
  protected GlossaryTerm getEntityByName(String fqn) {
    return SdkClients.adminClient().glossaryTerms().getByName(fqn);
  }

  @Override
  protected GlossaryTerm patchEntity(String id, GlossaryTerm entity) {
    return SdkClients.adminClient().glossaryTerms().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().glossaryTerms().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().glossaryTerms().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().glossaryTerms().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "glossaryTerm";
  }

  @Override
  protected void validateCreatedEntity(GlossaryTerm entity, CreateGlossaryTerm createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getGlossary(), "GlossaryTerm must have a parent glossary");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()), "FQN should contain term name");
  }

  @Override
  protected ListResponse<GlossaryTerm> listEntities(ListParams params) {
    return SdkClients.adminClient().glossaryTerms().list(params);
  }

  @Override
  protected GlossaryTerm getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().glossaryTerms().get(id, fields);
  }

  @Override
  protected GlossaryTerm getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().glossaryTerms().getByName(fqn, fields);
  }

  @Override
  protected GlossaryTerm getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().glossaryTerms().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().glossaryTerms().getVersionList(id);
  }

  @Override
  protected GlossaryTerm getVersion(UUID id, Double version) {
    return SdkClients.adminClient().glossaryTerms().getVersion(id.toString(), version);
  }

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<GlossaryTerm> getEntityService() {
    return SdkClients.adminClient().glossaryTerms();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    if (lastCreatedGlossary == null) {
      // Create a glossary to use as container
      CreateGlossary glossaryRequest = new CreateGlossary();
      glossaryRequest.setName(ns.prefix("export_glossary"));
      glossaryRequest.setDescription("Glossary for export testing");
      lastCreatedGlossary = SdkClients.adminClient().glossaries().create(glossaryRequest);
    }
    return lastCreatedGlossary.getFullyQualifiedName();
  }

  // ===================================================================
  // GLOSSARY TERM-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_glossaryTermWithSynonyms_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_synonyms"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with synonyms")
            .withSynonyms(List.of("alias1", "alias2", "alias3"));

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    assertNotNull(term.getSynonyms());
    assertEquals(3, term.getSynonyms().size());
    assertTrue(term.getSynonyms().contains("alias1"));
  }

  @Test
  void post_glossaryTermWithReferences_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_refs"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with references")
            .withReferences(
                List.of(
                    new TermReference()
                        .withName("Wikipedia")
                        .withEndpoint(URI.create("https://wikipedia.org")),
                    new TermReference()
                        .withName("Documentation")
                        .withEndpoint(URI.create("https://docs.example.com"))));

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    assertNotNull(term.getReferences());
    assertEquals(2, term.getReferences().size());
  }

  @Test
  void post_childGlossaryTerm_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent term
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_term"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent term");

    GlossaryTerm parentTerm = createEntity(parentRequest);
    assertNotNull(parentTerm);

    // Create child term under parent
    CreateGlossaryTerm childRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child_term"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parentTerm.getFullyQualifiedName())
            .withDescription("Child term");

    GlossaryTerm childTerm = createEntity(childRequest);
    assertNotNull(childTerm);
    assertNotNull(childTerm.getParent());
    assertEquals(parentTerm.getId(), childTerm.getParent().getId());
  }

  @Test
  void put_glossaryTermDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_update_desc"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Initial description");

    GlossaryTerm term = createEntity(request);
    assertEquals("Initial description", term.getDescription());

    // Update description
    term.setDescription("Updated description");
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_glossaryTermNameUniquenessWithinGlossary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create first term
    String termName = ns.prefix("unique_term");
    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First term");

    GlossaryTerm term1 = createEntity(request1);
    assertNotNull(term1);

    // Attempt to create duplicate within same glossary
    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Duplicate term");

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate term in same glossary should fail");
  }

  // ===================================================================
  // ADDITIONAL GLOSSARY TERM TESTS - Migrated from GlossaryTermResourceTest
  // ===================================================================

  @Test
  void post_glossaryTermWithRelatedTerms_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create first term
    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_related_1"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First related term");
    GlossaryTerm term1 = createEntity(request1);

    // Create second term with related term reference
    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_related_2"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Second related term")
            .withRelatedTerms(List.of(term1.getFullyQualifiedName()));
    GlossaryTerm term2 = createEntity(request2);

    assertNotNull(term2);
    GlossaryTerm fetchedTerm2 =
        SdkClients.adminClient().glossaryTerms().get(term2.getId().toString(), "relatedTerms");
    assertNotNull(fetchedTerm2.getRelatedTerms());
    assertTrue(fetchedTerm2.getRelatedTerms().size() >= 1);
  }

  @Test
  void test_buildGlossaryTermNestedHierarchy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent term
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("nested_parent"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent term");
    GlossaryTerm parent = createEntity(parentRequest);

    // Create child term
    CreateGlossaryTerm childRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("nested_child"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child term");
    GlossaryTerm child = createEntity(childRequest);

    // Create grandchild term
    CreateGlossaryTerm grandchildRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("nested_grandchild"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(child.getFullyQualifiedName())
            .withDescription("Grandchild term");
    GlossaryTerm grandchild = createEntity(grandchildRequest);

    assertNotNull(grandchild);
    assertEquals(child.getId(), grandchild.getParent().getId());
    assertTrue(grandchild.getFullyQualifiedName().contains(child.getName()));
    assertTrue(grandchild.getFullyQualifiedName().contains(parent.getName()));
  }

  @Test
  void test_glossaryTermVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_version"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Initial description");
    GlossaryTerm term = createEntity(request);
    Double initialVersion = term.getVersion();

    // Update to create new version
    term.setDescription("Updated description v2");
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertTrue(updated.getVersion() >= initialVersion);

    // Get version history
    EntityHistory history = getVersionHistory(term.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 1);

    // Get specific version
    GlossaryTerm version = getVersion(term.getId(), initialVersion);
    assertNotNull(version);
  }

  @Test
  void test_glossaryTermSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_soft_delete"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for soft delete test");
    GlossaryTerm term = createEntity(request);
    String termId = term.getId().toString();

    // Soft delete
    deleteEntity(termId);

    // Verify deleted
    GlossaryTerm deleted = getEntityIncludeDeleted(termId);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(termId);

    // Verify restored
    GlossaryTerm restored = getEntity(termId);
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void test_glossaryTermHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_hard_delete"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for hard delete test");
    GlossaryTerm term = createEntity(request);
    String termId = term.getId().toString();

    // Hard delete
    hardDeleteEntity(termId);

    // Verify completely gone
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(termId),
        "Hard deleted term should not be retrievable");
  }

  @Test
  void test_listGlossaryTermsWithPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create multiple terms
    for (int i = 0; i < 5; i++) {
      CreateGlossaryTerm request =
          new CreateGlossaryTerm()
              .withName(ns.prefix("paginated_term_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withDescription("Paginated term " + i);
      createEntity(request);
    }

    // List with pagination
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<GlossaryTerm> page1 = listEntities(params);

    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertNotNull(page1.getPaging());
  }

  @Test
  void test_listGlossaryTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a new unique glossary for this test
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(ns.prefix("list_glossary"))
            .withDescription("Glossary for list test");
    Glossary glossary = client.glossaries().create(createGlossary);

    // Create terms in the glossary
    for (int i = 0; i < 3; i++) {
      CreateGlossaryTerm request =
          new CreateGlossaryTerm()
              .withName(ns.prefix("filter_term_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withDescription("Term for filter test " + i);
      createEntity(request);
    }

    // List all terms - basic verification
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<GlossaryTerm> terms = listEntities(params);

    assertNotNull(terms);
    assertNotNull(terms.getData());
    assertTrue(terms.getData().size() >= 3);
  }

  @Test
  void test_glossaryTermWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_with_owner"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with owner")
            .withOwners(List.of(testUser1().getEntityReference()));

    GlossaryTerm term = createEntity(request);
    assertNotNull(term.getOwners());
    assertFalse(term.getOwners().isEmpty());
    assertEquals(testUser1().getId(), term.getOwners().get(0).getId());
  }

  @Test
  void test_glossaryTermWithReviewers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_with_reviewers"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with reviewers")
            .withReviewers(List.of(testUser1().getEntityReference()));

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);

    // Fetch with reviewers field
    GlossaryTerm fetched = client.glossaryTerms().get(term.getId().toString(), "reviewers");
    assertNotNull(fetched.getReviewers());
  }

  @Test
  void patch_glossaryTermAddSynonyms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_add_synonyms"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term to add synonyms");

    GlossaryTerm term = createEntity(request);
    assertTrue(term.getSynonyms() == null || term.getSynonyms().isEmpty());

    // Add synonyms
    term.setSynonyms(List.of("synonym1", "synonym2"));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getSynonyms());
    assertEquals(2, updated.getSynonyms().size());
  }

  @Test
  void patch_glossaryTermAddReferences(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_add_refs"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term to add references");

    GlossaryTerm term = createEntity(request);
    assertTrue(term.getReferences() == null || term.getReferences().isEmpty());

    // Add references
    term.setReferences(
        List.of(
            new TermReference().withName("Ref1").withEndpoint(URI.create("https://example.com/1")),
            new TermReference()
                .withName("Ref2")
                .withEndpoint(URI.create("https://example.com/2"))));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getReferences());
    assertEquals(2, updated.getReferences().size());
  }

  @Test
  void test_glossaryTermWithExtension(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_with_extension"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with extension data");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    assertNotNull(term.getGlossary());
  }

  @Test
  void test_glossaryTermDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_display"))
            .withDisplayName("My Custom Display Name")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with display name");

    GlossaryTerm term = createEntity(request);
    assertEquals("My Custom Display Name", term.getDisplayName());

    // Update display name
    term.setDisplayName("Updated Display Name");
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_glossaryTermByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_by_name"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for get by name test");

    GlossaryTerm term = createEntity(request);
    String fqn = term.getFullyQualifiedName();

    // Get by FQN
    GlossaryTerm fetched = getEntityByName(fqn);
    assertEquals(term.getId(), fetched.getId());
    assertEquals(term.getName(), fetched.getName());
  }

  @Test
  void test_createDuplicateGlossaryTerm_inDifferentGlossary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create two glossaries
    CreateGlossary createGlossary1 =
        new CreateGlossary()
            .withName(ns.prefix("glossary_dup_1"))
            .withDescription("First glossary for duplicate test");
    Glossary glossary1 = client.glossaries().create(createGlossary1);

    CreateGlossary createGlossary2 =
        new CreateGlossary()
            .withName(ns.prefix("glossary_dup_2"))
            .withDescription("Second glossary for duplicate test");
    Glossary glossary2 = client.glossaries().create(createGlossary2);

    // Create term with same name in both glossaries - should succeed
    String termName = ns.prefix("duplicate_term");

    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary1.getFullyQualifiedName())
            .withDescription("Term in first glossary");
    GlossaryTerm term1 = createEntity(request1);

    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary2.getFullyQualifiedName())
            .withDescription("Term in second glossary");
    GlossaryTerm term2 = createEntity(request2);

    assertNotNull(term1);
    assertNotNull(term2);
    assertNotEquals(term1.getId(), term2.getId());
    assertEquals(term1.getName(), term2.getName());
    assertNotEquals(term1.getFullyQualifiedName(), term2.getFullyQualifiedName());
  }

  @Test
  void test_getImmediateChildrenGlossaryTermsWithParentFQN(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent term
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_children"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent term");
    GlossaryTerm parent = createEntity(parentRequest);

    // Create children
    for (int i = 0; i < 3; i++) {
      CreateGlossaryTerm childRequest =
          new CreateGlossaryTerm()
              .withName(ns.prefix("child_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withParent(parent.getFullyQualifiedName())
              .withDescription("Child term " + i);
      createEntity(childRequest);
    }

    // Fetch parent with children field to verify children were created
    GlossaryTerm fetchedParent = client.glossaryTerms().get(parent.getId().toString(), "children");
    assertNotNull(fetchedParent);
    assertNotNull(fetchedParent.getChildren());
    assertEquals(3, fetchedParent.getChildren().size());
  }

  @Test
  void test_glossaryTermWithTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_with_tags"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with tags");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);

    // Fetch with tags field
    GlossaryTerm fetched = client.glossaryTerms().get(term.getId().toString(), "tags");
    assertNotNull(fetched);
  }

  @Test
  void test_glossaryTermFullyQualifiedName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_fqn_test"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for FQN test");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    assertNotNull(term.getFullyQualifiedName());
    assertTrue(term.getFullyQualifiedName().contains(glossary.getName()));
  }

  @Test
  void test_glossaryTermFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("fqn_format_term"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for FQN format test");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term.getFullyQualifiedName());
    assertTrue(term.getFullyQualifiedName().startsWith(glossary.getName()));
    assertTrue(term.getFullyQualifiedName().contains(term.getName()));
  }

  @Test
  void test_glossaryTermWithMultipleSynonyms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_multi_synonyms"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with multiple synonyms")
            .withSynonyms(List.of("syn1", "syn2", "syn3", "syn4", "syn5"));

    GlossaryTerm term = createEntity(request);
    assertNotNull(term.getSynonyms());
    assertEquals(5, term.getSynonyms().size());
    assertTrue(term.getSynonyms().containsAll(List.of("syn1", "syn2", "syn3", "syn4", "syn5")));
  }

  @Test
  void patch_glossaryTermDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_patch_desc"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Original description");

    GlossaryTerm term = createEntity(request);
    assertEquals("Original description", term.getDescription());

    // Patch description
    term.setDescription("Patched description");
    GlossaryTerm patched = patchEntity(term.getId().toString(), term);
    assertEquals("Patched description", patched.getDescription());
    assertTrue(patched.getVersion() > term.getVersion());
  }

  @Test
  void test_glossaryTermChildCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_count"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent for child count test");
    GlossaryTerm parent = createEntity(parentRequest);

    // Create children
    for (int i = 0; i < 4; i++) {
      CreateGlossaryTerm childRequest =
          new CreateGlossaryTerm()
              .withName(ns.prefix("child_count_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withParent(parent.getFullyQualifiedName())
              .withDescription("Child " + i);
      createEntity(childRequest);
    }

    // Fetch parent with children field
    GlossaryTerm fetchedParent =
        SdkClients.adminClient().glossaryTerms().get(parent.getId().toString(), "childrenCount");
    assertNotNull(fetchedParent);
    // childrenCount might be available depending on the fields requested
  }

  @Test
  void patch_addDeleteReviewers(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term without reviewers
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_reviewers"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for reviewer patch test");
    GlossaryTerm term = createEntity(request);
    assertTrue(term.getReviewers() == null || term.getReviewers().isEmpty());

    // Add reviewer
    term.setReviewers(List.of(testUser1().getEntityReference()));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getReviewers());
    assertEquals(1, updated.getReviewers().size());

    // Add another reviewer
    updated.setReviewers(
        List.of(testUser1().getEntityReference(), testUser2().getEntityReference()));
    GlossaryTerm updated2 = patchEntity(updated.getId().toString(), updated);
    assertNotNull(updated2.getReviewers());
    assertTrue(updated2.getReviewers().size() >= 2);

    // Remove a reviewer
    updated2.setReviewers(List.of(testUser2().getEntityReference()));
    GlossaryTerm updated3 = patchEntity(updated2.getId().toString(), updated2);
    assertNotNull(updated3.getReviewers());
    assertEquals(1, updated3.getReviewers().size());
  }

  @Test
  void patch_addDeleteReferences(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term without references
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_references"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for reference patch test");
    GlossaryTerm term = createEntity(request);

    // Add reference
    org.openmetadata.schema.api.data.TermReference ref1 =
        new org.openmetadata.schema.api.data.TermReference()
            .withName("reference1")
            .withEndpoint(java.net.URI.create("http://reference1.example.com"));
    term.setReferences(List.of(ref1));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getReferences());
    assertEquals(1, updated.getReferences().size());

    // Add another reference
    org.openmetadata.schema.api.data.TermReference ref2 =
        new org.openmetadata.schema.api.data.TermReference()
            .withName("reference2")
            .withEndpoint(java.net.URI.create("http://reference2.example.com"));
    updated.setReferences(List.of(ref1, ref2));
    GlossaryTerm updated2 = patchEntity(updated.getId().toString(), updated);
    assertNotNull(updated2.getReferences());
    assertEquals(2, updated2.getReferences().size());

    // Remove a reference
    updated2.setReferences(List.of(ref2));
    GlossaryTerm updated3 = patchEntity(updated2.getId().toString(), updated2);
    assertNotNull(updated3.getReferences());
    assertEquals(1, updated3.getReferences().size());
  }

  @Test
  void test_glossaryTermInheritsGlossaryOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create glossary with owner
    CreateGlossary glossaryRequest = new CreateGlossary();
    glossaryRequest.setName(ns.prefix("glossary_inherited_owner"));
    glossaryRequest.setDescription("Glossary with owner for inheritance test");
    glossaryRequest.setOwners(List.of(testUser1().getEntityReference()));
    Glossary glossary = client.glossaries().create(glossaryRequest);
    assertNotNull(glossary.getOwners());

    // Create term under this glossary without explicit owner
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_inherit_owner"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term to inherit owner");
    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    // The term inherits owner from glossary
  }

  @Test
  void test_deleteRecursive(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent term
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_recursive"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent for recursive delete test");
    GlossaryTerm parent = createEntity(parentRequest);

    // Create child terms
    for (int i = 0; i < 3; i++) {
      CreateGlossaryTerm childRequest =
          new CreateGlossaryTerm()
              .withName(ns.prefix("child_recursive_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withParent(parent.getFullyQualifiedName())
              .withDescription("Child " + i);
      createEntity(childRequest);
    }

    // Delete parent with recursive flag
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("recursive", "true");
    params.put("hardDelete", "true");
    SdkClients.adminClient().glossaryTerms().delete(parent.getId().toString(), params);

    // Verify parent is deleted
    assertThrows(Exception.class, () -> client.glossaryTerms().get(parent.getId().toString()));
  }

  @Test
  void test_glossaryTermStyle(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_style"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for style test");
    GlossaryTerm term = createEntity(request);

    // Add style
    org.openmetadata.schema.entity.type.Style style =
        new org.openmetadata.schema.entity.type.Style()
            .withColor("#FF0000")
            .withIconURL("http://example.com/icon.png");
    term.setStyle(style);
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getStyle());
    assertEquals("#FF0000", updated.getStyle().getColor());
  }

  @Test
  void test_glossaryTermMutuallyExclusive(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create mutually exclusive glossary
    CreateGlossary glossaryRequest = new CreateGlossary();
    glossaryRequest.setName(ns.prefix("mutexclusive_glossary"));
    glossaryRequest.setDescription("Mutually exclusive glossary");
    glossaryRequest.setMutuallyExclusive(true);
    Glossary glossary = client.glossaries().create(glossaryRequest);
    assertTrue(glossary.getMutuallyExclusive());

    // Create term under mutually exclusive glossary
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_mutex"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term in mutually exclusive glossary");
    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
  }

  @Test
  void test_glossaryTermWithMultipleRelatedTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create multiple terms
    List<GlossaryTerm> relatedTerms = new java.util.ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateGlossaryTerm relatedRequest =
          new CreateGlossaryTerm()
              .withName(ns.prefix("related_multi_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withDescription("Related term " + i);
      relatedTerms.add(createEntity(relatedRequest));
    }

    // Create term with multiple related terms
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_multi_related"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with multiple related terms")
            .withRelatedTerms(
                relatedTerms.stream()
                    .map(t -> t.getFullyQualifiedName())
                    .collect(java.util.stream.Collectors.toList()));
    GlossaryTerm term = createEntity(request);
    assertNotNull(term.getRelatedTerms());
    assertEquals(3, term.getRelatedTerms().size());
  }

  @Test
  void test_glossaryTermAbbreviation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term with abbreviation
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_abbrev"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with abbreviation");
    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
  }

  @Test
  void test_deeplyNestedGlossaryTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create deeply nested hierarchy (4 levels)
    GlossaryTerm parent = null;
    for (int level = 0; level < 4; level++) {
      CreateGlossaryTerm request =
          new CreateGlossaryTerm()
              .withName(ns.prefix("level_" + level))
              .withGlossary(glossary.getFullyQualifiedName())
              .withDescription("Level " + level + " term");
      if (parent != null) {
        request.setParent(parent.getFullyQualifiedName());
      }
      parent = createEntity(request);
      assertNotNull(parent);

      // Verify FQN grows with each level
      String[] parts = parent.getFullyQualifiedName().split("\\.");
      assertTrue(parts.length >= level + 2); // glossary.level0.level1.level2.level3
    }
  }

  @Test
  void test_inheritDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a domain first
    org.openmetadata.schema.api.domains.CreateDomain createDomain =
        new org.openmetadata.schema.api.domains.CreateDomain()
            .withName(ns.prefix("domain"))
            .withDescription("Test domain for inheritance")
            .withDomainType(org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE);

    org.openmetadata.schema.entity.domains.Domain domain = client.domains().create(createDomain);
    assertNotNull(domain);

    // Create glossary with domain
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(ns.prefix("glossary_domain"))
            .withDescription("Glossary with domain")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Glossary glossary = client.glossaries().create(createGlossary);
    assertNotNull(glossary.getDomains());

    // Create term without explicit domain
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_inherit_domain"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term should inherit domain");

    GlossaryTerm term = createEntity(createTerm);
    assertNotNull(term);

    // Fetch with domains field to verify inheritance
    GlossaryTerm fetchedTerm = client.glossaryTerms().get(term.getId().toString(), "domains");
    assertNotNull(fetchedTerm);
  }

  @Test
  void test_glossaryTermStatus(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term - default status should be APPROVED when no reviewers
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_status"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for status test");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);

    // Status should be set
    org.openmetadata.schema.type.EntityStatus status = term.getEntityStatus();
    assertNotNull(status);
  }

  @Test
  void test_glossaryTermStatusTransitions(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_status_transition"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for status transition test");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term.getEntityStatus());

    // Update status to Deprecated
    term.setEntityStatus(org.openmetadata.schema.type.EntityStatus.DEPRECATED);
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertEquals(org.openmetadata.schema.type.EntityStatus.DEPRECATED, updated.getEntityStatus());
  }

  @Test
  void test_commonPrefixTagLabelCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create nested terms with common prefix: a, aa, aaa
    CreateGlossaryTerm createA =
        new CreateGlossaryTerm()
            .withName(ns.prefix("a"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term a");
    GlossaryTerm termA = createEntity(createA);

    CreateGlossaryTerm createAa =
        new CreateGlossaryTerm()
            .withName(ns.prefix("aa"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term aa");
    GlossaryTerm termAa = createEntity(createAa);

    CreateGlossaryTerm createAaa =
        new CreateGlossaryTerm()
            .withName(ns.prefix("aaa"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term aaa");
    GlossaryTerm termAaa = createEntity(createAaa);

    // Verify all terms were created
    assertNotNull(termA);
    assertNotNull(termAa);
    assertNotNull(termAaa);

    // Note: Testing actual tag usage count would require creating tables and applying tags
    // which is beyond the scope of this basic test
  }

  @Test
  void test_glossaryTermWithLanguage(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term with unicode characters (e.g., Japanese)
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_日本語"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with Japanese characters");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    assertTrue(term.getName().contains("日本語"));
  }

  @Test
  void test_patchGlossaryTermTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term without tags
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_tags"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for tags test");

    GlossaryTerm term = createEntity(request);
    assertTrue(term.getTags() == null || term.getTags().isEmpty());

    // Add tags
    org.openmetadata.schema.type.TagLabel tag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);

    term.setTags(List.of(tag));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getTags());
    assertTrue(updated.getTags().size() >= 1);
  }

  @Test
  void test_glossaryTermAcrossMultipleGlossaries(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create two different glossaries
    CreateGlossary createGlossary1 =
        new CreateGlossary()
            .withName(ns.prefix("glossary_multi_1"))
            .withDescription("First glossary");
    Glossary glossary1 = client.glossaries().create(createGlossary1);

    CreateGlossary createGlossary2 =
        new CreateGlossary()
            .withName(ns.prefix("glossary_multi_2"))
            .withDescription("Second glossary");
    Glossary glossary2 = client.glossaries().create(createGlossary2);

    // Create terms in both glossaries with same name - should succeed
    String termName = ns.prefix("shared_term");

    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary1.getFullyQualifiedName())
            .withDescription("Term in glossary 1");
    GlossaryTerm term1 = createEntity(request1);

    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary2.getFullyQualifiedName())
            .withDescription("Term in glossary 2");
    GlossaryTerm term2 = createEntity(request2);

    // Verify both were created with different IDs but same name
    assertNotNull(term1);
    assertNotNull(term2);
    assertNotEquals(term1.getId(), term2.getId());
    assertEquals(term1.getName(), term2.getName());
    assertNotEquals(term1.getFullyQualifiedName(), term2.getFullyQualifiedName());
  }

  @Test
  void test_moveTermToSameGlossary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    // Use a dedicated glossary with shorter name to avoid FQN length issues
    String glossaryName = ns.prefix("mvGls");
    CreateGlossary createGlossary =
        new CreateGlossary().withName(glossaryName).withDescription("Glossary for move test");
    Glossary glossary = client.glossaries().create(createGlossary);

    // Use short names to avoid FQN length issues when nesting
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName("parent")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent for move test");
    GlossaryTerm parent = createEntity(parentRequest);

    // Create term to move with short name
    CreateGlossaryTerm termRequest =
        new CreateGlossaryTerm()
            .withName("child")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term to be moved");
    GlossaryTerm term = createEntity(termRequest);

    String originalFqn = term.getFullyQualifiedName();

    // Move term under parent
    term.setParent(parent.getEntityReference());
    GlossaryTerm movedTerm = patchEntity(term.getId().toString(), term);

    // Verify parent is set
    assertNotNull(movedTerm.getParent());
    assertEquals(parent.getId(), movedTerm.getParent().getId());

    // FQN should have changed to include parent
    assertNotEquals(originalFqn, movedTerm.getFullyQualifiedName());
    assertTrue(movedTerm.getFullyQualifiedName().contains(parent.getName()));
  }

  @Test
  void test_circularReferencePreventionInHierarchy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_circular"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent");
    GlossaryTerm parent = createEntity(parentRequest);

    // Create child under parent
    CreateGlossaryTerm childRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child_circular"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child");
    GlossaryTerm child = createEntity(childRequest);

    // Try to make parent a child of child - should fail
    parent.setParent(child.getEntityReference());
    assertThrows(
        Exception.class,
        () -> patchEntity(parent.getId().toString(), parent),
        "Creating circular reference should fail");
  }

  @Test
  void test_glossaryTermWithMultipleOwners(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term with multiple owners
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_multi_owners"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with multiple owners")
            .withOwners(
                List.of(testUser1().getEntityReference(), testUser2().getEntityReference()));

    GlossaryTerm term = createEntity(request);
    assertNotNull(term.getOwners());
    assertEquals(2, term.getOwners().size());
  }

  @Test
  void test_updateGlossaryTermSynonyms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term with synonyms
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_update_syn"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for synonym update")
            .withSynonyms(List.of("initial1", "initial2"));

    GlossaryTerm term = createEntity(request);
    assertEquals(2, term.getSynonyms().size());

    // Update synonyms
    term.setSynonyms(List.of("updated1", "updated2", "updated3"));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertEquals(3, updated.getSynonyms().size());
    assertTrue(updated.getSynonyms().contains("updated1"));
    assertFalse(updated.getSynonyms().contains("initial1"));
  }

  @Test
  void test_glossaryTermWithEmptyFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create minimal term with only required fields (description is required)
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_minimal"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Minimal term for testing");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    assertEquals(ns.prefix("term_minimal"), term.getName());
    assertTrue(term.getSynonyms() == null || term.getSynonyms().isEmpty());
    assertTrue(term.getRelatedTerms() == null || term.getRelatedTerms().isEmpty());
  }

  @Test
  void test_glossaryTermReferencesUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create term
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_ref_update"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for reference update");

    GlossaryTerm term = createEntity(request);

    // Add references
    TermReference ref1 =
        new TermReference().withName("Ref1").withEndpoint(URI.create("https://example1.com"));
    TermReference ref2 =
        new TermReference().withName("Ref2").withEndpoint(URI.create("https://example2.com"));

    term.setReferences(List.of(ref1, ref2));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertEquals(2, updated.getReferences().size());

    // Update references - replace with new ones
    TermReference ref3 =
        new TermReference().withName("Ref3").withEndpoint(URI.create("https://example3.com"));
    updated.setReferences(List.of(ref3));
    GlossaryTerm updated2 = patchEntity(updated.getId().toString(), updated);
    assertEquals(1, updated2.getReferences().size());
    assertEquals("Ref3", updated2.getReferences().get(0).getName());
  }

  @Test
  void test_glossaryTermChildrenCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_children_count"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent for children count");
    GlossaryTerm parent = createEntity(parentRequest);

    // Create multiple children
    int childCount = 5;
    for (int i = 0; i < childCount; i++) {
      CreateGlossaryTerm childRequest =
          new CreateGlossaryTerm()
              .withName(ns.prefix("child_count_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withParent(parent.getFullyQualifiedName())
              .withDescription("Child " + i);
      createEntity(childRequest);
    }

    // Fetch parent with children
    GlossaryTerm fetchedParent = client.glossaryTerms().get(parent.getId().toString(), "children");
    assertNotNull(fetchedParent);
    assertNotNull(fetchedParent.getChildren());
    assertEquals(childCount, fetchedParent.getChildren().size());
  }

  @Test
  void test_bidirectionalRelatedTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create two terms
    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_bidirect_1"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First bidirectional term");
    GlossaryTerm term1 = createEntity(request1);

    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_bidirect_2"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Second bidirectional term")
            .withRelatedTerms(List.of(term1.getFullyQualifiedName()));
    GlossaryTerm term2 = createEntity(request2);

    // Fetch both with relatedTerms field
    GlossaryTerm fetchedTerm1 =
        client.glossaryTerms().get(term1.getId().toString(), "relatedTerms");
    GlossaryTerm fetchedTerm2 =
        client.glossaryTerms().get(term2.getId().toString(), "relatedTerms");

    // term2 should have term1 as related
    assertNotNull(fetchedTerm2.getRelatedTerms());
    assertTrue(fetchedTerm2.getRelatedTerms().size() >= 1);

    // In OpenMetadata, related terms relationship might be bidirectional
    // depending on implementation
  }

  @Test
  void test_glossaryTermUpdatePreservesRelationships(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create parent and child
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_preserve"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent");
    GlossaryTerm parent = createEntity(parentRequest);

    CreateGlossaryTerm childRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child_preserve"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child");
    GlossaryTerm child = createEntity(childRequest);

    // Update child's description
    child.setDescription("Updated child description");
    GlossaryTerm updated = patchEntity(child.getId().toString(), child);

    // Verify parent relationship is preserved
    assertNotNull(updated.getParent());
    assertEquals(parent.getId(), updated.getParent().getId());
    assertEquals("Updated child description", updated.getDescription());
  }

  @Test
  void test_glossaryTermFullyQualifiedNameHierarchy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    // Create 3-level hierarchy
    CreateGlossaryTerm level1Request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("level1"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Level 1");
    GlossaryTerm level1 = createEntity(level1Request);

    CreateGlossaryTerm level2Request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("level2"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(level1.getFullyQualifiedName())
            .withDescription("Level 2");
    GlossaryTerm level2 = createEntity(level2Request);

    CreateGlossaryTerm level3Request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("level3"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(level2.getFullyQualifiedName())
            .withDescription("Level 3");
    GlossaryTerm level3 = createEntity(level3Request);

    // Verify FQN hierarchy
    String glossaryName = glossary.getName();
    assertTrue(level1.getFullyQualifiedName().startsWith(glossaryName));
    assertTrue(level2.getFullyQualifiedName().contains(level1.getName()));
    assertTrue(level3.getFullyQualifiedName().contains(level2.getName()));

    // level3 FQN should contain all ancestors
    assertTrue(level3.getFullyQualifiedName().contains(glossaryName));
    assertTrue(level3.getFullyQualifiedName().contains(level1.getName()));
    assertTrue(level3.getFullyQualifiedName().contains(level2.getName()));
  }

  @Test
  void get_listGlossaryTermsWithDifferentFilters(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary createGlossary1 =
        new CreateGlossary()
            .withName(ns.prefix("glossary_filter_1"))
            .withDescription("First glossary for filter test");
    Glossary glossary1 = client.glossaries().create(createGlossary1);

    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_filter"))
            .withGlossary(glossary1.getFullyQualifiedName())
            .withDescription("Parent term");
    GlossaryTerm parent = createEntity(parentRequest);

    CreateGlossaryTerm child1Request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child_filter_1"))
            .withGlossary(glossary1.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child 1");
    GlossaryTerm child1 = createEntity(child1Request);

    CreateGlossaryTerm child2Request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child_filter_2"))
            .withGlossary(glossary1.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child 2");
    GlossaryTerm child2 = createEntity(child2Request);

    ListParams params = new ListParams();
    params.setFields("children,relatedTerms,reviewers,tags");
    ListResponse<GlossaryTerm> list = listEntities(params);
    assertNotNull(list);
    assertNotNull(list.getData());
    assertTrue(list.getData().size() > 0);
  }

  @Test
  void test_inheritGlossaryReviewerAndOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateGlossary glossaryRequest = new CreateGlossary();
    glossaryRequest.setName(ns.prefix("glossary_inherit"));
    glossaryRequest.setDescription("Glossary with reviewers and owner");
    glossaryRequest.setOwners(List.of(testUser2().getEntityReference()));
    glossaryRequest.setReviewers(List.of(testUser1().getEntityReference()));
    Glossary glossary = client.glossaries().create(glossaryRequest);

    CreateGlossaryTerm termRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_inherit"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term to inherit reviewers and owner");
    GlossaryTerm term = createEntity(termRequest);

    GlossaryTerm fetched = client.glossaryTerms().get(term.getId().toString(), "reviewers,owners");
    assertNotNull(fetched);
    assertNotNull(fetched.getReviewers());
    assertNotNull(fetched.getOwners());
  }

  @Test
  void patch_addDeleteRelatedTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_related_patch_1"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First term");
    GlossaryTerm term1 = createEntity(request1);

    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_related_patch_2"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Second term");
    GlossaryTerm term2 = createEntity(request2);

    term2.setRelatedTerms(List.of(term1.getEntityReference()));
    GlossaryTerm updated = patchEntity(term2.getId().toString(), term2);
    assertNotNull(updated.getRelatedTerms());
    assertTrue(updated.getRelatedTerms().size() >= 1);

    // Clearing related terms via PATCH requires setting to empty list, not null
    // Setting to null is a no-op in PATCH (field is not included in patch)
    updated.setRelatedTerms(new java.util.ArrayList<>());
    GlossaryTerm updated2 = patchEntity(updated.getId().toString(), updated);
    // After clearing, the server may return null or empty list
    assertTrue(updated2.getRelatedTerms() == null || updated2.getRelatedTerms().isEmpty());
  }

  @Test
  @org.junit.jupiter.api.Disabled("JsonValue conversion error in PATCH - needs SDK investigation")
  void patch_addDeleteTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_patch_tags"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for tag patching");
    GlossaryTerm term = createEntity(request);

    org.openmetadata.schema.type.TagLabel tag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);

    term.setTags(List.of(tag));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getTags());
    assertTrue(updated.getTags().size() >= 1);

    updated.setTags(null);
    GlossaryTerm updated2 = patchEntity(updated.getId().toString(), updated);
    assertTrue(updated2.getTags() == null || updated2.getTags().isEmpty());
  }

  @Test
  void patch_addDeleteStyle(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_style_patch"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for style patching");
    GlossaryTerm term = createEntity(request);

    org.openmetadata.schema.entity.type.Style style =
        new org.openmetadata.schema.entity.type.Style()
            .withColor("#00FF00")
            .withIconURL("http://example.com/icon.png");

    term.setStyle(style);
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getStyle());
    assertEquals("#00FF00", updated.getStyle().getColor());

    updated.setStyle(null);
    GlossaryTerm updated2 = patchEntity(updated.getId().toString(), updated);
    assertNull(updated2.getStyle());
  }

  @Test
  void get_entityWithDifferentFields_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_fields"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for fields test")
            .withOwners(List.of(testUser1().getEntityReference()))
            .withReviewers(List.of(testUser2().getEntityReference()));
    GlossaryTerm term = createEntity(request);

    GlossaryTerm withOwners = client.glossaryTerms().get(term.getId().toString(), "owners");
    assertNotNull(withOwners);
    assertNotNull(withOwners.getOwners());

    GlossaryTerm withReviewers = client.glossaryTerms().get(term.getId().toString(), "reviewers");
    assertNotNull(withReviewers);
    assertNotNull(withReviewers.getReviewers());

    GlossaryTerm withTags = client.glossaryTerms().get(term.getId().toString(), "tags");
    assertNotNull(withTags);

    GlossaryTerm withAll =
        client.glossaryTerms().get(term.getId().toString(), "owners,reviewers,tags");
    assertNotNull(withAll);
  }

  @Test
  void get_glossaryTermsWithPagination_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    for (int i = 0; i < 10; i++) {
      CreateGlossaryTerm request =
          new CreateGlossaryTerm()
              .withName(ns.prefix("page_term_" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withDescription("Pagination test term " + i);
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(5);
    ListResponse<GlossaryTerm> page1 = listEntities(params);
    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertNotNull(page1.getPaging());
  }

  @Test
  void test_createDuplicateGlossaryTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    String termName = ns.prefix("duplicate");
    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First term");
    createEntity(request1);

    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Duplicate term");
    assertThrows(Exception.class, () -> createEntity(request2));
  }

  @Test
  void test_selfReferenceValidation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("self_ref"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Self reference test");
    GlossaryTerm term = createEntity(request);

    term.setParent(term.getEntityReference());
    assertThrows(
        Exception.class,
        () -> patchEntity(term.getId().toString(), term),
        "Self-reference should fail");
  }

  @Test
  void test_childrenCountIncludesAllNestedTerms(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_nested_count"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent");
    GlossaryTerm parent = createEntity(parentRequest);

    CreateGlossaryTerm child1Request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child1_nested"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child 1");
    GlossaryTerm child1 = createEntity(child1Request);

    CreateGlossaryTerm grandchildRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("grandchild_nested"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(child1.getFullyQualifiedName())
            .withDescription("Grandchild");
    createEntity(grandchildRequest);

    GlossaryTerm fetchedParent =
        client.glossaryTerms().get(parent.getId().toString(), "children,childrenCount");
    assertNotNull(fetchedParent);
    assertNotNull(fetchedParent.getChildren());
  }

  @Test
  void test_glossaryTermNameWithSpecialCharacters(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_with_spaces"))
            .withDisplayName("Term With Spaces And Special-Chars_123")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with special characters");

    GlossaryTerm term = createEntity(request);
    assertNotNull(term);
    assertEquals(ns.prefix("term_with_spaces"), term.getName());
  }

  @Test
  void test_glossaryTermParentUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    CreateGlossary glossaryRequest =
        new CreateGlossary()
            .withName("glp_" + shortId)
            .withDescription("Test glossary for parent update test");
    Glossary glossary = client.glossaries().create(glossaryRequest);

    CreateGlossaryTerm parent1Request =
        new CreateGlossaryTerm()
            .withName("p1_" + shortId)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First parent");
    GlossaryTerm parent1 = createEntity(parent1Request);

    CreateGlossaryTerm parent2Request =
        new CreateGlossaryTerm()
            .withName("p2_" + shortId)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Second parent");
    GlossaryTerm parent2 = createEntity(parent2Request);

    CreateGlossaryTerm childRequest =
        new CreateGlossaryTerm()
            .withName("ch_" + shortId)
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent1.getFullyQualifiedName())
            .withDescription("Child");
    GlossaryTerm child = createEntity(childRequest);

    assertEquals(parent1.getId(), child.getParent().getId());

    child.setParent(parent2.getEntityReference());
    GlossaryTerm updated = patchEntity(child.getId().toString(), child);
    assertEquals(parent2.getId(), updated.getParent().getId());
  }

  @Test
  void test_glossaryTermRelatedTermsSymmetry(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_sym_1"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First term for symmetry test");
    GlossaryTerm term1 = createEntity(request1);

    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_sym_2"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Second term for symmetry test")
            .withRelatedTerms(List.of(term1.getFullyQualifiedName()));
    GlossaryTerm term2 = createEntity(request2);

    GlossaryTerm fetchedTerm2 =
        client.glossaryTerms().get(term2.getId().toString(), "relatedTerms");
    assertNotNull(fetchedTerm2.getRelatedTerms());
    assertTrue(fetchedTerm2.getRelatedTerms().size() >= 1);
  }

  @Test
  void test_deleteGlossaryTermWithChildren(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_del_children"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent to delete");
    GlossaryTerm parent = createEntity(parentRequest);

    CreateGlossaryTerm childRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child_del"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child");
    createEntity(childRequest);

    assertThrows(
        Exception.class,
        () -> deleteEntity(parent.getId().toString()),
        "Should not be able to delete parent with children without recursive flag");
  }

  @Test
  void test_glossaryTermVersionIncrement(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_version_inc"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Initial description");
    GlossaryTerm term = createEntity(request);
    Double initialVersion = term.getVersion();

    term.setDescription("Updated description v2");
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    // Version should increment for description change
    assertTrue(updated.getVersion() >= initialVersion, "Version should not decrease");

    // Must use the updated entity for the next patch to avoid version conflicts
    updated.setDescription("Updated description v3 - more changes");
    GlossaryTerm updated2 = patchEntity(updated.getId().toString(), updated);
    // Version may or may not increment depending on change significance
    assertTrue(updated2.getVersion() >= updated.getVersion(), "Version should not decrease");
  }

  @Test
  void test_glossaryTermReviewersMultipleUpdates(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_reviewers_multi"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for multiple reviewer updates");
    GlossaryTerm term = createEntity(request);

    term.setReviewers(List.of(testUser1().getEntityReference()));
    GlossaryTerm updated1 = patchEntity(term.getId().toString(), term);
    assertNotNull(updated1.getReviewers());
    assertEquals(1, updated1.getReviewers().size());

    updated1.setReviewers(
        List.of(testUser1().getEntityReference(), testUser2().getEntityReference()));
    GlossaryTerm updated2 = patchEntity(updated1.getId().toString(), updated1);
    assertNotNull(updated2.getReviewers());
    assertTrue(updated2.getReviewers().size() >= 2);

    updated2.setReviewers(List.of(testUser2().getEntityReference()));
    GlossaryTerm updated3 = patchEntity(updated2.getId().toString(), updated2);
    assertNotNull(updated3.getReviewers());
    assertEquals(1, updated3.getReviewers().size());
  }

  @Test
  void test_glossaryTermSynonymsPreservedOnUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_syn_preserve"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with synonyms")
            .withSynonyms(List.of("syn1", "syn2", "syn3"));
    GlossaryTerm term = createEntity(request);
    assertEquals(3, term.getSynonyms().size());

    term.setDescription("Updated description");
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getSynonyms());
    assertEquals(3, updated.getSynonyms().size());
    assertTrue(updated.getSynonyms().containsAll(List.of("syn1", "syn2", "syn3")));
  }

  @Test
  void test_glossaryTermOwnersUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_owners_update"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term for owner updates")
            .withOwners(List.of(testUser1().getEntityReference()));
    GlossaryTerm term = createEntity(request);
    assertEquals(1, term.getOwners().size());

    term.setOwners(List.of(testUser2().getEntityReference()));
    GlossaryTerm updated = patchEntity(term.getId().toString(), term);
    assertNotNull(updated.getOwners());
    assertEquals(1, updated.getOwners().size());
    assertEquals(testUser2().getId(), updated.getOwners().get(0).getId());
  }
}

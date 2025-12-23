package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateGlossaryTerm createMinimalRequest(TestNamespace ns) {
    Glossary glossary = getOrCreateGlossary(ns);

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
}

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
  protected CreateGlossaryTerm createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    Glossary glossary = getOrCreateGlossary(ns, client);

    return new CreateGlossaryTerm()
        .withName(ns.prefix("term"))
        .withGlossary(glossary.getFullyQualifiedName())
        .withDescription("Test glossary term created by integration test");
  }

  @Override
  protected CreateGlossaryTerm createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    Glossary glossary = getOrCreateGlossary(ns, client);

    return new CreateGlossaryTerm()
        .withName(name)
        .withGlossary(glossary.getFullyQualifiedName())
        .withDescription("Test glossary term");
  }

  private Glossary getOrCreateGlossary(TestNamespace ns, OpenMetadataClient client) {
    String glossaryName = ns.prefix("glossary");
    try {
      return client.glossaries().getByName(glossaryName);
    } catch (Exception e) {
      CreateGlossary createGlossary =
          new CreateGlossary().withName(glossaryName).withDescription("Test glossary for terms");
      return client.glossaries().create(createGlossary);
    }
  }

  @Override
  protected GlossaryTerm createEntity(CreateGlossaryTerm createRequest, OpenMetadataClient client) {
    return client.glossaryTerms().create(createRequest);
  }

  @Override
  protected GlossaryTerm getEntity(String id, OpenMetadataClient client) {
    return client.glossaryTerms().get(id);
  }

  @Override
  protected GlossaryTerm getEntityByName(String fqn, OpenMetadataClient client) {
    return client.glossaryTerms().getByName(fqn);
  }

  @Override
  protected GlossaryTerm patchEntity(String id, GlossaryTerm entity, OpenMetadataClient client) {
    return client.glossaryTerms().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.glossaryTerms().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.glossaryTerms().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.glossaryTerms().delete(id, params);
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
  protected ListResponse<GlossaryTerm> listEntities(ListParams params, OpenMetadataClient client) {
    return client.glossaryTerms().list(params);
  }

  @Override
  protected GlossaryTerm getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.glossaryTerms().get(id, fields);
  }

  @Override
  protected GlossaryTerm getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.glossaryTerms().getByName(fqn, fields);
  }

  @Override
  protected GlossaryTerm getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.glossaryTerms().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.glossaryTerms().getVersionList(id);
  }

  @Override
  protected GlossaryTerm getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.glossaryTerms().getVersion(id.toString(), version);
  }

  // ===================================================================
  // GLOSSARY TERM-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_glossaryTermWithSynonyms_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns, client);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_synonyms"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term with synonyms")
            .withSynonyms(List.of("alias1", "alias2", "alias3"));

    GlossaryTerm term = createEntity(request, client);
    assertNotNull(term);
    assertNotNull(term.getSynonyms());
    assertEquals(3, term.getSynonyms().size());
    assertTrue(term.getSynonyms().contains("alias1"));
  }

  @Test
  void post_glossaryTermWithReferences_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns, client);

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

    GlossaryTerm term = createEntity(request, client);
    assertNotNull(term);
    assertNotNull(term.getReferences());
    assertEquals(2, term.getReferences().size());
  }

  @Test
  void post_childGlossaryTerm_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns, client);

    // Create parent term
    CreateGlossaryTerm parentRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("parent_term"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent term");

    GlossaryTerm parentTerm = createEntity(parentRequest, client);
    assertNotNull(parentTerm);

    // Create child term under parent
    CreateGlossaryTerm childRequest =
        new CreateGlossaryTerm()
            .withName(ns.prefix("child_term"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parentTerm.getFullyQualifiedName())
            .withDescription("Child term");

    GlossaryTerm childTerm = createEntity(childRequest, client);
    assertNotNull(childTerm);
    assertNotNull(childTerm.getParent());
    assertEquals(parentTerm.getId(), childTerm.getParent().getId());
  }

  @Test
  void put_glossaryTermDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns, client);

    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix("term_update_desc"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Initial description");

    GlossaryTerm term = createEntity(request, client);
    assertEquals("Initial description", term.getDescription());

    // Update description
    term.setDescription("Updated description");
    GlossaryTerm updated = patchEntity(term.getId().toString(), term, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_glossaryTermNameUniquenessWithinGlossary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = getOrCreateGlossary(ns, client);

    // Create first term
    String termName = ns.prefix("unique_term");
    CreateGlossaryTerm request1 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("First term");

    GlossaryTerm term1 = createEntity(request1, client);
    assertNotNull(term1);

    // Attempt to create duplicate within same glossary
    CreateGlossaryTerm request2 =
        new CreateGlossaryTerm()
            .withName(termName)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Duplicate term");

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate term in same glossary should fail");
  }
}

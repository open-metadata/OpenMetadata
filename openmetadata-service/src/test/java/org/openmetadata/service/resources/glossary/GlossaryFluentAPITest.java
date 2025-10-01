package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.api.Bulk;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.fluent.Glossaries;
import org.openmetadata.sdk.fluent.GlossaryTerms;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Tests for Glossary and GlossaryTerms using the Fluent API.
 * Includes bulk import/export operations.
 */
public class GlossaryFluentAPITest extends OpenMetadataApplicationTest {

  private static OpenMetadataClient sdkClient;
  private static final String ADMIN_AUTH_HEADERS = "admin@open-metadata.org";

  @BeforeAll
  public static void setup(TestInfo testInfo) throws URISyntaxException, IOException {
    // Initialize SDK client with admin auth headers
    new GlossaryResourceTest().setup(testInfo);
    int port = APP.getLocalPort();
    String serverUrl = String.format("http://localhost:%d/api", port);

    OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .serverUrl(serverUrl)
            .apiKey(ADMIN_AUTH_HEADERS)
            .connectTimeout(30000)
            .readTimeout(60000)
            .testMode(true)
            .build();

    sdkClient = new OpenMetadataClient(config);

    // Set default client for fluent APIs
    Glossaries.setDefaultClient(sdkClient);
    GlossaryTerms.setDefaultClient(sdkClient);
    Bulk.setDefaultClient(sdkClient);
  }

  @Test
  void test_glossaryFluentAPICRUD(TestInfo test) {
    String glossaryName = "test_glossary_" + UUID.randomUUID().toString().substring(0, 8);

    // Create Glossary using fluent API
    Glossary glossary =
        Glossaries.create()
            .name(glossaryName)
            .withDescription("Test glossary created with fluent API")
            .withDisplayName("Test Glossary")
            .execute();

    assertNotNull(glossary);
    assertNotNull(glossary.getId());
    assertEquals(glossaryName, glossary.getName());
    assertEquals("Test glossary created with fluent API", glossary.getDescription());

    // Find and update glossary
    var fluentGlossary = Glossaries.find(glossary.getId()).fetch();
    assertNotNull(fluentGlossary);

    fluentGlossary.withDescription("Updated description via fluent API");
    Glossary updatedGlossary = fluentGlossary.save().get();
    assertEquals("Updated description via fluent API", updatedGlossary.getDescription());

    // List glossaries
    var glossaries = Glossaries.list().limit(10).fetch();
    assertTrue(glossaries.size() > 0);
    assertTrue(glossaries.stream().anyMatch(g -> g.get().getId().equals(glossary.getId())));

    // Delete glossary
    Glossaries.find(glossary.getId()).delete().confirm();

    // Verify deletion
    assertThrows(
        Exception.class,
        () -> {
          Glossaries.find(glossary.getId()).fetch();
        });
  }

  @Test
  void test_glossaryTermFluentAPICRUD(TestInfo test) {
    // First create a parent glossary
    String glossaryName = "parent_glossary_" + UUID.randomUUID().toString().substring(0, 8);
    Glossary glossary =
        Glossaries.create()
            .name(glossaryName)
            .withDescription("Parent glossary for terms")
            .execute();

    assertNotNull(glossary);

    // Create GlossaryTerm using fluent API
    String termName = "test_term_" + UUID.randomUUID().toString().substring(0, 8);
    GlossaryTerm term =
        GlossaryTerms.create()
            .name(termName)
            .withDescription("Test term created with fluent API")
            .withDisplayName("Test Term")
            .in(glossary.getFullyQualifiedName())
            .execute();

    assertNotNull(term);
    assertNotNull(term.getId());
    assertEquals(termName, term.getName());
    assertEquals("Test term created with fluent API", term.getDescription());
    assertEquals(0, term.getSynonyms().size());

    // Find and update term
    var fluentTerm = GlossaryTerms.find(term.getId()).fetch();
    assertNotNull(fluentTerm);

    fluentTerm.withDescription("Updated term description");
    GlossaryTerm updatedTerm = fluentTerm.save().get();
    assertEquals("Updated term description", updatedTerm.getDescription());

    // Create another term in the same glossary
    String secondTermName = "second_term_" + UUID.randomUUID().toString().substring(0, 8);
    GlossaryTerm secondTerm =
        GlossaryTerms.create()
            .name(secondTermName)
            .withDescription("Second term")
            .in(glossary.getFullyQualifiedName())
            .execute();

    assertNotNull(secondTerm);
    assertEquals(glossary.getId().toString(), secondTerm.getGlossary().getId().toString());

    // List terms
    var terms = GlossaryTerms.list().limit(10).fetch();
    assertFalse(terms.isEmpty());

    // Delete terms and glossary
    GlossaryTerms.find(secondTerm.getId()).delete().recursively().permanently().confirm();
    GlossaryTerms.find(term.getId()).delete().recursively().permanently().confirm();
    Glossaries.find(glossary.getId()).delete().recursively().permanently().confirm();
  }

  @Test
  @Disabled
  void test_bulkImportExportGlossary(TestInfo test) {
    // Create test data
    List<Object> entities = new ArrayList<>();

    // Create glossaries
    for (int i = 0; i < 3; i++) {
      String glossaryName =
          "bulk_glossary_" + i + "_" + UUID.randomUUID().toString().substring(0, 8);
      CreateGlossary createGlossary =
          new CreateGlossary()
              .withName(glossaryName)
              .withDescription("Bulk glossary " + i)
              .withDisplayName("Bulk Glossary " + i);
      entities.add(createGlossary);
    }

    // Test bulk import
    var importResult = Bulk.load().entities(entities).updateIfExists(true).execute();

    assertNotNull(importResult);

    // Test bulk export for glossaries
    var exportResult = Bulk.export().entityType("glossary").limit(100).execute();

    assertNotNull(exportResult);

    // Clean up - find and delete created glossaries
    var glossaries = Glossaries.list().limit(100).fetch();
    glossaries.stream()
        .filter(g -> g.get().getName().startsWith("bulk_glossary_"))
        .forEach(
            g -> {
              try {
                Glossaries.find(g.get().getId()).delete().confirm();
              } catch (Exception e) {
                // Ignore errors during cleanup
              }
            });
  }

  @Test
  void test_glossaryTermWithTags(TestInfo test) {
    // Create glossary
    String glossaryName = "tagged_glossary_" + UUID.randomUUID().toString().substring(0, 8);
    Glossary glossary =
        Glossaries.create()
            .name(glossaryName)
            .withDescription("Glossary for tagged terms")
            .execute();

    // Create term
    String termName = "tagged_term_" + UUID.randomUUID().toString().substring(0, 8);
    GlossaryTerm term =
        GlossaryTerms.create()
            .name(termName)
            .withDescription("Term with tags")
            .in(glossary.getFullyQualifiedName())
            .execute();

    // Add tags to term
    var fluentTerm = GlossaryTerms.find(term.getId()).includeTags().fetch();
    List<TagLabel> tags = new ArrayList<>();
    tags.add(
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withState(TagLabel.State.CONFIRMED));

    fluentTerm.withTags(tags);
    GlossaryTerm taggedTerm = fluentTerm.save().get();

    assertNotNull(taggedTerm.getTags());
    assertEquals(1, taggedTerm.getTags().size());
    assertEquals("PII.Sensitive", taggedTerm.getTags().get(0).getTagFQN());

    // Clean up
    GlossaryTerms.find(term.getId()).delete().recursively().permanently().confirm();
    Glossaries.find(glossary.getId()).delete().recursively().permanently().confirm();
  }

  @Test
  void test_glossaryHierarchy(TestInfo test) {
    // Create root glossary
    String rootGlossaryName = "root_glossary_" + UUID.randomUUID().toString().substring(0, 8);
    Glossary rootGlossary =
        Glossaries.create().name(rootGlossaryName).withDescription("Root glossary").execute();

    // Create parent term
    String parentTermName = "parent_term_" + UUID.randomUUID().toString().substring(0, 8);
    GlossaryTerm parentTerm =
        GlossaryTerms.create()
            .name(parentTermName)
            .withDescription("Parent term")
            .in(rootGlossary.getFullyQualifiedName())
            .execute();

    // Create multiple child terms
    List<GlossaryTerm> childTerms = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      String childTermName = "child_term_" + i + "_" + UUID.randomUUID().toString().substring(0, 8);
      GlossaryTerm childTerm =
          GlossaryTerms.create()
              .name(childTermName)
              .withDescription("Child term " + i)
              .in(rootGlossary.getFullyQualifiedName())
              .execute();
      childTerms.add(childTerm);
    }

    // Verify terms were created
    assertEquals(3, childTerms.size());
    childTerms.forEach(
        child -> {
          assertNotNull(child.getGlossary());
          assertEquals(rootGlossary.getId().toString(), child.getGlossary().getId().toString());
        });

    // Clean up - delete in reverse order
    childTerms.forEach(
        child -> {
          GlossaryTerms.find(child.getId()).delete().confirm();
        });
    GlossaryTerms.find(parentTerm.getId()).delete().recursively().permanently().confirm();
    Glossaries.find(rootGlossary.getId()).delete().recursively().permanently().confirm();
  }

  @Test
  @Disabled
  void test_bulkImportGlossaryTerms(TestInfo test) {
    // Create parent glossary first
    String glossaryName = "terms_glossary_" + UUID.randomUUID().toString().substring(0, 8);
    Glossary glossary =
        Glossaries.create().name(glossaryName).withDescription("Glossary for bulk terms").execute();

    // Create bulk terms
    List<Object> entities = new ArrayList<>();
    List<String> termNames = new ArrayList<>();

    for (int i = 0; i < 5; i++) {
      String termName = "bulk_term_" + i + "_" + UUID.randomUUID().toString().substring(0, 8);
      termNames.add(termName);
      CreateGlossaryTerm createTerm =
          new CreateGlossaryTerm()
              .withName(termName)
              .withDescription("Bulk term " + i)
              .withDisplayName("Bulk Term " + i)
              .withGlossary(glossary.getFullyQualifiedName());
      entities.add(createTerm);
    }

    // Import terms
    var importResult = Bulk.load().entities(entities).updateIfExists(false).execute();

    assertNotNull(importResult);

    // Verify terms were created
    var terms = GlossaryTerms.list().limit(100).fetch();
    long createdTermsCount =
        terms.stream().filter(t -> termNames.contains(t.get().getName())).count();
    assertEquals(5, createdTermsCount);

    // Export glossary terms
    var exportResult = Bulk.export().entityType("glossaryTerm").limit(100).execute();

    assertNotNull(exportResult);

    // Clean up
    terms.stream()
        .filter(t -> termNames.contains(t.get().getName()))
        .forEach(
            t -> {
              try {
                GlossaryTerms.find(t.get().getId()).delete().confirm();
              } catch (Exception e) {
                // Ignore cleanup errors
              }
            });
    Glossaries.find(glossary.getId()).delete().confirm();
  }
}

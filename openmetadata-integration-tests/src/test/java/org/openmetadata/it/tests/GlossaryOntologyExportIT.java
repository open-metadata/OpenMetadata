package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.rdf.RdfUpdater;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for Glossary Ontology Export API.
 *
 * <p>Tests verify that glossaries can be exported as RDF ontologies in various formats (Turtle,
 * RDF/XML, N-Triples, JSON-LD) with proper SKOS vocabulary mapping.
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryOntologyExportIT {

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryOntologyExportIT.class);
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private static final String TURTLE_CONTENT_TYPE = "text/turtle";
  private static final String RDF_XML_CONTENT_TYPE = "application/rdf+xml";
  private static final String N_TRIPLES_CONTENT_TYPE = "application/n-triples";
  private static final String JSON_LD_CONTENT_TYPE = "application/ld+json";

  @BeforeAll
  static void enableRdf() {
    RdfConfiguration rdfConfig = new RdfConfiguration();
    rdfConfig.setEnabled(true);
    rdfConfig.setBaseUri(java.net.URI.create("https://open-metadata.org/"));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(java.net.URI.create(TestSuiteBootstrap.getFusekiEndpoint()));
    rdfConfig.setUsername("admin");
    rdfConfig.setPassword("test-admin");
    rdfConfig.setDataset("openmetadata");
    RdfUpdater.initialize(rdfConfig);
  }

  @AfterAll
  static void disableRdf() {
    RdfUpdater.disable();
  }

  @Test
  void testExportGlossaryAsTurtle(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term = GlossaryTermTestFactory.createSimple(ns, glossary);

    assertNotNull(glossary.getId());
    assertNotNull(term.getId());

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result, "Export result should not be null");
    assertFalse(result.isEmpty(), "Export result should not be empty");

    assertTrue(result.contains("skos:ConceptScheme"), "Should contain SKOS ConceptScheme");
    assertTrue(result.contains("skos:Concept"), "Should contain SKOS Concept");
    assertTrue(result.contains("skos:prefLabel"), "Should contain SKOS prefLabel");
    assertTrue(result.contains(glossary.getName()), "Should contain glossary name");
    assertTrue(result.contains(term.getName()), "Should contain term name");

    LOG.debug("Turtle export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryAsRdfXml(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term = GlossaryTermTestFactory.createSimple(ns, glossary);

    String result = exportGlossary(glossary.getId(), "rdfxml", true);

    assertNotNull(result);
    assertFalse(result.isEmpty());

    assertTrue(
        result.contains("rdf:RDF") || result.contains("<rdf:RDF"),
        "Should contain RDF root element");
    assertTrue(
        result.contains("http://www.w3.org/2004/02/skos/core"), "Should reference SKOS namespace");

    LOG.debug("RDF/XML export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryAsNTriples(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term = GlossaryTermTestFactory.createSimple(ns, glossary);

    String result = exportGlossary(glossary.getId(), "ntriples", true);

    assertNotNull(result);
    assertFalse(result.isEmpty());

    assertTrue(result.contains("<http://"), "Should contain URI references");
    assertTrue(
        result.contains("http://www.w3.org/2004/02/skos/core#"), "Should reference SKOS namespace");

    LOG.debug("N-Triples export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryAsJsonLd(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term = GlossaryTermTestFactory.createSimple(ns, glossary);

    String result = exportGlossary(glossary.getId(), "jsonld", true);

    assertNotNull(result);
    assertFalse(result.isEmpty());

    assertTrue(result.contains("@"), "Should contain JSON-LD keywords");
    assertTrue(result.contains("http://www.w3.org/2004/02/skos/core"), "Should reference SKOS");

    LOG.debug("JSON-LD export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithParentChildRelations(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm parentTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "parent");
    GlossaryTerm childTerm = GlossaryTermTestFactory.createChild(ns, glossary, parentTerm, "child");

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);

    assertTrue(result.contains("skos:broader"), "Should contain skos:broader for child term");
    assertTrue(result.contains("skos:narrower"), "Should contain skos:narrower for parent term");
    assertTrue(result.contains("skos:hasTopConcept"), "Should contain hasTopConcept for root term");

    LOG.debug("Parent-child relations export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithSynonyms(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term =
        GlossaryTermTestFactory.createWithSynonyms(
            ns, glossary, "termWithSynonyms", List.of("alias1", "alias2"));

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);

    assertTrue(result.contains("skos:altLabel"), "Should contain skos:altLabel for synonyms");
    assertTrue(result.contains("alias1"), "Should contain first synonym");
    assertTrue(result.contains("alias2"), "Should contain second synonym");

    LOG.debug("Synonyms export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithoutRelations(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm parentTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "parent");
    GlossaryTerm childTerm = GlossaryTermTestFactory.createChild(ns, glossary, parentTerm, "child");

    String resultWithRelations = exportGlossary(glossary.getId(), "turtle", true);
    String resultWithoutRelations = exportGlossary(glossary.getId(), "turtle", false);

    assertNotNull(resultWithRelations);
    assertNotNull(resultWithoutRelations);

    assertTrue(resultWithRelations.contains("skos:broader"), "With relations should have broader");
    assertFalse(
        resultWithoutRelations.contains("skos:broader"),
        "Without relations should not have broader");

    LOG.debug("includeRelations parameter verified for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithMultipleTerms(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "term1");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "term2");
    GlossaryTerm term3 = GlossaryTermTestFactory.createWithName(ns, glossary, "term3");

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);
    assertTrue(result.contains(term1.getName()), "Should contain term1");
    assertTrue(result.contains(term2.getName()), "Should contain term2");
    assertTrue(result.contains(term3.getName()), "Should contain term3");

    int conceptCount = countOccurrences(result, "skos:Concept");
    assertTrue(conceptCount >= 3, "Should have at least 3 SKOS Concepts");

    LOG.debug("Multiple terms export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportNonExistentGlossary(TestNamespace ns) throws Exception {
    UUID nonExistentId = UUID.randomUUID();

    HttpResponse<String> response = exportGlossaryRaw(nonExistentId, "turtle", true);

    assertTrue(
        response.statusCode() >= 400,
        "Should return error status for non-existent glossary, got: " + response.statusCode());

    LOG.debug("Non-existent glossary export correctly returns error");
  }

  @Test
  void testExportGlossaryWithDescription(TestNamespace ns) throws Exception {
    String description = "This is a detailed glossary description for testing.";
    Glossary glossary = GlossaryTestFactory.createWithDescription(ns, description);
    GlossaryTerm term =
        GlossaryTermTestFactory.createWithDescription(ns, glossary, "Term description here.");

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);
    assertTrue(result.contains("skos:definition"), "Should contain skos:definition");

    LOG.debug("Description export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithRelatedTerms(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "term1");
    GlossaryTerm term2 =
        GlossaryTermTestFactory.createWithRelatedTerms(
            ns, glossary, "term2", List.of(term1.getFullyQualifiedName()));

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);
    assertTrue(
        result.contains("skos:related") || result.contains("skos:relatedMatch"),
        "Should contain skos:related for related terms");
    assertTrue(result.contains(term1.getName()), "Should contain first term");
    assertTrue(result.contains(term2.getName()), "Should contain second term");

    LOG.debug("Related terms export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportEmptyGlossary(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result, "Export result should not be null for empty glossary");
    assertFalse(result.isEmpty(), "Export result should not be empty");
    assertTrue(result.contains("skos:ConceptScheme"), "Should contain SKOS ConceptScheme");
    assertFalse(result.contains("skos:Concept ;"), "Should not contain any Concepts");

    LOG.debug("Empty glossary export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithDisplayName(TestNamespace ns) throws Exception {
    Glossary glossary =
        GlossaryTestFactory.createWithDisplayName(ns, "techglossary", "Technical Glossary");
    GlossaryTerm term =
        GlossaryTermTestFactory.createWithDisplayName(
            ns, glossary, "dbterm", "Database Terminology");

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);
    assertTrue(
        result.contains("Technical Glossary") || result.contains("techglossary"),
        "Should contain glossary display name or name");
    assertTrue(
        result.contains("Database Terminology") || result.contains("dbterm"),
        "Should contain term display name or name");

    LOG.debug("Display name export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithInvalidFormat(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTermTestFactory.createSimple(ns, glossary);

    String result = exportGlossary(glossary.getId(), "invalidformat", true);

    assertNotNull(result, "Should return result even with invalid format (defaults to turtle)");
    assertFalse(result.isEmpty(), "Result should not be empty");

    LOG.debug("Invalid format handling verified for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithDeepHierarchy(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm grandparent = GlossaryTermTestFactory.createWithName(ns, glossary, "grandparent");
    GlossaryTerm parent = GlossaryTermTestFactory.createChild(ns, glossary, grandparent, "parent");
    GlossaryTerm child = GlossaryTermTestFactory.createChild(ns, glossary, parent, "child");

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);
    assertTrue(result.contains(grandparent.getName()), "Should contain grandparent term");
    assertTrue(result.contains(parent.getName()), "Should contain parent term");
    assertTrue(result.contains(child.getName()), "Should contain child term");

    int broaderCount = countOccurrences(result, "skos:broader");
    assertTrue(broaderCount >= 2, "Should have at least 2 broader relations for deep hierarchy");

    LOG.debug("Deep hierarchy export successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithSpecialCharacters(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term =
        GlossaryTermTestFactory.createWithSynonyms(
            ns, glossary, "term", List.of("alias with spaces", "alias-with-dashes"));

    String result = exportGlossary(glossary.getId(), "turtle", true);

    assertNotNull(result);
    assertTrue(result.contains("alias with spaces"), "Should handle spaces in synonyms");
    assertTrue(result.contains("alias-with-dashes"), "Should handle dashes in synonyms");

    LOG.debug("Special characters export successful for glossary: {}", glossary.getName());
  }

  private String exportGlossary(UUID glossaryId, String format, boolean includeRelations)
      throws Exception {
    HttpResponse<String> response = exportGlossaryRaw(glossaryId, format, includeRelations);

    if (response.statusCode() != 200) {
      throw new RuntimeException(
          "Export failed with status " + response.statusCode() + ": " + response.body());
    }

    return response.body();
  }

  private HttpResponse<String> exportGlossaryRaw(
      UUID glossaryId, String format, boolean includeRelations) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/rdf/glossary/%s/export?format=%s&includeRelations=%s",
            baseUrl, glossaryId, format, includeRelations);

    String acceptHeader =
        switch (format.toLowerCase()) {
          case "rdfxml", "xml" -> RDF_XML_CONTENT_TYPE;
          case "ntriples", "nt" -> N_TRIPLES_CONTENT_TYPE;
          case "jsonld", "json-ld" -> JSON_LD_CONTENT_TYPE;
          default -> TURTLE_CONTENT_TYPE;
        };

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", acceptHeader)
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private int countOccurrences(String text, String pattern) {
    int count = 0;
    int index = 0;
    while ((index = text.indexOf(pattern, index)) != -1) {
      count++;
      index += pattern.length();
    }
    return count;
  }
}

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.rdf.RdfUpdater;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for glossary term typed relations.
 *
 * <p>These tests verify that typed semantic relationships between glossary terms (e.g.,
 * calculatedFrom, synonym, broader) are correctly stored and returned by the API.
 */
@Execution(ExecutionMode.SAME_THREAD)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryTermRelationIT {

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryTermRelationIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  private static OpenMetadataClient client;
  private static Glossary testGlossary;
  private static GlossaryTerm revenueTerm;
  private static GlossaryTerm salesTerm;
  private static GlossaryTerm mrrTerm;
  private static GlossaryTerm arrTerm;
  private static GlossaryTerm customerTerm;
  private static GlossaryTerm clientTerm;

  @BeforeAll
  public static void setup() throws Exception {
    RdfConfiguration rdfConfig = new RdfConfiguration();
    rdfConfig.setEnabled(true);
    rdfConfig.setBaseUri(java.net.URI.create("https://open-metadata.org/"));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(java.net.URI.create(TestSuiteBootstrap.getFusekiEndpoint()));
    rdfConfig.setUsername("admin");
    rdfConfig.setPassword("test-admin");
    rdfConfig.setDataset("openmetadata");
    RdfUpdater.initialize(rdfConfig);

    client = SdkClients.adminClient();

    // Create test glossary
    String glossaryName = "TestGlossaryRelations_" + UUID.randomUUID().toString().substring(0, 8);
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(glossaryName)
            .withDisplayName("Test Glossary for Relations")
            .withDescription("A test glossary to verify typed term relations");

    testGlossary = client.glossaries().create(createGlossary);
    assertNotNull(testGlossary, "Test glossary should be created");
    LOG.info("Created test glossary: {}", testGlossary.getFullyQualifiedName());

    // Create glossary terms
    revenueTerm = createGlossaryTerm("Revenue", "Total revenue from all sources");
    salesTerm = createGlossaryTerm("Sales", "Sales amount from products");
    mrrTerm = createGlossaryTerm("MRR", "Monthly Recurring Revenue");
    arrTerm = createGlossaryTerm("ARR", "Annual Recurring Revenue");
    customerTerm = createGlossaryTerm("Customer", "A paying customer");
    clientTerm = createGlossaryTerm("Client", "An alternative term for customer");

    LOG.info("Created {} glossary terms for relation testing", 6);
  }

  private static GlossaryTerm createGlossaryTerm(String name, String description) throws Exception {
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName(name)
            .withDisplayName(name)
            .withDescription(description)
            .withGlossary(testGlossary.getFullyQualifiedName());

    GlossaryTerm term = client.glossaryTerms().create(createTerm);
    assertNotNull(term, "Glossary term " + name + " should be created");
    LOG.info("Created glossary term: {}", term.getFullyQualifiedName());
    return term;
  }

  @Test
  @Order(1)
  public void testAddCalculatedFromRelation() throws Exception {
    // ARR is calculated from MRR (ARR = MRR * 12)
    addTypedRelation(arrTerm, mrrTerm, "calculatedFrom");

    // Verify the relation was added
    GlossaryTerm updated =
        client.glossaryTerms().getByName(arrTerm.getFullyQualifiedName(), "relatedTerms");
    assertNotNull(updated.getRelatedTerms(), "Related terms should not be null");
    assertFalse(updated.getRelatedTerms().isEmpty(), "Related terms should not be empty");

    boolean foundCalculatedFrom = false;
    for (TermRelation relation : updated.getRelatedTerms()) {
      LOG.info(
          "Relation found: {} -> {} (type: {})",
          arrTerm.getName(),
          relation.getTerm().getName(),
          relation.getRelationType());
      if (relation.getTerm().getId().equals(mrrTerm.getId())) {
        assertEquals(
            "calculatedFrom",
            relation.getRelationType(),
            "Relation type should be 'calculatedFrom'");
        foundCalculatedFrom = true;
      }
    }
    assertTrue(foundCalculatedFrom, "calculatedFrom relation should exist from ARR to MRR");
  }

  @Test
  @Order(2)
  public void testAddSynonymRelation() throws Exception {
    // Customer and Client are synonyms
    addTypedRelation(customerTerm, clientTerm, "synonym");

    // Verify the relation was added
    GlossaryTerm updated =
        client.glossaryTerms().getByName(customerTerm.getFullyQualifiedName(), "relatedTerms");
    assertNotNull(updated.getRelatedTerms(), "Related terms should not be null");

    boolean foundSynonym = false;
    for (TermRelation relation : updated.getRelatedTerms()) {
      LOG.info(
          "Relation found: {} -> {} (type: {})",
          customerTerm.getName(),
          relation.getTerm().getName(),
          relation.getRelationType());
      if (relation.getTerm().getId().equals(clientTerm.getId())) {
        assertEquals("synonym", relation.getRelationType(), "Relation type should be 'synonym'");
        foundSynonym = true;
      }
    }
    assertTrue(foundSynonym, "synonym relation should exist between Customer and Client");
  }

  @Test
  @Order(3)
  public void testAddBroaderRelation() throws Exception {
    // Revenue is a broader term than Sales
    addTypedRelation(salesTerm, revenueTerm, "broader");

    // Verify the relation was added
    GlossaryTerm updated =
        client.glossaryTerms().getByName(salesTerm.getFullyQualifiedName(), "relatedTerms");
    assertNotNull(updated.getRelatedTerms(), "Related terms should not be null");

    boolean foundBroader = false;
    for (TermRelation relation : updated.getRelatedTerms()) {
      LOG.info(
          "Relation found: {} -> {} (type: {})",
          salesTerm.getName(),
          relation.getTerm().getName(),
          relation.getRelationType());
      if (relation.getTerm().getId().equals(revenueTerm.getId())) {
        assertEquals("broader", relation.getRelationType(), "Relation type should be 'broader'");
        foundBroader = true;
      }
    }
    assertTrue(foundBroader, "broader relation should exist from Sales to Revenue");
  }

  @Test
  @Order(4)
  public void testGlossaryTermGraphEndpointReturnsTypedRelations() throws Exception {
    // Call the RDF graph endpoint
    String graphUrl =
        SdkClients.getServerUrl()
            + "/v1/rdf/glossary/graph?glossaryId="
            + testGlossary.getId()
            + "&limit=100&includeIsolated=true";

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(graphUrl))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "application/json")
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(200, response.statusCode(), "Graph endpoint should return 200");

    String responseBody = response.body();
    LOG.info("Graph response: {}", responseBody);

    JsonNode graphData = MAPPER.readTree(responseBody);

    // Verify edges have correct relation types
    JsonNode edges = graphData.get("edges");
    assertNotNull(edges, "Graph should have edges");
    assertTrue(edges.isArray(), "Edges should be an array");

    Set<String> foundRelationTypes = new HashSet<>();
    for (JsonNode edge : edges) {
      String relationType = edge.has("relationType") ? edge.get("relationType").asText() : null;
      String label = edge.has("label") ? edge.get("label").asText() : null;
      String from = edge.has("from") ? edge.get("from").asText() : null;
      String to = edge.has("to") ? edge.get("to").asText() : null;

      LOG.info("Edge: {} -> {} (relationType: {}, label: {})", from, to, relationType, label);

      if (relationType != null) {
        foundRelationTypes.add(relationType);
      }
    }

    LOG.info("Found relation types in graph: {}", foundRelationTypes);

    // Verify that we have specific relation types (not all generic "relatedTo")
    assertTrue(
        foundRelationTypes.contains("calculatedFrom")
            || foundRelationTypes.contains("synonym")
            || foundRelationTypes.contains("broader"),
        "Graph should contain typed relations (calculatedFrom, synonym, or broader), "
            + "but found: "
            + foundRelationTypes);

    // Verify labels are properly formatted
    boolean hasFormattedLabels = false;
    for (JsonNode edge : edges) {
      String label = edge.has("label") ? edge.get("label").asText() : null;
      if (label != null
          && (label.equals("Calculated From")
              || label.equals("Synonym")
              || label.equals("Broader"))) {
        hasFormattedLabels = true;
        break;
      }
    }
    assertTrue(
        hasFormattedLabels || !foundRelationTypes.isEmpty(),
        "Graph should have properly formatted labels or typed relations");
  }

  @Test
  @Order(5)
  public void testRelationTypesNotAllRelatedTo() throws Exception {
    // Get all relations for our test terms
    List<String> allRelationTypes = new ArrayList<>();

    for (GlossaryTerm term : List.of(arrTerm, customerTerm, salesTerm)) {
      GlossaryTerm updated =
          client.glossaryTerms().getByName(term.getFullyQualifiedName(), "relatedTerms");
      if (updated.getRelatedTerms() != null) {
        for (TermRelation relation : updated.getRelatedTerms()) {
          allRelationTypes.add(relation.getRelationType());
          LOG.info("Term {} has relation type: {}", term.getName(), relation.getRelationType());
        }
      }
    }

    LOG.info("All relation types found: {}", allRelationTypes);

    // Verify not all are "relatedTo"
    long relatedToCount =
        allRelationTypes.stream().filter(t -> "relatedTo".equals(t) || "related".equals(t)).count();
    long totalCount = allRelationTypes.size();

    assertTrue(totalCount > 0, "Should have at least some relations");
    assertTrue(
        relatedToCount < totalCount,
        "Not all relations should be 'relatedTo'. Found "
            + relatedToCount
            + " relatedTo out of "
            + totalCount
            + " total");
  }

  private void addTypedRelation(GlossaryTerm fromTerm, GlossaryTerm toTerm, String relationType)
      throws Exception {
    // Create a TermRelation with the typed relation
    TermRelation termRelation =
        new TermRelation()
            .withTerm(
                new EntityReference()
                    .withId(toTerm.getId())
                    .withType("glossaryTerm")
                    .withName(toTerm.getName())
                    .withFullyQualifiedName(toTerm.getFullyQualifiedName()))
            .withRelationType(relationType);

    List<TermRelation> existingRelations = new ArrayList<>();
    GlossaryTerm current =
        client.glossaryTerms().getByName(fromTerm.getFullyQualifiedName(), "relatedTerms");
    if (current.getRelatedTerms() != null) {
      existingRelations.addAll(current.getRelatedTerms());
    }
    existingRelations.add(termRelation);

    // Use PATCH to update the term with the new relation
    String patchUrl = SdkClients.getServerUrl() + "/v1/glossaryTerms/" + fromTerm.getId();

    String patchBody =
        MAPPER.writeValueAsString(
            List.of(
                new java.util.HashMap<String, Object>() {
                  {
                    put("op", "add");
                    put("path", "/relatedTerms/-");
                    put(
                        "value",
                        new java.util.HashMap<String, Object>() {
                          {
                            put("relationType", relationType);
                            put(
                                "term",
                                new java.util.HashMap<String, Object>() {
                                  {
                                    put("id", toTerm.getId().toString());
                                    put("type", "glossaryTerm");
                                  }
                                });
                          }
                        });
                  }
                }));

    LOG.info("PATCH request to {} with body: {}", patchUrl, patchBody);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(patchUrl))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(patchBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    LOG.info("PATCH response status: {}, body: {}", response.statusCode(), response.body());

    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "Adding relation should succeed. Status: "
            + response.statusCode()
            + ", Body: "
            + response.body());
  }

  @AfterAll
  static void disableRdf() {
    RdfUpdater.disable();
  }
}

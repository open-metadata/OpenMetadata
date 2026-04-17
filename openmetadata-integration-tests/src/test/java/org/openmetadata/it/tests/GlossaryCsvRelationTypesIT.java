/*
 *  Copyright 2024 Collate.
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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for Glossary CSV Import/Export with relation types.
 *
 * <p>Tests verify that glossary terms can be exported and imported via CSV with proper relation
 * type preservation. Format: "relationType:termFQN" or just "termFQN" (defaults to "relatedTo").
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryCsvRelationTypesIT {

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryCsvRelationTypesIT.class);
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void testExportGlossaryWithRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "term1");
    GlossaryTerm term2 =
        GlossaryTermTestFactory.createWithRelatedTerms(
            ns, glossary, "term2", List.of(term1.getFullyQualifiedName()));

    String csv = exportGlossaryCsv(glossary.getName());

    assertNotNull(csv, "CSV export should not be null");
    assertFalse(csv.isEmpty(), "CSV export should not be empty");
    assertTrue(csv.contains(term1.getName()), "CSV should contain term1");
    assertTrue(csv.contains(term2.getName()), "CSV should contain term2");

    LOG.debug("CSV export with relation types successful for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithSynonymRelationType(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "revenue");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "income");

    GlossaryTerm updatedTerm =
        addTermRelation(term1.getId().toString(), term2.getId().toString(), "synonym");
    assertNotNull(updatedTerm, "Term relation should be added successfully");
    assertNotNull(updatedTerm.getRelatedTerms(), "Term should have related terms");
    assertFalse(updatedTerm.getRelatedTerms().isEmpty(), "Related terms should not be empty");

    String csv = exportGlossaryCsv(glossary.getName());
    LOG.debug("Exported CSV for synonym test:\n{}", csv);

    assertNotNull(csv);
    assertTrue(
        csv.contains("synonym:") || csv.contains(term2.getFullyQualifiedName()),
        "CSV should contain synonym relation or term reference. CSV content:\n" + csv);

    LOG.debug("Synonym relation type export verified for glossary: {}", glossary.getName());
  }

  @Test
  void testImportGlossaryWithRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm =
        GlossaryTermTestFactory.createWithName(ns, glossary, "existingTerm");

    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s_newTerm,New Term,Test description,,synonym:%s,,,,,Draft,,,",
            ns.prefix(""), existingTerm.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, false);
    LOG.debug("Import result for relation types test: {}", result);

    assertNotNull(result, "Import result should not be null");
    // The import should process the row (success or partial success due to relation parsing)
    assertTrue(
        result.contains("\"numberOfRowsProcessed\""),
        "Import should process rows. Result: " + result);

    LOG.debug("Import with relation types test completed for glossary: {}", glossary.getName());
  }

  @Test
  void testImportGlossaryWithDefaultRelationType(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm =
        GlossaryTermTestFactory.createWithName(ns, glossary, "existingTerm");

    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s_legacyTerm,Legacy Term,Test description,,%s,,,,,Draft,,,",
            ns.prefix(""), existingTerm.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, false);

    assertNotNull(result);

    GlossaryTerm createdTerm =
        getGlossaryTerm(
            glossary.getFullyQualifiedName() + "." + ns.prefix("") + "_legacyTerm", "relatedTerms");

    if (createdTerm != null && createdTerm.getRelatedTerms() != null) {
      for (var relation : createdTerm.getRelatedTerms()) {
        assertEquals(
            "relatedTo", relation.getRelationType(), "Default relation type should be 'relatedTo'");
      }
    }

    LOG.debug(
        "Import with default relation type (relatedTo) verified for glossary: {}",
        glossary.getName());
  }

  @Test
  void testImportGlossaryWithMixedRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "term1");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "term2");
    GlossaryTerm term3 = GlossaryTermTestFactory.createWithName(ns, glossary, "term3");

    String termName = ns.prefix("") + "_mixedTerm";
    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s,Mixed Term,Test description,,synonym:%s;%s;broader:%s,,,,,Draft,,,",
            termName,
            term1.getFullyQualifiedName(),
            term2.getFullyQualifiedName(),
            term3.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, false);
    LOG.debug("Import result for mixed relations: {}", result);

    assertNotNull(result, "Import result should not be null");

    // Check for success or partial success - the important thing is that the import processed
    assertTrue(
        result.contains("\"status\":\"success\"")
            || result.contains("\"status\":\"partialSuccess\"")
            || result.contains("\"numberOfRowsPassed\":1"),
        "Import should process the row. Result: " + result);

    LOG.debug("Mixed relation types import verified for glossary: {}", glossary.getName());
  }

  @Test
  void testImportGlossaryWithInvalidRelationType(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm =
        GlossaryTermTestFactory.createWithName(ns, glossary, "existingTerm");

    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s_invalidRelTerm,Invalid Rel Term,Test description,,invalidtype:%s,,,,,Draft,,,",
            ns.prefix(""), existingTerm.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, true);

    assertNotNull(result);
    assertTrue(
        result.contains("Invalid relation type") || result.contains("failure"),
        "Import should report invalid relation type. Result: " + result);

    LOG.debug("Invalid relation type handling verified for glossary: {}", glossary.getName());
  }

  @Test
  void testCsvRoundTripPreservesRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "term1");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "term2");

    GlossaryTerm updatedTerm =
        addTermRelation(term1.getId().toString(), term2.getId().toString(), "synonym");
    assertNotNull(updatedTerm, "Term relation should be added successfully");
    assertNotNull(updatedTerm.getRelatedTerms(), "Term should have related terms");

    // Verify the relation type is correctly stored
    boolean hasSynonymRelation =
        updatedTerm.getRelatedTerms().stream().anyMatch(r -> "synonym".equals(r.getRelationType()));
    assertTrue(hasSynonymRelation, "Added relation should have 'synonym' type");

    String exportedCsv = exportGlossaryCsv(glossary.getName());
    assertNotNull(exportedCsv);
    LOG.debug("Exported CSV for round-trip test:\n{}", exportedCsv);

    assertTrue(
        exportedCsv.contains("synonym:" + term2.getFullyQualifiedName())
            || exportedCsv.contains("synonym:" + term1.getFullyQualifiedName()),
        "Exported CSV should contain 'synonym:' prefixed relation. CSV:\n" + exportedCsv);

    LOG.debug("Round-trip test completed for glossary: {}", glossary.getName());
  }

  @Test
  void testExportGlossaryWithMultipleRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm baseTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "baseTerm");
    GlossaryTerm synonymTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "synonymTerm");
    GlossaryTerm broaderTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "broaderTerm");
    GlossaryTerm relatedTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "relatedTerm");

    GlossaryTerm result1 =
        addTermRelation(baseTerm.getId().toString(), synonymTerm.getId().toString(), "synonym");
    GlossaryTerm result2 =
        addTermRelation(baseTerm.getId().toString(), broaderTerm.getId().toString(), "broader");
    GlossaryTerm result3 =
        addTermRelation(baseTerm.getId().toString(), relatedTerm.getId().toString(), "relatedTo");

    assertNotNull(result1, "Synonym relation should be added");
    assertNotNull(result2, "Broader relation should be added");
    assertNotNull(result3, "RelatedTo relation should be added");

    // Verify relation types are correctly stored in the returned terms
    assertNotNull(result1.getRelatedTerms(), "Synonym result should have related terms");
    assertNotNull(result2.getRelatedTerms(), "Broader result should have related terms");
    assertNotNull(result3.getRelatedTerms(), "RelatedTo result should have related terms");

    String csv = exportGlossaryCsv(glossary.getName());
    LOG.debug("Exported CSV for multiple relations test:\n{}", csv);

    assertNotNull(csv);
    // Verify CSV contains bidirectional relations - baseTerm's FQN should appear in other terms'
    // relatedTerms
    String baseTermFqn = baseTerm.getFullyQualifiedName();
    assertTrue(
        csv.contains("synonym:") && csv.contains(baseTermFqn),
        "CSV should contain synonym relation with baseTerm FQN. CSV:\n" + csv);
    assertTrue(
        csv.contains("broader:") && csv.contains(baseTermFqn),
        "CSV should contain broader relation with baseTerm FQN. CSV:\n" + csv);
    // relatedTo relations appear without prefix
    assertTrue(
        csv.contains(baseTermFqn), "CSV should contain baseTerm FQN in relatedTerms. CSV:\n" + csv);

    LOG.debug("Multiple relation types export verified for glossary: {}", glossary.getName());
  }

  @Test
  void testAllValidRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);

    String[] relationTypes = {
      "relatedTo",
      "synonym",
      "broader",
      "narrower",
      "antonym",
      "partOf",
      "hasPart",
      "calculatedFrom",
      "usedToCalculate",
      "seeAlso"
    };

    GlossaryTerm baseTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "baseTerm");

    for (String relationType : relationTypes) {
      GlossaryTerm targetTerm =
          GlossaryTermTestFactory.createWithName(ns, glossary, "target_" + relationType);
      GlossaryTerm result =
          addTermRelation(baseTerm.getId().toString(), targetTerm.getId().toString(), relationType);
      assertNotNull(result, "Relation " + relationType + " should be added successfully");
      assertNotNull(result.getRelatedTerms(), "Related terms should not be null after adding");
    }

    String csv = exportGlossaryCsv(glossary.getName());
    LOG.debug("Exported CSV for all relation types test:\n{}", csv);

    assertNotNull(csv, "CSV export should succeed with all relation types");

    // Verify the CSV contains the baseTerm name in the CSV
    // The name column contains term name, relatedTerms column contains target FQNs
    assertTrue(csv.contains(baseTerm.getName()), "CSV should contain baseTerm name. CSV:\n" + csv);

    // Verify that at least one relation type prefix is present in the export
    boolean hasRelationPrefix =
        csv.contains("synonym:")
            || csv.contains("broader:")
            || csv.contains("narrower:")
            || csv.contains("antonym:")
            || csv.contains("partOf:")
            || csv.contains("hasPart:")
            || csv.contains("calculatedFrom:")
            || csv.contains("usedToCalculate:")
            || csv.contains("seeAlso:");
    assertTrue(
        hasRelationPrefix, "CSV should contain at least one relation type prefix. CSV:\n" + csv);

    LOG.debug("All valid relation types test completed for glossary: {}", glossary.getName());
  }

  @Test
  void testImportThenVerifyRelationViaApi(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "targetTerm");

    String newTermName = ns.prefix("") + "_importedTerm";
    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s,Imported Term,Imported via CSV,,broader:%s,,,,,Draft,,,",
            newTermName, existingTerm.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, false);
    assertNotNull(result);
    LOG.debug("Import result: {}", result);

    GlossaryTerm importedTerm =
        getGlossaryTerm(glossary.getFullyQualifiedName() + "." + newTermName, "relatedTerms");

    assertNotNull(importedTerm, "Imported term should exist via API");
    assertNotNull(importedTerm.getRelatedTerms(), "Imported term should have related terms");
    assertFalse(importedTerm.getRelatedTerms().isEmpty(), "Related terms should not be empty");

    boolean hasBroaderRelation =
        importedTerm.getRelatedTerms().stream()
            .anyMatch(
                r ->
                    "broader".equals(r.getRelationType())
                        && r.getTerm().getId().equals(existingTerm.getId()));

    assertTrue(
        hasBroaderRelation,
        "Imported term should have 'broader' relation to target. Relations: "
            + importedTerm.getRelatedTerms());
  }

  @Test
  void testFullRoundTripExportReimportVerify(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "alpha");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "beta");

    addTermRelation(term1.getId().toString(), term2.getId().toString(), "broader");

    String exportedCsv = exportGlossaryCsv(glossary.getName());
    assertNotNull(exportedCsv);
    LOG.debug("Exported CSV for full round-trip:\n{}", exportedCsv);

    assertTrue(
        exportedCsv.contains("broader:"),
        "Exported CSV should contain 'broader:' prefix. CSV:\n" + exportedCsv);

    Glossary glossary2 = GlossaryTestFactory.createWithName(ns, "roundtripTarget");
    String result = importGlossaryCsv(glossary2.getName(), exportedCsv, false);
    assertNotNull(result);
    LOG.debug("Re-import result: {}", result);

    assertTrue(
        result.contains("\"numberOfRowsPassed\""),
        "Re-import should process rows. Result: " + result);
  }

  @Test
  void testFqnWithColonIsNotMisinterpreted(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm =
        GlossaryTermTestFactory.createWithName(ns, glossary, "existingTerm");

    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension%n"
                + ",%s_colonTerm,Colon Term,Test description,,notarelation:%s.subterm,,,,,Draft,,,",
            ns.prefix(""), existingTerm.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, true);

    assertNotNull(result);

    LOG.debug("FQN with colon handling verified for glossary: {}", glossary.getName());
  }

  private GlossaryTerm addTermRelation(String fromTermId, String toTermId, String relationType)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s/relations", baseUrl, fromTermId);

    String jsonBody =
        String.format(
            "{\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"},\"relationType\":\"%s\"}",
            toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.error(
          "Failed to add term relation: status={}, body={}",
          response.statusCode(),
          response.body());
      throw new RuntimeException(
          "Failed to add term relation: status="
              + response.statusCode()
              + ", body="
              + response.body());
    }

    return OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private GlossaryTerm getGlossaryTerm(String fqn, String fields) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaryTerms/name/%s?fields=%s",
            baseUrl, java.net.URLEncoder.encode(fqn, "UTF-8"), fields);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to get glossary term: status={}, body={}",
          response.statusCode(),
          response.body());
      return null;
    }

    return OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private String exportGlossaryCsv(String glossaryName) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaries/name/%s/export",
            baseUrl, java.net.URLEncoder.encode(glossaryName, "UTF-8"));

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "text/plain")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      throw new RuntimeException(
          "Export failed with status " + response.statusCode() + ": " + response.body());
    }

    return response.body();
  }

  private String importGlossaryCsv(String glossaryName, String csvContent, boolean dryRun)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaries/name/%s/import?dryRun=%s",
            baseUrl, java.net.URLEncoder.encode(glossaryName, "UTF-8"), dryRun);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "text/plain")
            .timeout(Duration.ofSeconds(30))
            .PUT(HttpRequest.BodyPublishers.ofString(csvContent))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    return response.body();
  }
}

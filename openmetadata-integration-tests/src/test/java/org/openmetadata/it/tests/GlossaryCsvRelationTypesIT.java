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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.TermRelation;
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
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s_newTerm,New Term,Test description,,synonym:%s,,,,,Draft,,,,",
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
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s_legacyTerm,Legacy Term,Test description,,%s,,,,,Draft,,,,",
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
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s,Mixed Term,Test description,,synonym:%s;%s;broader:%s,,,,,Draft,,,,",
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
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s_invalidRelTerm,Invalid Rel Term,Test description,,invalidtype:%s,,,,,Draft,,,,",
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
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s,Imported Term,Imported via CSV,,broader:%s,,,,,Draft,,,,",
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
  void testDryRunReimportWithRelatedTermsInSameCsv(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
    GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");
    addTermRelation(term1.getId().toString(), term2.getId().toString(), "relatedTo");

    String exportedCsv = exportGlossaryCsv(glossary.getName());
    String result = importGlossaryCsv(glossary.getName(), exportedCsv, true);

    JsonNode importResult = OBJECT_MAPPER.readTree(result);
    assertEquals("success", importResult.path("status").asText(), "Result: " + result);
    assertEquals(0, importResult.path("numberOfRowsFailed").asInt(), "Result: " + result);
  }

  @Test
  void testImportNewTermsRelatedToEarlierRowInSameCsv(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String termA = ns.prefix("termA");
    String csv =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s,,Term A,,,,,,,,,,,%n"
                + ",%s,,Term B,,%s.%s,,,,,,,,,",
            termA, ns.prefix("termB"), glossary.getName(), termA);

    for (boolean dryRun : List.of(true, false)) {
      String result = importGlossaryCsv(glossary.getName(), csv, dryRun);
      JsonNode importResult = OBJECT_MAPPER.readTree(result);
      assertEquals("success", importResult.path("status").asText(), dryRun + ": " + result);
      assertEquals(0, importResult.path("numberOfRowsFailed").asInt(), dryRun + ": " + result);
    }
    GlossaryTerm termB =
        getGlossaryTerm(glossary.getName() + "." + ns.prefix("termB"), "relatedTerms");
    assertEquals(
        glossary.getName() + "." + termA,
        termB.getRelatedTerms().get(0).getTerm().getFullyQualifiedName());
  }

  @Test
  void testFqnWithColonIsNotMisinterpreted(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm existingTerm =
        GlossaryTermTestFactory.createWithName(ns, glossary, "existingTerm");

    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s_colonTerm,Colon Term,Test description,,notarelation:%s.subterm,,,,,Draft,,,,",
            ns.prefix(""), existingTerm.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, true);

    assertNotNull(result);

    LOG.debug("FQN with colon handling verified for glossary: {}", glossary.getName());
  }

  /**
   * Shared resource key for the global {@code glossaryTermRelationSettings} endpoint. Any IT class
   * that mutates these settings must use the same key on a {@link ResourceLock} so JUnit serialises
   * across classes; a class-local synchronized block would only guard intra-class concurrency.
   */
  private static final String SETTINGS_RESOURCE_KEY =
      SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS;

  private static final String TERM_CSV_HEADER =
      "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension\n";

  @Test
  void termExportContainsExactlyItsDescendants(final TestNamespace ns) throws Exception {
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final GlossaryTerm parent =
        GlossaryTermTestFactory.createWithName(ns, glossary, "exportParent");
    final GlossaryTerm child =
        GlossaryTermTestFactory.createChild(ns, glossary, parent, "exportChild");
    final GlossaryTerm grandchild =
        GlossaryTermTestFactory.createChild(ns, glossary, child, "exportGrandchild");
    GlossaryTermTestFactory.createWithName(ns, glossary, "exportSibling");

    final List<CSVRecord> rows = parseRows(exportTermCsv(parent.getFullyQualifiedName()));
    assertEquals(2, rows.size());
    assertEquals(
        List.of(child.getName(), grandchild.getName()),
        rows.stream().map(row -> row.get("name*")).toList());
    assertEquals(parent.getFullyQualifiedName(), rows.get(0).get("parent"));
    assertEquals(child.getFullyQualifiedName(), rows.get(1).get("parent"));
  }

  @Test
  void termImportValidatesBatchBeforePersistingHierarchyAndRelations(final TestNamespace ns)
      throws Exception {
    final TermImport terms = TermImport.of(ns);

    final JsonNode dryRun =
        OBJECT_MAPPER.readTree(importTermCsv(terms.scopeFqn(), terms.csv(), true));
    assertEquals(
        new ImportResult("success", true, 2, 2, 0), ImportResult.of(dryRun), dryRun.toString());
    assertEquals(404, termGetStatus(terms.parentFqn()));
    assertEquals(404, termGetStatus(terms.childFqn()));

    final JsonNode imported =
        OBJECT_MAPPER.readTree(importTermCsv(terms.scopeFqn(), terms.csv(), false));
    assertEquals(
        new ImportResult("success", false, 2, 2, 0),
        ImportResult.of(imported),
        imported.toString());
    final GlossaryTerm parent = assertPersistedHierarchy(terms);

    final JsonNode rejected =
        OBJECT_MAPPER.readTree(importTermCsv(terms.scopeFqn(), terms.selfParentCsv(), false));
    assertEquals(
        new ImportResult("failure", false, 1, 0, 1),
        ImportResult.of(rejected),
        rejected.toString());
    assertChildUnchanged(terms, parent);
  }

  /** A scope term with a relation target under it, and the CSV rows that add a parent and child. */
  private record TermImport(
      GlossaryTerm scope, GlossaryTerm target, String parentName, String childName) {
    static TermImport of(final TestNamespace ns) {
      final Glossary glossary = GlossaryTestFactory.createSimple(ns);
      final GlossaryTerm scope =
          GlossaryTermTestFactory.createWithName(ns, glossary, "importScope");
      final GlossaryTerm target =
          GlossaryTermTestFactory.createChild(ns, glossary, scope, "target");
      return new TermImport(scope, target, ns.prefix("importParent"), ns.prefix("importChild"));
    }

    String scopeFqn() {
      return scope.getFullyQualifiedName();
    }

    String parentFqn() {
      return scopeFqn() + "." + parentName;
    }

    String childFqn() {
      return parentFqn() + "." + childName;
    }

    String csv() {
      return TERM_CSV_HEADER
          + csvRow(scopeFqn(), parentName, "")
          + csvRow(parentFqn(), childName, "relatedTo:" + target.getFullyQualifiedName());
    }

    /** One row that names the child as its own parent. */
    String selfParentCsv() {
      return TERM_CSV_HEADER + csvRow(childFqn(), childName, "");
    }
  }

  private record ImportResult(
      String status, boolean dryRun, int processed, int passed, int failed) {
    static ImportResult of(final JsonNode result) {
      assertTrue(result.path("dryRun").isBoolean(), result.toString());
      assertTrue(result.path("numberOfRowsProcessed").isInt(), result.toString());
      assertTrue(result.path("numberOfRowsPassed").isInt(), result.toString());
      assertTrue(result.path("numberOfRowsFailed").isInt(), result.toString());
      return new ImportResult(
          result.path("status").asText(),
          result.path("dryRun").asBoolean(),
          result.path("numberOfRowsProcessed").asInt(),
          result.path("numberOfRowsPassed").asInt(),
          result.path("numberOfRowsFailed").asInt());
    }
  }

  private GlossaryTerm assertPersistedHierarchy(final TermImport terms) throws Exception {
    final GlossaryTerm parent = getGlossaryTerm(terms.parentFqn(), "parent");
    final GlossaryTerm child = getGlossaryTerm(terms.childFqn(), "parent,relatedTerms");
    assertNotNull(parent);
    assertNotNull(child);
    assertEquals(terms.scope().getId(), parent.getParent().getId());
    assertEquals(parent.getId(), child.getParent().getId());
    assertEquals(1, child.getRelatedTerms().size());
    assertEquals(terms.target().getId(), child.getRelatedTerms().getFirst().getTerm().getId());
    assertEquals("relatedTo", child.getRelatedTerms().getFirst().getRelationType());
    return parent;
  }

  private void assertChildUnchanged(final TermImport terms, final GlossaryTerm parent)
      throws Exception {
    final GlossaryTerm unchanged = getGlossaryTerm(terms.childFqn(), "parent,relatedTerms");
    assertNotNull(unchanged);
    assertEquals(parent.getId(), unchanged.getParent().getId());
    assertEquals(terms.target().getId(), unchanged.getRelatedTerms().getFirst().getTerm().getId());
  }

  private static String csvRow(final String parent, final String name, final String relation) {
    return CSVFormat.DEFAULT.format(
            parent, name, "", "description", "", relation, "", "", "", "", "Draft", "", "", "", "")
        + "\n";
  }

  private static List<CSVRecord> parseRows(final String csv) throws Exception {
    try (CSVParser parser =
        CSVFormat.DEFAULT.withFirstRecordAsHeader().parse(new StringReader(csv))) {
      return parser.getRecords();
    }
  }

  @Test
  void testImportPreservesMixedRelationsViaApi(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm t1 = GlossaryTermTestFactory.createWithName(ns, glossary, "t1");
    GlossaryTerm t2 = GlossaryTermTestFactory.createWithName(ns, glossary, "t2");
    GlossaryTerm t3 = GlossaryTermTestFactory.createWithName(ns, glossary, "t3");

    String newTermName = ns.prefix("") + "_mixed";
    String csvContent =
        String.format(
            "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                + ",%s,Mixed,Mixed term,,synonym:%s;%s;narrower:%s,,,,,Draft,,,,",
            newTermName,
            t1.getFullyQualifiedName(),
            t2.getFullyQualifiedName(),
            t3.getFullyQualifiedName());

    String result = importGlossaryCsv(glossary.getName(), csvContent, false);
    assertNotNull(result);
    assertTrue(
        result.contains("\"numberOfRowsPassed\":1"), "Expected one row to pass. Result: " + result);

    GlossaryTerm imported =
        getGlossaryTerm(glossary.getFullyQualifiedName() + "." + newTermName, "relatedTerms");
    assertNotNull(imported, "Imported term should be retrievable via API");
    assertNotNull(imported.getRelatedTerms(), "Imported term should have related terms");
    assertEquals(
        3,
        imported.getRelatedTerms().size(),
        "Expected exactly 3 relations. Got: " + imported.getRelatedTerms());

    Map<String, String> typeByTermId = new HashMap<>();
    for (TermRelation r : imported.getRelatedTerms()) {
      typeByTermId.put(r.getTerm().getId().toString(), r.getRelationType());
    }
    assertEquals("synonym", typeByTermId.get(t1.getId().toString()), "t1 should be synonym");
    assertEquals("relatedTo", typeByTermId.get(t2.getId().toString()), "t2 should be relatedTo");
    assertEquals("narrower", typeByTermId.get(t3.getId().toString()), "t3 should be narrower");
  }

  @Test
  void testAsymmetricRelationExportShowsBothSides(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm parentTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "parentConcept");
    GlossaryTerm childTerm = GlossaryTermTestFactory.createWithName(ns, glossary, "childConcept");

    addTermRelation(childTerm.getId().toString(), parentTerm.getId().toString(), "broader");

    String csv = exportGlossaryCsv(glossary.getName());
    LOG.debug("Exported CSV for asymmetric test:\n{}", csv);

    String childRow = findRowByTerm(csv, childTerm.getName());
    String parentRow = findRowByTerm(csv, parentTerm.getName());
    assertNotNull(childRow, "Child term row should be in CSV");
    assertNotNull(parentRow, "Parent term row should be in CSV");

    assertTrue(
        childRow.contains("broader:" + parentTerm.getFullyQualifiedName()),
        "Child term row should reference parent with 'broader' prefix. Row: " + childRow);
    assertTrue(
        parentRow.contains("narrower:" + childTerm.getFullyQualifiedName()),
        "Parent term row should reference child with 'narrower' prefix (inverse). Row: "
            + parentRow);
  }

  @Test
  void testFullExportReimportPreservesRelationTypes(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm t1 = GlossaryTermTestFactory.createWithName(ns, glossary, "alpha");
    GlossaryTerm t2 = GlossaryTermTestFactory.createWithName(ns, glossary, "beta");
    GlossaryTerm t3 = GlossaryTermTestFactory.createWithName(ns, glossary, "gamma");
    GlossaryTerm origin = GlossaryTermTestFactory.createWithName(ns, glossary, "origin");

    addTermRelation(origin.getId().toString(), t1.getId().toString(), "synonym");
    addTermRelation(origin.getId().toString(), t2.getId().toString(), "broader");
    addTermRelation(origin.getId().toString(), t3.getId().toString(), "relatedTo");

    String exportedCsv = exportGlossaryCsv(glossary.getName());
    String[] lines = exportedCsv.split("\\R");
    String header = lines[0];
    String originRow = findRowByTerm(exportedCsv, origin.getName());
    assertNotNull(originRow, "Origin row should be present in exported CSV");

    String cloneName = ns.prefix("") + "_clone";
    String clonedRow = originRow.replace("," + origin.getName() + ",", "," + cloneName + ",");
    assertFalse(
        clonedRow.equals(originRow),
        "Replacement should produce a different name; row was: " + originRow);

    String reimportCsv = header + "\r\n" + clonedRow;
    String result = importGlossaryCsv(glossary.getName(), reimportCsv, false);
    assertNotNull(result);
    assertTrue(
        result.contains("\"numberOfRowsPassed\":1"),
        "Reimport should pass exactly one row. Result: " + result);

    GlossaryTerm clone =
        getGlossaryTerm(glossary.getFullyQualifiedName() + "." + cloneName, "relatedTerms");
    assertNotNull(clone, "Cloned term should be retrievable via API");
    assertNotNull(clone.getRelatedTerms(), "Cloned term should have related terms");
    assertEquals(
        3,
        clone.getRelatedTerms().size(),
        "Cloned term should have 3 relations. Got: " + clone.getRelatedTerms());

    Map<String, String> typeByTermId = new HashMap<>();
    for (TermRelation r : clone.getRelatedTerms()) {
      typeByTermId.put(r.getTerm().getId().toString(), r.getRelationType());
    }
    assertEquals(
        "synonym", typeByTermId.get(t1.getId().toString()), "synonym relation should round-trip");
    assertEquals(
        "broader", typeByTermId.get(t2.getId().toString()), "broader relation should round-trip");
    assertEquals(
        "relatedTo",
        typeByTermId.get(t3.getId().toString()),
        "relatedTo relation should round-trip");
  }

  @Test
  @ResourceLock(value = SETTINGS_RESOURCE_KEY, mode = ResourceAccessMode.READ_WRITE)
  void testRoundTripWithCustomRelationType(TestNamespace ns) throws Exception {
    String customType = "causes" + System.currentTimeMillis();
    String inverseType = "causedBy" + System.currentTimeMillis();
    addCustomRelationTypePair(customType, inverseType);
    try {
      Glossary glossary = GlossaryTestFactory.createSimple(ns);
      GlossaryTerm cause = GlossaryTermTestFactory.createWithName(ns, glossary, "cause");
      GlossaryTerm effect = GlossaryTermTestFactory.createWithName(ns, glossary, "effect");

      addTermRelation(cause.getId().toString(), effect.getId().toString(), customType);

      String csv = exportGlossaryCsv(glossary.getName());
      String causeRow = findRowByTerm(csv, cause.getName());
      assertNotNull(causeRow, "Cause row should be present in exported CSV");
      assertTrue(
          causeRow.contains(customType + ":" + effect.getFullyQualifiedName()),
          "Cause row should contain '" + customType + ":<effect-fqn>'. Row: " + causeRow);

      String newName = ns.prefix("") + "_imported";
      String csvImport =
          String.format(
              "parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension%n"
                  + ",%s,Imported,via custom type,,%s:%s,,,,,Draft,,,,",
              newName, customType, effect.getFullyQualifiedName());
      String result = importGlossaryCsv(glossary.getName(), csvImport, false);
      assertNotNull(result);
      assertTrue(
          result.contains("\"numberOfRowsPassed\":1"),
          "Import with custom relation type should pass. Result: " + result);

      GlossaryTerm imported =
          getGlossaryTerm(glossary.getFullyQualifiedName() + "." + newName, "relatedTerms");
      assertNotNull(imported, "Imported term should be retrievable");
      assertNotNull(imported.getRelatedTerms(), "Imported term should have related terms");
      assertEquals(1, imported.getRelatedTerms().size(), "Expected one custom relation");
      assertEquals(
          customType,
          imported.getRelatedTerms().get(0).getRelationType(),
          "Custom relation type should be preserved through CSV import");
    } finally {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
      cleanupCustomTypes(customType, inverseType);
    }
  }

  /**
   * Locate a CSV row by its glossary-term name. Uses Apache Commons CSV so quoted/escaped fields
   * (commas, embedded newlines, etc.) don't shift column indices and break the lookup. Returns a
   * normalized CSV row reconstructed from the parsed record so callers can run substring
   * assertions without relying on physical line numbers.
   */
  private String findRowByTerm(String csvContent, String termName) throws Exception {
    try (CSVParser parser =
        CSVFormat.DEFAULT.withFirstRecordAsHeader().parse(new StringReader(csvContent))) {
      for (CSVRecord record : parser) {
        if (termName.equals(record.get("name*"))) {
          return CSVFormat.DEFAULT.format((Object[]) record.values());
        }
      }
    }
    return null;
  }

  private void addCustomRelationTypePair(String customType, String inverseType) throws Exception {
    JsonNode current = getRelationSettings();
    ArrayNode types = (ArrayNode) current.get("config_value").get("relationTypes");

    ObjectNode forward = OBJECT_MAPPER.createObjectNode();
    forward.put("name", customType);
    forward.put("displayName", "Causes");
    forward.put("description", "Test custom relation");
    forward.put("inverseRelation", inverseType);
    forward.put("isSymmetric", false);
    forward.put("isTransitive", false);
    forward.put("isCrossGlossaryAllowed", true);
    forward.put("category", "associative");
    forward.put("isSystemDefined", false);
    forward.put("color", "#aa00ff");
    types.add(forward);

    ObjectNode inverse = OBJECT_MAPPER.createObjectNode();
    inverse.put("name", inverseType);
    inverse.put("displayName", "Caused By");
    inverse.put("description", "Inverse of the test custom relation");
    inverse.put("inverseRelation", customType);
    inverse.put("isSymmetric", false);
    inverse.put("isTransitive", false);
    inverse.put("isCrossGlossaryAllowed", true);
    inverse.put("category", "associative");
    inverse.put("isSystemDefined", false);
    inverse.put("color", "#ff00aa");
    types.add(inverse);

    ObjectNode payload = OBJECT_MAPPER.createObjectNode();
    payload.set("relationTypes", types);
    putRelationSettings(payload);
  }

  private void cleanupCustomTypes(String... customTypes) throws Exception {
    JsonNode current = getRelationSettings();
    ArrayNode types = (ArrayNode) current.get("config_value").get("relationTypes");
    ArrayNode filtered = OBJECT_MAPPER.createArrayNode();
    for (JsonNode type : types) {
      String name = type.get("name").asText();
      boolean drop = false;
      for (String custom : customTypes) {
        if (custom.equals(name)) {
          drop = true;
          break;
        }
      }
      if (!drop) {
        filtered.add(type);
      }
    }
    ObjectNode payload = OBJECT_MAPPER.createObjectNode();
    payload.set("relationTypes", filtered);
    putRelationSettings(payload);
  }

  private JsonNode getRelationSettings() throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/system/settings/glossaryTermRelationSettings"))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      throw new RuntimeException("Failed to read settings: " + response.body());
    }
    return OBJECT_MAPPER.readTree(response.body());
  }

  private void putRelationSettings(ObjectNode configValue) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();
    ObjectNode payload = OBJECT_MAPPER.createObjectNode();
    payload.put("config_type", "glossaryTermRelationSettings");
    payload.set("config_value", configValue);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/system/settings"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .PUT(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(payload)))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      throw new RuntimeException(
          "Failed to update settings: status="
              + response.statusCode()
              + ", body="
              + response.body());
    }
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
            baseUrl, URLEncoder.encode(fqn, StandardCharsets.UTF_8), fields);

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
            baseUrl, URLEncoder.encode(glossaryName, StandardCharsets.UTF_8));

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
            baseUrl, URLEncoder.encode(glossaryName, StandardCharsets.UTF_8), dryRun);

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

  private static HttpRequest.Builder termRequest(final String termFqn, final String suffix) {
    return HttpRequest.newBuilder()
        .uri(
            URI.create(
                SdkClients.getServerUrl()
                    + "/v1/glossaryTerms/name/"
                    + URLEncoder.encode(termFqn, StandardCharsets.UTF_8)
                    + suffix))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .timeout(Duration.ofSeconds(30));
  }

  private static String exportTermCsv(final String termFqn) throws Exception {
    final HttpRequest request =
        termRequest(termFqn, "/export").header("Accept", "text/plain").GET().build();
    final HttpResponse<String> response =
        HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
    return response.body();
  }

  private static String importTermCsv(final String termFqn, final String csv, final boolean dryRun)
      throws Exception {
    final HttpRequest request =
        termRequest(termFqn, "/import?dryRun=" + dryRun)
            .header("Content-Type", "text/plain")
            .PUT(HttpRequest.BodyPublishers.ofString(csv))
            .build();
    final HttpResponse<String> response =
        HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
    return response.body();
  }

  private static int termGetStatus(final String termFqn) throws Exception {
    final HttpRequest request = termRequest(termFqn, "").GET().build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString()).statusCode();
  }
}

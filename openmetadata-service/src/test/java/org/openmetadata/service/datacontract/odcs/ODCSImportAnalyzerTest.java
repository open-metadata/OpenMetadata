/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.datacontract.odcs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.ContractValidation;
import org.openmetadata.schema.entity.datacontract.SchemaValidation;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssue;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueSeverity;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportReport;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRuleOutcome;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;

class ODCSImportAnalyzerTest {
  private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());
  private static final EntityReference TABLE =
      new EntityReference().withId(UUID.randomUUID()).withType("table");
  private static final String DOCUMENT =
      """
      apiVersion: v3.1.0
      kind: DataContract
      id: 4f5b0c52-9f1e-4e89-a6a4-0e0b7a3a1c11
      name: accounts
      version: 1.0.0
      status: active
      schema:
        - name: accounts
          logicalType: object
          quality:
            - name: Not empty
              metric: rowCount
              mustBeGreaterThan: 0
          properties:
            - name: region
              businessName: Region
              logicalType: string
              quality:
                - name: Known region
                  rule: validValues
                  validValues: [north, south]
      quality:
        - name: Steward review
          type: text
      """;

  @Test
  void reportSaysWhatEachRuleBecomesAndWhatIsLeftOut() throws JsonProcessingException {
    ODCSImportReport report =
        analyze(DOCUMENT, options(true, true), passing()).getOdcsImportReport();

    assertTrue(report.getCanImport());
    assertEquals("v3.1.0", report.getOdcsVersion());
    assertEquals(
        List.of(
            ODCSQualityRuleOutcome.Outcome.NOT_EXECUTED,
            ODCSQualityRuleOutcome.Outcome.TEST_CASE,
            ODCSQualityRuleOutcome.Outcome.TEST_CASE),
        report.getQualityRules().stream().map(ODCSQualityRuleOutcome::getOutcome).toList());
    assertEquals("odcs_known_region", report.getQualityRules().get(2).getTestCaseName());
    assertTrue(fields(report).contains("businessName"));
  }

  @Test
  void schemaMismatchesFromContractValidationBlockTheImport() throws JsonProcessingException {
    ContractValidation failing =
        new ContractValidation()
            .withValid(false)
            .withConstraintErrors(
                List.of(
                    DataContractRepository.SCHEMA_VALIDATION_FAILED
                        + " The following fields specified in the data contract do not exist"
                        + " in the table: region"))
            .withSchemaValidation(new SchemaValidation().withFailedFields(List.of("region")));

    ContractValidation validation = analyze(DOCUMENT, options(true, true), contract -> failing);

    assertFalse(validation.getValid());
    List<ODCSImportIssue> blocking =
        validation.getOdcsImportReport().getIssues().stream()
            .filter(issue -> issue.getSeverity() == ODCSImportIssueSeverity.BLOCKING)
            .toList();
    assertEquals(1, blocking.size());
    assertEquals("region", blocking.getFirst().getField());
  }

  @Test
  void documentThatCannotBeReadIsBlockedWithoutConversion() throws JsonProcessingException {
    ContractValidation validation =
        analyze(DOCUMENT.replace("v3.1.0", "v9.0.0"), options(true, true), passing());

    assertFalse(validation.getValid());
    assertFalse(validation.getOdcsImportReport().getCanImport());
    assertTrue(validation.getOdcsImportReport().getQualityRules().isEmpty());
  }

  @Test
  void withTestCasesTurnedOffNoRuleRuns() throws JsonProcessingException {
    ODCSImportReport report =
        analyze(DOCUMENT, options(false, true), passing()).getOdcsImportReport();

    assertTrue(
        report.getQualityRules().stream()
            .allMatch(rule -> rule.getOutcome() == ODCSQualityRuleOutcome.Outcome.NOT_EXECUTED));
  }

  @Test
  void callerWithoutTestPermissionIsWarnedAndNoRuleRuns() throws JsonProcessingException {
    ODCSImportReport report =
        analyze(DOCUMENT, options(true, false), passing()).getOdcsImportReport();

    assertFalse(report.getCanCreateTestCases());
    assertTrue(report.getCanImport());
    assertTrue(fields(report).contains("quality"));
    assertTrue(
        report.getQualityRules().stream()
            .allMatch(rule -> rule.getOutcome() == ODCSQualityRuleOutcome.Outcome.NOT_EXECUTED));
  }

  @Test
  void contractValidationErrorsAreBlockingAndTypeMismatchesAreWarnings()
      throws JsonProcessingException {
    ContractValidation validation =
        new ContractValidation()
            .withValid(false)
            .withEntityErrors(List.of("name must match pattern"))
            .withConstraintErrors(List.of("Entity type 'topic' is not supported"))
            .withSchemaValidation(
                new SchemaValidation()
                    .withDuplicateFields(List.of("region"))
                    .withTypeMismatchFields(List.of("region: expected INT, got STRING")));

    ODCSImportReport report =
        analyze(DOCUMENT, options(true, true), contract -> validation).getOdcsImportReport();

    List<String> blocking =
        report.getIssues().stream()
            .filter(issue -> issue.getSeverity() == ODCSImportIssueSeverity.BLOCKING)
            .map(ODCSImportIssue::getMessage)
            .toList();
    assertEquals(3, blocking.size());
    assertTrue(blocking.getLast().contains("appears more than once"));
    assertTrue(
        report.getIssues().stream()
            .anyMatch(
                issue ->
                    issue.getSeverity() == ODCSImportIssueSeverity.WARNING
                        && issue.getMessage().contains("expected INT")));
  }

  @Test
  void freshnessRuleIsReportedAsSettingTheSla() throws JsonProcessingException {
    String withFreshness =
        DOCUMENT.replace(
            "      - name: Not empty\n",
            """
                  - name: Fresh
                    metric: freshness
                    mustBeLessOrEqualTo: 6
                    unit: hours
                  - name: Not empty
            """);

    ODCSQualityRuleOutcome freshness =
        analyze(withFreshness, options(true, true), passing())
            .getOdcsImportReport()
            .getQualityRules()
            .get(1);

    assertEquals(ODCSQualityRuleOutcome.Outcome.SLA, freshness.getOutcome());
    assertEquals("Sets the contract's refresh frequency to every 6 hours.", freshness.getReason());
  }

  @Test
  void slaElementThatIsNotAColumnIsReported() throws JsonProcessingException {
    String withSla =
        DOCUMENT
            + """
            slaProperties:
              - property: freshness
                value: 1
                unit: d
                element: accounts.loaded_at
            """;

    ODCSImportReport report =
        analyze(withSla, options(true, true), passing()).getOdcsImportReport();

    assertTrue(
        report.getIssues().stream()
            .anyMatch(
                issue ->
                    issue.getSeverity() == ODCSImportIssueSeverity.WARNING
                        && "element".equals(issue.getField())
                        && issue.getMessage().contains("loaded_at")));
  }

  @Test
  void qualityRulesOnlyRunOnTables() throws JsonProcessingException {
    ODCSImportAnalyzer analyzer = new ODCSImportAnalyzer(importer(), passing());
    ODCSImportReport report =
        analyzer
            .analyze(
                new ODCSImportAnalyzer.Request(
                    YAML,
                    YAML.readTree(DOCUMENT),
                    new EntityReference().withId(UUID.randomUUID()).withType("topic"),
                    null,
                    options(true, true)))
            .getOdcsImportReport();

    assertTrue(
        report.getQualityRules().stream()
            .allMatch(rule -> rule.getReason().contains("only on tables")));
  }

  @Test
  void unknownSchemaObjectBlocksTheImport() throws JsonProcessingException {
    ODCSImportAnalyzer analyzer = new ODCSImportAnalyzer(importer(), passing());
    ContractValidation validation =
        analyzer.analyze(
            new ODCSImportAnalyzer.Request(
                YAML, YAML.readTree(DOCUMENT), TABLE, "missing", options(true, true)));

    assertFalse(validation.getValid());
    assertTrue(
        validation.getOdcsImportReport().getIssues().getFirst().getMessage().contains("missing"));
  }

  private static ContractValidation analyze(
      String yaml,
      ODCSImportAnalyzer.QualityRuleOptions options,
      Function<DataContract, ContractValidation> validator)
      throws JsonProcessingException {
    ODCSImportAnalyzer analyzer = new ODCSImportAnalyzer(importer(), validator);
    return analyzer.analyze(
        new ODCSImportAnalyzer.Request(YAML, YAML.readTree(yaml), TABLE, null, options));
  }

  private static ODCSImportAnalyzer.QualityRuleOptions options(
      boolean createTestCases, boolean canCreateTestCases) {
    return new ODCSImportAnalyzer.QualityRuleOptions(
        createTestCases, canCreateTestCases, Set.of(), "admin");
  }

  private static Function<DataContract, ContractValidation> passing() {
    return contract -> new ContractValidation().withValid(true);
  }

  private static List<String> fields(ODCSImportReport report) {
    return report.getIssues().stream().map(ODCSImportIssue::getField).toList();
  }

  /** A repository with no test cases stands in for the database. */
  private static ODCSQualityRuleImporter importer() {
    TestCaseRepository repository = mock(TestCaseRepository.class);
    when(repository.getByNameOrNull(any(), anyString(), any(), any(), anyBoolean()))
        .thenReturn(Optional.empty());
    doAnswer(
            invocation -> {
              TestCase testCase = invocation.getArgument(0);
              testCase.setFullyQualifiedName(testCase.getEntityFQN() + "." + testCase.getName());
              return null;
            })
        .when(repository)
        .setFullyQualifiedName(any(TestCase.class));
    Table table =
        new Table()
            .withFullyQualifiedName("svc.db.sch.accounts")
            .withColumns(
                List.of(new Column().withName("region").withDataType(ColumnDataType.STRING)));
    return new ODCSQualityRuleImporter(new ODCSTestCaseMaterializer(repository), ref -> table);
  }
}

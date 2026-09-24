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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.datacontract.ContractValidation;
import org.openmetadata.schema.entity.datacontract.SchemaValidation;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportReport;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRuleOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.SlaOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.UnsupportedOutcome;
import org.openmetadata.service.jdbi3.DataContractRepository;

/**
 * Assembles the import report: the findings about the document, the result of validating the
 * converted contract against its table, and what each quality rule becomes. Contract validation
 * failures are folded in as blocking issues so the report alone says whether the import can go
 * ahead.
 */
final class ODCSImportReportBuilder {
  private static final String SCHEMA = "schema";

  /** What the report is built from. */
  record Inputs(
      String odcsVersion,
      ODCSImportIssues issues,
      ContractValidation validation,
      List<ODCSRuleOutcome> ruleOutcomes,
      boolean canCreateTestCases) {}

  private ODCSImportReportBuilder() {}

  static ODCSImportReport build(Inputs inputs) {
    ODCSImportIssues issues = inputs.issues();
    addValidationIssues(inputs.validation(), issues);
    return new ODCSImportReport()
        .withOdcsVersion(inputs.odcsVersion())
        .withCanImport(!issues.hasBlocking())
        .withCanCreateTestCases(inputs.canCreateTestCases())
        .withIssues(issues.toList())
        .withQualityRules(
            inputs.ruleOutcomes().stream().map(ODCSImportReportBuilder::toReportOutcome).toList());
  }

  private static void addValidationIssues(ContractValidation validation, ODCSImportIssues issues) {
    if (validation != null) {
      listOrEmpty(validation.getEntityErrors())
          .forEach(error -> issues.blocking(ODCSImportIssueCategory.DOCUMENT, null, "", error));
      listOrEmpty(validation.getConstraintErrors()).stream()
          .filter(error -> !isReportedPerColumn(error, validation.getSchemaValidation()))
          .forEach(error -> issues.blocking(ODCSImportIssueCategory.DOCUMENT, null, "", error));
      addSchemaIssues(validation.getSchemaValidation(), issues);
    }
  }

  /** The schema failure summarises the columns that {@link #addSchemaIssues} lists one by one. */
  private static boolean isReportedPerColumn(String error, SchemaValidation schema) {
    return error.startsWith(DataContractRepository.SCHEMA_VALIDATION_FAILED)
        && schema != null
        && !(nullOrEmpty(schema.getFailedFields()) && nullOrEmpty(schema.getDuplicateFields()));
  }

  private static void addSchemaIssues(SchemaValidation schema, ODCSImportIssues issues) {
    if (schema != null) {
      listOrEmpty(schema.getFailedFields())
          .forEach(
              column ->
                  issues.blocking(
                      ODCSImportIssueCategory.SCHEMA,
                      column,
                      SCHEMA,
                      String.format(
                          "Column `%s` is in the contract but not in the table.", column)));
      listOrEmpty(schema.getDuplicateFields())
          .forEach(
              column ->
                  issues.blocking(
                      ODCSImportIssueCategory.SCHEMA,
                      column,
                      SCHEMA,
                      String.format(
                          "Column `%s` appears more than once in the contract.", column)));
      listOrEmpty(schema.getTypeMismatchFields())
          .forEach(
              mismatch ->
                  issues.warning(
                      ODCSImportIssueCategory.SCHEMA,
                      null,
                      SCHEMA,
                      String.format("Column types differ from the table (%s).", mismatch)));
    }
  }

  private static String describe(RefreshFrequency frequency) {
    String unit = frequency.getUnit().value();
    return frequency.getInterval() == 1 ? unit : frequency.getInterval() + " " + unit + "s";
  }

  private static ODCSQualityRuleOutcome toReportOutcome(ODCSRuleOutcome outcome) {
    ODCSQualityRuleOutcome reported =
        new ODCSQualityRuleOutcome()
            .withName(outcome.rule().getName())
            .withColumn(outcome.rule().getColumn());
    return switch (outcome) {
      case TestCaseOutcome testCase -> reported
          .withOutcome(ODCSQualityRuleOutcome.Outcome.TEST_CASE)
          .withTestDefinition(testCase.testCase().getTestDefinition())
          .withTestCaseName(testCase.testCase().getName());
      case SlaOutcome sla -> reported
          .withOutcome(ODCSQualityRuleOutcome.Outcome.SLA)
          .withReason(
              "Sets the contract's refresh frequency to every "
                  + describe(sla.refreshFrequency())
                  + ".");
      case UnsupportedOutcome unsupported -> reported
          .withOutcome(ODCSQualityRuleOutcome.Outcome.NOT_EXECUTED)
          .withReason(unsupported.reason());
    };
  }
}

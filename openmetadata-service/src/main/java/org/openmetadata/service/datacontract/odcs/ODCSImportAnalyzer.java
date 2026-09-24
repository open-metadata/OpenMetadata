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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.ContractValidation;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.UnsupportedOutcome;
import org.openmetadata.service.util.ODCSConverter;

/**
 * Previews an ODCS import without writing anything: what the document becomes, what it loses, and
 * whether anything blocks it. The result is the contract validation the import endpoints already
 * return, with the import report attached.
 */
public final class ODCSImportAnalyzer {
  private static final String QUALITY = "quality";
  private static final String SLA_ELEMENT = "element";
  private static final String SLA_PROPERTIES = "slaProperties";
  private static final String TEST_CASES_OFF = "Test case creation is turned off for this import.";
  private static final String TABLES_ONLY = "Quality rules run as test cases only on tables.";
  private static final String NO_PERMISSION =
      "You do not have permission to create test cases on this table.";

  /** How quality rules would be imported. */
  public record QualityRuleOptions(
      boolean createTestCases,
      boolean canCreateTestCases,
      Set<UUID> ownedTestCaseIds,
      String user) {}

  /** The document to analyze and where it would be imported. */
  public record Request(
      ObjectMapper mapper,
      JsonNode document,
      EntityReference entity,
      String objectName,
      QualityRuleOptions quality) {}

  private final ODCSQualityRuleImporter qualityRules;
  private final Function<DataContract, ContractValidation> contractValidator;

  public ODCSImportAnalyzer(
      ODCSQualityRuleImporter qualityRules,
      Function<DataContract, ContractValidation> contractValidator) {
    this.qualityRules = qualityRules;
    this.contractValidator = contractValidator;
  }

  public ContractValidation analyze(Request request) {
    ODCSImportIssues issues = new ODCSImportIssues();
    JsonNode original = request.document().deepCopy();
    Optional<ODCSDataContract> odcs =
        ODCSLenientReader.read(request.mapper(), request.document(), issues);
    ContractValidation validation = new ContractValidation().withValid(false);
    List<ODCSRuleOutcome> outcomes = List.of();
    Optional<DataContract> contract =
        odcs.flatMap(document -> convert(document, original, request, issues));
    if (contract.isPresent()) {
      resolveSlaColumn(contract.get(), issues);
      validation = contractValidator.apply(contract.get());
      outcomes = qualityRuleOutcomes(contract.get(), request, issues);
    }
    return withReport(
        validation,
        odcs.map(document -> document.getApiVersion().value()),
        issues,
        outcomes,
        request);
  }

  private static Optional<DataContract> convert(
      ODCSDataContract odcs, JsonNode original, Request request, ODCSImportIssues issues) {
    Optional<DataContract> contract = Optional.empty();
    try {
      String importedObject =
          ODCSConverter.importedSchemaObjectName(odcs, request.entity(), request.objectName())
              .orElse(null);
      ODCSFieldCoverage.report(original, importedObject, issues);
      contract =
          Optional.of(ODCSConverter.fromODCS(odcs, request.entity(), request.objectName(), issues));
    } catch (IllegalArgumentException e) {
      issues.blocking(ODCSImportIssueCategory.SCHEMA, null, "schema", e.getMessage());
    }
    return contract;
  }

  private void resolveSlaColumn(DataContract contract, ODCSImportIssues issues) {
    String column = contract.getSla() == null ? null : contract.getSla().getColumnName();
    if (qualityRules.resolveSlaColumn(contract)) {
      issues.warning(
          ODCSImportIssueCategory.SLA,
          SLA_ELEMENT,
          SLA_PROPERTIES,
          String.format(
              "SLA element `%s` is not a column of this table, so it is not imported.", column));
    }
  }

  private List<ODCSRuleOutcome> qualityRuleOutcomes(
      DataContract contract, Request request, ODCSImportIssues issues) {
    QualityRuleOptions options = request.quality();
    List<ODCSRuleOutcome> outcomes;
    if (!options.createTestCases()) {
      outcomes = notExecuted(contract, TEST_CASES_OFF);
    } else if (!Entity.TABLE.equals(contract.getEntity().getType())) {
      outcomes = notExecuted(contract, TABLES_ONLY);
    } else if (!options.canCreateTestCases()) {
      outcomes = notExecuted(contract, NO_PERMISSION);
      warnNoPermission(contract, issues);
    } else {
      outcomes =
          qualityRules.preview(
              new ODCSQualityRuleImporter.Request(
                  contract,
                  options.ownedTestCaseIds(),
                  (testCase, overwrites) -> {},
                  options.user()));
    }
    return outcomes;
  }

  private static List<ODCSRuleOutcome> notExecuted(DataContract contract, String reason) {
    return listOrEmpty(contract.getOdcsQualityRules()).stream()
        .<ODCSRuleOutcome>map(rule -> new UnsupportedOutcome(rule, reason))
        .toList();
  }

  private static void warnNoPermission(DataContract contract, ODCSImportIssues issues) {
    if (!listOrEmpty(contract.getOdcsQualityRules()).isEmpty()) {
      issues.warning(
          ODCSImportIssueCategory.QUALITY,
          QUALITY,
          QUALITY,
          NO_PERMISSION + " The rules are kept with the contract but do not run.");
    }
  }

  private static ContractValidation withReport(
      ContractValidation validation,
      Optional<String> odcsVersion,
      ODCSImportIssues issues,
      List<ODCSRuleOutcome> outcomes,
      Request request) {
    validation.setOdcsImportReport(
        ODCSImportReportBuilder.build(
            new ODCSImportReportBuilder.Inputs(
                odcsVersion.orElse(null),
                issues,
                validation,
                outcomes,
                request.quality().canCreateTestCases())));
    validation.setValid(validation.getOdcsImportReport().getCanImport());
    return validation;
  }
}

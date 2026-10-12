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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSTestCaseBuilder.RuleOnTarget;

/**
 * OpenMetadata tests that ODCS has no metric for travel as {@code type: custom} rules for the {@code
 * openmetadata} engine, whose implementation is the test itself. Exporting a contract and importing
 * the file again therefore recreates exactly the same test.
 */
@Slf4j
final class ODCSOpenMetadataRules {

  /** The implementation block of an {@code openmetadata} rule. */
  @JsonIgnoreProperties(ignoreUnknown = true)
  @JsonInclude(JsonInclude.Include.NON_NULL)
  record Implementation(
      String name, String testDefinition, List<TestCaseParameterValue> parameterValues) {}

  private ODCSOpenMetadataRules() {}

  static String implementation(
      String name, String testDefinition, List<TestCaseParameterValue> parameterValues) {
    return JsonUtils.pojoToJson(new Implementation(name, testDefinition, parameterValues));
  }

  static ODCSRuleOutcome toTestCase(RuleOnTarget ruleOnTarget) {
    ODCSQualityRule rule = ruleOnTarget.rule();
    return read(rule.getImplementation())
        .<ODCSRuleOutcome>map(
            implementation -> {
              TestCaseOutcome outcome =
                  ODCSTestCaseBuilder.testCase(
                      ruleOnTarget,
                      implementation.testDefinition(),
                      ruleOnTarget.columnOrTableLink(),
                      listOrEmpty(implementation.parameterValues()));
              outcome.testCase().setName(implementation.name());
              return outcome;
            })
        .orElseGet(
            () ->
                ODCSTestCaseBuilder.unsupported(
                    rule,
                    "Its implementation is not an OpenMetadata test "
                        + "(expected JSON with a testDefinition)."));
  }

  private static Optional<Implementation> read(String implementation) {
    Optional<Implementation> parsed = Optional.empty();
    if (!nullOrEmpty(implementation)) {
      try {
        parsed = Optional.ofNullable(JsonUtils.readValue(implementation, Implementation.class));
      } catch (JsonParsingException e) {
        LOG.debug("ODCS openmetadata rule implementation is not a test: {}", e.getMessage());
      }
    }
    return parsed.filter(candidate -> !nullOrEmpty(candidate.testDefinition()));
  }
}

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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;

/**
 * Names the test cases created from ODCS rules. Names are derived only from the rules, so importing
 * the same contract again yields the same names and updates the test cases it created last time
 * instead of adding new ones. One instance names the rules of one import: two rules that would share
 * a name on the same table or column are told apart with a numeric suffix.
 */
final class ODCSTestCaseNames {
  static final String GENERATED_PREFIX = "odcs_";

  private static final Pattern NOT_NAME_SAFE = Pattern.compile("[^a-z0-9]+");
  private static final Pattern INVALID_TEST_CASE_NAME = Pattern.compile("::|[>\"\\x00-\\x1f]");
  private static final int MAX_SLUG_LENGTH = 120;

  private final Map<String, Set<String>> namesByEntityLink = new HashMap<>();

  ODCSRuleOutcome assign(ODCSRuleOutcome outcome) {
    if (outcome instanceof TestCaseOutcome testCaseOutcome) {
      CreateTestCase testCase = testCaseOutcome.testCase();
      testCase.setName(unique(testCase.getEntityLink(), baseName(testCaseOutcome)));
    }
    return outcome;
  }

  /**
   * Preference order: the name an exported OpenMetadata test already had, then the rule's stable
   * ODCS {@code id}, then a slug of the rule's name.
   */
  private static String baseName(TestCaseOutcome outcome) {
    ODCSQualityRule rule = outcome.rule();
    String presetName = outcome.testCase().getName();
    String name;
    if (isUsableName(presetName)) {
      name = presetName;
    } else if (isUsableName(rule.getId())) {
      name = rule.getId();
    } else {
      name = GENERATED_PREFIX + slug(describingText(rule));
    }
    return name;
  }

  private String unique(String entityLink, String baseName) {
    Set<String> taken = namesByEntityLink.computeIfAbsent(entityLink, link -> new HashSet<>());
    String candidate = baseName;
    for (int suffix = 2; taken.contains(candidate.toLowerCase(Locale.ROOT)); suffix++) {
      candidate = baseName + "_" + suffix;
    }
    taken.add(candidate.toLowerCase(Locale.ROOT));
    return candidate;
  }

  private static boolean isUsableName(String name) {
    return !nullOrEmpty(name) && !name.isBlank() && !INVALID_TEST_CASE_NAME.matcher(name).find();
  }

  private static String describingText(ODCSQualityRule rule) {
    return Stream.of(rule.getName(), ODCSRuleKind.metricName(rule), typeName(rule))
        .filter(text -> !nullOrEmpty(text))
        .findFirst()
        .orElse("rule");
  }

  private static String typeName(ODCSQualityRule rule) {
    return rule.getType() == null ? null : rule.getType().value();
  }

  private static String slug(String text) {
    String slug =
        NOT_NAME_SAFE
            .matcher(text.toLowerCase(Locale.ROOT))
            .replaceAll("_")
            .replaceAll("^_|_$", "");
    String bounded = slug.length() > MAX_SLUG_LENGTH ? slug.substring(0, MAX_SLUG_LENGTH) : slug;
    return bounded.isEmpty() ? "rule" : bounded;
  }
}

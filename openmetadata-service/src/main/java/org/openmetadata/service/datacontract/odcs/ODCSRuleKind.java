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

import static java.util.Map.entry;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

/**
 * The OpenMetadata check an ODCS rule corresponds to. Library rules are recognised by their ODCS 3.1.0
 * {@code metric}, or by the ODCS 3.0.x {@code rule} name that preceded it, including a few names
 * contracts commonly use although no ODCS version standardised them ({@code textLength},
 * {@code valuesBetween}).
 */
enum ODCSRuleKind {
  NULL_VALUES(Scope.COLUMN),
  COMPLETENESS(Scope.COLUMN),
  VALID_VALUES(Scope.COLUMN),
  PATTERN(Scope.COLUMN),
  DUPLICATE_VALUES(Scope.COLUMN),
  MISSING_VALUES(Scope.COLUMN),
  TEXT_LENGTH(Scope.COLUMN),
  VALUE_RANGE(Scope.COLUMN),
  ROW_COUNT(Scope.TABLE),
  SQL(Scope.TABLE),
  FRESHNESS(Scope.TABLE),
  OPENMETADATA_TEST(Scope.TABLE),
  UNSUPPORTED(Scope.TABLE);

  enum Scope {
    COLUMN,
    TABLE
  }

  static final String OPENMETADATA_ENGINE = "openmetadata";
  private static final String INVALID_VALUES_METRIC = "invalidvalues";
  private static final String NOT_NULL_RULE = "notnull";

  private static final Map<String, ODCSRuleKind> LIBRARY_METRICS =
      Map.ofEntries(
          entry("nullvalues", NULL_VALUES),
          entry("nullcount", NULL_VALUES),
          entry("completeness", COMPLETENESS),
          entry("validvalues", VALID_VALUES),
          entry("regex", PATTERN),
          entry("pattern", PATTERN),
          entry("duplicatevalues", DUPLICATE_VALUES),
          entry("duplicatecount", DUPLICATE_VALUES),
          entry("missingvalues", MISSING_VALUES),
          entry("missingcount", MISSING_VALUES),
          entry("textlength", TEXT_LENGTH),
          entry("valuesbetween", VALUE_RANGE),
          entry("rowcount", ROW_COUNT),
          entry("freshness", FRESHNESS));

  /** The argument a kind's test is built from, named as the rule would carry it. */
  private static final Map<ODCSRuleKind, String> REQUIRED_ARGUMENTS =
      Map.of(PATTERN, "pattern", VALID_VALUES, "validValues");

  private final Scope scope;

  ODCSRuleKind(Scope scope) {
    this.scope = scope;
  }

  boolean needsColumn() {
    return scope == Scope.COLUMN;
  }

  static ODCSRuleKind of(ODCSQualityRule rule) {
    return switch (typeOf(rule)) {
      case SQL -> SQL;
      case CUSTOM -> isOpenMetadataEngine(rule) ? OPENMETADATA_TEST : UNSUPPORTED;
      case TEXT -> UNSUPPORTED;
      case LIBRARY -> ofLibraryMetric(rule);
    };
  }

  static String unsupportedReason(ODCSQualityRule rule) {
    return switch (typeOf(rule)) {
      case TEXT -> "It is a text rule: a prose expectation with nothing for OpenMetadata to run.";
      case CUSTOM -> String.format(
          "It is written for the '%s' engine, which runs outside OpenMetadata.",
          nullOrEmpty(rule.getEngine()) ? "unspecified" : rule.getEngine());
      case SQL, LIBRARY -> unsupportedLibraryReason(rule);
    };
  }

  static String metricName(ODCSQualityRule rule) {
    return rule.getMetric() != null ? rule.getMetric().value() : rule.getRule();
  }

  private static String unsupportedLibraryReason(ODCSQualityRule rule) {
    String metric = metricName(rule);
    String reason;
    if (nullOrEmpty(metric)) {
      reason = "The rule names no metric.";
    } else if (INVALID_VALUES_METRIC.equals(normalized(metric))) {
      reason = "An invalidValues rule needs a validValues or a pattern argument.";
    } else {
      reason =
          requiredArgument(metric)
              .map(argument -> String.format("A '%s' rule needs a %s argument.", metric, argument))
              .orElseGet(
                  () -> String.format("Metric '%s' has no OpenMetadata test equivalent.", metric));
    }
    return reason;
  }

  private static Optional<String> requiredArgument(String metric) {
    return Optional.ofNullable(LIBRARY_METRICS.get(normalized(metric)))
        .map(REQUIRED_ARGUMENTS::get);
  }

  private static ODCSRuleKind ofLibraryMetric(ODCSQualityRule rule) {
    String metric = normalized(metricName(rule));
    ODCSRuleKind kind =
        switch (metric) {
          case INVALID_VALUES_METRIC -> ofInvalidValues(rule);
          case NOT_NULL_RULE -> ODCSRuleOperators.hasLowerBound(rule) ? COMPLETENESS : NULL_VALUES;
          default -> LIBRARY_METRICS.getOrDefault(metric, UNSUPPORTED);
        };
    return kind.hasRequiredArgument(rule) ? kind : UNSUPPORTED;
  }

  private boolean hasRequiredArgument(ODCSQualityRule rule) {
    return switch (this) {
      case PATTERN -> ODCSRuleArguments.pattern(rule).isPresent();
      case VALID_VALUES -> !ODCSRuleArguments.validValues(rule).isEmpty();
      default -> true;
    };
  }

  private static ODCSRuleKind ofInvalidValues(ODCSQualityRule rule) {
    ODCSRuleKind kind = UNSUPPORTED;
    if (!ODCSRuleArguments.validValues(rule).isEmpty()) {
      kind = VALID_VALUES;
    } else if (ODCSRuleArguments.pattern(rule).isPresent()) {
      kind = PATTERN;
    }
    return kind;
  }

  private static boolean isOpenMetadataEngine(ODCSQualityRule rule) {
    return OPENMETADATA_ENGINE.equalsIgnoreCase(rule.getEngine());
  }

  private static ODCSQualityRule.Type typeOf(ODCSQualityRule rule) {
    return rule.getType() == null ? ODCSQualityRule.Type.LIBRARY : rule.getType();
  }

  private static String normalized(String metric) {
    return metric == null ? "" : metric.toLowerCase(Locale.ROOT);
  }
}

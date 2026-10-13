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

import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

/** What an ODCS quality rule becomes in OpenMetadata. */
public sealed interface ODCSRuleOutcome {

  ODCSQualityRule rule();

  /** The rule runs as an OpenMetadata test case. */
  record TestCaseOutcome(ODCSQualityRule rule, CreateTestCase testCase)
      implements ODCSRuleOutcome {}

  /** The rule is a freshness expectation, which OpenMetadata models on the contract SLA. */
  record SlaOutcome(ODCSQualityRule rule, RefreshFrequency refreshFrequency, String columnName)
      implements ODCSRuleOutcome {}

  /** The rule is kept with the contract for round-tripping but nothing in OpenMetadata runs it. */
  record UnsupportedOutcome(ODCSQualityRule rule, String reason) implements ODCSRuleOutcome {}
}

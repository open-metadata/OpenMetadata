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

import java.util.List;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

/**
 * Decides, for each ODCS quality rule of a contract, what it becomes in OpenMetadata: a test case on the
 * table or one of its columns, the contract's refresh-frequency SLA, or nothing that runs. Pure:
 * it only describes the test cases, {@link ODCSTestCaseMaterializer} creates them.
 */
public final class ODCSQualityRuleMapper {

  private ODCSQualityRuleMapper() {}

  /** Outcomes in the same order as {@code rules}. */
  public static List<ODCSRuleOutcome> map(List<ODCSQualityRule> rules, ODCSTableTarget target) {
    ODCSTestCaseNames names = new ODCSTestCaseNames();
    return listOrEmpty(rules).stream()
        .map(rule -> names.assign(ODCSTestCaseBuilder.build(rule, target)))
        .toList();
  }
}

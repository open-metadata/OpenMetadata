/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.security.policyevaluator;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Condition;
import org.jeasy.rules.api.Facts;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.type.MetadataOperation;

@Slf4j
class RuleCondition implements Condition {

  private final Rule rule;

  public RuleCondition(Rule rule) {
    this.rule = rule;
  }

  @Override
  public boolean evaluate(Facts facts) {
    // Check against operation and each of the entity and user attributes.
    if (facts.get(CommonFields.CHECK_OPERATION)) {
      MetadataOperation operation = facts.get(CommonFields.OPERATION);
      if (!operation.equals(rule.getOperation())) {
        return false;
      }
    }

    List<String> entityTags = facts.get(CommonFields.ENTITY_TAGS);
    if (rule.getEntityTagAttr() != null && !entityTags.contains(rule.getEntityTagAttr())) {
      return false;
    }

    String entityType = facts.get(CommonFields.ENTITY_TYPE);
    return rule.getEntityTypeAttr() == null || entityType.equals(rule.getEntityTypeAttr());
  }
}

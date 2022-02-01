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

import java.util.Set;
import org.jeasy.rules.api.Action;
import org.jeasy.rules.api.Facts;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.type.MetadataOperation;

class SetAllowedOperationAction implements Action {

  private final Rule rule;

  public SetAllowedOperationAction(Rule rule) {
    this.rule = rule;
  }

  @Override
  public void execute(Facts facts) throws Exception {
    if (Boolean.FALSE.equals(rule.getAllow())) {
      return;
    }

    Set<MetadataOperation> operations = facts.get(CommonFields.ALLOWED_OPERATIONS);
    operations.add(rule.getOperation());
  }
}

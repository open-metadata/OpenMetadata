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

package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;

/** Checks on the rules an alert is stored with, whoever wrote them. */
final class StoredRules {

  private StoredRules() {}

  // Rules written by hand name the one resource they were written for.
  static void requireOneResource(FilteringRules rules) {
    if (rules == null || listOrEmpty(rules.getResources()).size() != 1) {
      throw new BadRequestException(
          "One resource can be specified. Zero or Multiple resources are not supported.");
    }
  }

  static void requireOneResourceWhenChanged(FilteringRules stored, FilteringRules sent) {
    List<String> storedResources = stored == null ? null : stored.getResources();
    List<String> sentResources = sent == null ? null : sent.getResources();
    if (!Objects.equals(storedResources, sentResources)) {
      requireOneResource(sent);
    }
  }

  static void fillAbsentLists(EventSubscription alert) {
    FilteringRules rules = alert.getFilteringRules();
    if (rules != null && rules.getRules() == null) {
      rules.setRules(new ArrayList<>());
    }
    if (rules != null && rules.getActions() == null) {
      rules.setActions(new ArrayList<>());
    }
  }

  // Each condition, and the one they combine into, so a bad combination is caught on save and
  // not when it is first compiled at runtime.
  static void validate(EventSubscription alert) {
    if (alert.getFilteringRules() != null) {
      List<EventFilterRule> rules = alert.getFilteringRules().getRules();
      for (EventFilterRule rule : rules) {
        AlertUtil.validateExpression(rule.getCondition(), Boolean.class);
      }
      rules.sort(Comparator.comparing(EventFilterRule::getName));
      if (!rules.isEmpty()) {
        AlertUtil.validateExpression(AlertUtil.buildCompleteCondition(rules), Boolean.class);
      }
    }
  }
}

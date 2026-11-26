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

package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.governance.workflows.LifecycleTransition;
import org.openmetadata.schema.governance.workflows.LifecycleTransitionApproval;
import org.openmetadata.schema.governance.workflows.LifecycleTransitionTrigger;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The rules a lifecycle's transitions follow, checked when the workflow is saved so a definition
 * written through the API holds the same guarantees as one the editor publishes.
 * ADR:2026-11-16-a-lifecycle-request-triggers-only-lifecycle-playbooks
 */
public final class LifecycleTransitionRules {
  private LifecycleTransitionRules() {}

  /** Why the transitions cannot be saved, one line per problem; empty when they can. */
  public static List<String> problems(List<LifecycleTransition> transitions) {
    List<LifecycleTransition> all = listOrEmpty(transitions);
    List<String> problems = new ArrayList<>();
    for (int index = 0; index < all.size(); index++) {
      problems.addAll(problemsOf(all.get(index), index));
      for (int other = index + 1; other < all.size(); other++) {
        if (overlap(all.get(index), all.get(other))) {
          problems.add(
              "Transitions %d and %d both move assets from the same stage to %s"
                  .formatted(index + 1, other + 1, all.get(index).getTo().value()));
        }
      }
    }
    return problems;
  }

  private static List<String> problemsOf(LifecycleTransition transition, int index) {
    List<String> problems = new ArrayList<>();
    String name = "Transition %d".formatted(index + 1);
    Set<EntityStatus> from = transition.getFrom() == null ? Set.of() : transition.getFrom();
    if (transition.getTo() == EntityStatus.UNPROCESSED || from.contains(EntityStatus.UNPROCESSED)) {
      problems.add("%s moves to or from Unprocessed".formatted(name));
    }
    if (from.contains(transition.getTo())) {
      problems.add("%s moves from the stage it moves to".formatted(name));
    }
    if (Boolean.TRUE.equals(transition.getOnPath())
        && (transition.getTrigger() != LifecycleTransitionTrigger.ON_REQUEST || from.size() != 1)) {
      problems.add("%s is a path step, made on request from one stage".formatted(name));
    }
    if (transition.getTrigger() == LifecycleTransitionTrigger.ON_REQUEST
        && !namesApprovers(transition.getApproval())) {
      problems.add("%s is made on request and names no approvers".formatted(name));
    }
    if (transition.getTrigger() == LifecycleTransitionTrigger.AUTOMATIC
        && nullOrEmpty(transition.getConditions())) {
      problems.add("%s is automatic and has no conditions".formatted(name));
    }
    if (!nullOrEmpty(transition.getConditions()) && !isRuleObject(transition.getConditions())) {
      problems.add("%s has conditions that are not a JSON Logic rule".formatted(name));
    }
    return problems;
  }

  // A transition with no from stages leaves every stage, so it overlaps any other to its target.
  static boolean overlap(LifecycleTransition first, LifecycleTransition second) {
    Set<EntityStatus> firstFrom = first.getFrom() == null ? Set.of() : first.getFrom();
    Set<EntityStatus> secondFrom = second.getFrom() == null ? Set.of() : second.getFrom();
    return first.getTo() == second.getTo()
        && (firstFrom.isEmpty()
            || secondFrom.isEmpty()
            || firstFrom.stream().anyMatch(secondFrom::contains));
  }

  private static boolean namesApprovers(LifecycleTransitionApproval approval) {
    return approval != null
        && !(nullOrEmpty(approval.getAssignees()) && nullOrEmpty(approval.getCandidates()));
  }

  private static boolean isRuleObject(String conditions) {
    boolean isRule;
    try {
      JsonNode rule = JsonUtils.readTree(conditions);
      isRule = rule != null && rule.isObject();
    } catch (JsonParsingException e) {
      isRule = false;
    }
    return isRule;
  }
}

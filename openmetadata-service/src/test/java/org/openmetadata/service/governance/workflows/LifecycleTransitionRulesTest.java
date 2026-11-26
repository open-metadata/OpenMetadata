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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.LifecycleApproverGroup;
import org.openmetadata.schema.governance.workflows.LifecycleTransition;
import org.openmetadata.schema.governance.workflows.LifecycleTransitionApproval;
import org.openmetadata.schema.governance.workflows.LifecycleTransitionTrigger;
import org.openmetadata.schema.type.EntityStatus;

class LifecycleTransitionRulesTest {
  private static final String RETIRED = "{\"==\":[{\"var\":\"description\"},\"retired\"]}";
  private static final LifecycleTransitionApproval OWNERS =
      new LifecycleTransitionApproval().withAssignees(Set.of(LifecycleApproverGroup.OWNERS));

  @Test
  void branchingAndLoopingTransitionsInEveryShapeAreAccepted() {
    List<LifecycleTransition> transitions =
        List.of(
            onRequest(EntityStatus.DEPRECATED),
            onRequest(EntityStatus.REJECTED, EntityStatus.IN_REVIEW).withConditions(RETIRED),
            onRequest(EntityStatus.DRAFT, EntityStatus.REJECTED),
            automatic(EntityStatus.ARCHIVED, EntityStatus.APPROVED).withApproval(OWNERS),
            onRequest(EntityStatus.APPROVED, EntityStatus.IN_REVIEW).withOnPath(true));

    assertEquals(List.of(), LifecycleTransitionRules.problems(transitions));
  }

  @Test
  void aTransitionToOrFromUnprocessedOrFromItsOwnTargetIsRefused() {
    assertProblem(List.of(onRequest(EntityStatus.UNPROCESSED)), "moves to or from Unprocessed");
    assertProblem(
        List.of(onRequest(EntityStatus.DRAFT, EntityStatus.UNPROCESSED)),
        "moves to or from Unprocessed");
    assertProblem(
        List.of(onRequest(EntityStatus.DRAFT, EntityStatus.DRAFT)),
        "moves from the stage it moves to");
  }

  @Test
  void anOnRequestTransitionNamesApproversAndAnAutomaticOneHasConditions() {
    assertProblem(
        List.of(onRequest(EntityStatus.DEPRECATED).withApproval(null)), "names no approvers");
    assertProblem(
        List.of(automatic(EntityStatus.ARCHIVED).withConditions(null)), "has no conditions");
    assertProblem(
        List.of(automatic(EntityStatus.ARCHIVED).withConditions("[1]")), "not a JSON Logic rule");
  }

  @Test
  void aPathStepIsMadeOnRequestFromOneStage() {
    assertProblem(
        List.of(automatic(EntityStatus.APPROVED, EntityStatus.IN_REVIEW).withOnPath(true)),
        "is a path step");
    assertProblem(List.of(onRequest(EntityStatus.APPROVED).withOnPath(true)), "is a path step");
  }

  @Test
  void twoTransitionsThatCouldBothMoveAnAssetToOneStageAreRefused() {
    assertProblem(
        List.of(
            onRequest(EntityStatus.DEPRECATED),
            onRequest(EntityStatus.DEPRECATED, EntityStatus.IN_REVIEW)),
        "Transitions 1 and 2 both move assets from the same stage to Deprecated");
    assertProblem(
        List.of(
            onRequest(EntityStatus.REJECTED, EntityStatus.DRAFT, EntityStatus.IN_REVIEW),
            automatic(EntityStatus.REJECTED, EntityStatus.IN_REVIEW)),
        "both move assets from the same stage to Rejected");
    assertEquals(
        List.of(),
        LifecycleTransitionRules.problems(
            List.of(
                onRequest(EntityStatus.REJECTED, EntityStatus.DRAFT),
                onRequest(EntityStatus.REJECTED, EntityStatus.IN_REVIEW))));
  }

  private static void assertProblem(List<LifecycleTransition> transitions, String expected) {
    List<String> problems = LifecycleTransitionRules.problems(transitions);
    assertTrue(
        problems.stream().anyMatch(problem -> problem.contains(expected)),
        "expected a problem containing '%s', got %s".formatted(expected, problems));
  }

  private static LifecycleTransition onRequest(EntityStatus to, EntityStatus... from) {
    return new LifecycleTransition()
        .withFrom(Set.of(from))
        .withTo(to)
        .withTrigger(LifecycleTransitionTrigger.ON_REQUEST)
        .withApproval(OWNERS);
  }

  private static LifecycleTransition automatic(EntityStatus to, EntityStatus... from) {
    return new LifecycleTransition()
        .withFrom(Set.of(from))
        .withTo(to)
        .withTrigger(LifecycleTransitionTrigger.AUTOMATIC)
        .withConditions(RETIRED);
  }
}

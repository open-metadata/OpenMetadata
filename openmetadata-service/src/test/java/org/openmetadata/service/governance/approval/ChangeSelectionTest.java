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

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.changeRequest.ApprovalDecision;
import org.openmetadata.schema.governance.changeRequest.ChangeRef;
import org.openmetadata.schema.governance.changeRequest.DecisionType;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.MutationOpType;
import org.openmetadata.schema.utils.JsonUtils;

class ChangeSelectionTest {
  private static final String REQUESTER = "ram";
  private static final MutationOp DESCRIPTION =
      new MutationOp().withOp(MutationOpType.SET).withField("description").withValue("\"new\"");
  private static final MutationOp TAG =
      new MutationOp().withOp(MutationOpType.ADD).withField("tags").withKey("PII.Sensitive");
  private static final List<MutationOp> OPS = List.of(DESCRIPTION, TAG);

  private static ApprovalDecision decision(
      String by, DecisionType type, List<ChangeRef> approved, List<ChangeRef> rejected) {
    return new ApprovalDecision()
        .withId(UUID.randomUUID())
        .withDecidedBy(by)
        .withDecision(type)
        .withApprovedChanges(approved)
        .withRejectedChanges(rejected);
  }

  private static ChangeRef ref(MutationOp op) {
    return new ChangeRef().withField(op.getField()).withKey(op.getKey());
  }

  @Test
  void aWholeRevisionApprovalSelectsEveryChange() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS, List.of(decision("karan", DecisionType.APPROVE, null, null)), REQUESTER);
    assertEquals(OPS, selection.approved());
    assertFalse(selection.partial());
  }

  @Test
  void aWholeRevisionRejectionSelectsNothing() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS, List.of(decision("karan", DecisionType.REJECT, null, null)), REQUESTER);
    assertTrue(selection.approved().isEmpty());
    assertEquals(OPS, selection.rejected());
  }

  @Test
  void approvingOneChangeAndRejectingAnotherAppliesOnlyTheFirst() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(
                decision(
                    "karan", DecisionType.APPROVE, List.of(ref(TAG)), List.of(ref(DESCRIPTION)))),
            REQUESTER);
    assertEquals(List.of(TAG), selection.approved());
    assertEquals(List.of(DESCRIPTION), selection.rejected());
    assertTrue(selection.partial());
  }

  @Test
  void aChangeLeftUndecidedIsDiscarded() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(decision("karan", DecisionType.APPROVE, List.of(ref(TAG)), null)),
            REQUESTER);
    assertEquals(List.of(TAG), selection.approved());
    assertEquals(List.of(DESCRIPTION), selection.rejected());
  }

  @Test
  void withTwoApproversOnlyChangesBothApprovedApply() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(
                decision("karan", DecisionType.APPROVE, List.of(ref(TAG)), null),
                decision("admin", DecisionType.APPROVE, null, null)),
            REQUESTER);
    assertEquals(List.of(TAG), selection.approved());
    assertEquals(List.of(DESCRIPTION), selection.rejected());
  }

  @Test
  void aWholeRevisionApprovalSurvivesPersistence() {
    ApprovalDecision original = decision("karan", DecisionType.APPROVE, null, null);
    ApprovalDecision restored =
        JsonUtils.readValue(JsonUtils.pojoToJson(original), ApprovalDecision.class);
    assertEquals(OPS, ChangeSelection.of(OPS, List.of(restored), REQUESTER).approved());
  }

  @Test
  void aPartialApprovalSurvivesPersistence() {
    ApprovalDecision original =
        decision("karan", DecisionType.APPROVE, List.of(ref(TAG)), List.of(ref(DESCRIPTION)));
    ApprovalDecision restored =
        JsonUtils.readValue(JsonUtils.pojoToJson(original), ApprovalDecision.class);
    ChangeSelection selection = ChangeSelection.of(OPS, List.of(restored), REQUESTER);
    assertEquals(List.of(TAG), selection.approved());
    assertEquals(List.of(DESCRIPTION), selection.rejected());
  }

  @Test
  void disjointReviewerSelectionsDiscardEveryChange() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(
                decision("karan", DecisionType.APPROVE, List.of(ref(TAG)), null),
                decision("admin", DecisionType.APPROVE, List.of(ref(DESCRIPTION)), null)),
            REQUESTER);
    assertTrue(selection.approved().isEmpty());
    assertEquals(OPS, selection.rejected());
  }

  @Test
  void aRejectionByAnyReviewerDropsTheChange() {
    ChangeSelection selection =
        ChangeSelection.of(
            OPS,
            List.of(
                decision("admin", DecisionType.APPROVE, null, null),
                decision(
                    "karan", DecisionType.APPROVE, List.of(ref(TAG)), List.of(ref(DESCRIPTION)))),
            REQUESTER);
    assertEquals(List.of(TAG), selection.approved());
    assertEquals(List.of(DESCRIPTION), selection.rejected());
  }

  @Test
  void theRequestersOwnApprovalIsIgnoredAndAnOverrideAppliesEverything() {
    assertTrue(
        ChangeSelection.of(
                OPS, List.of(decision(REQUESTER, DecisionType.APPROVE, null, null)), REQUESTER)
            .approved()
            .isEmpty());
    assertEquals(
        OPS,
        ChangeSelection.of(
                OPS, List.of(decision(REQUESTER, DecisionType.OVERRIDE, null, null)), REQUESTER)
            .approved());
  }

  @Test
  void describeNamesFieldsAndElements() {
    assertEquals("description, tags PII.Sensitive", ChangeSelection.describe(OPS));
  }
}

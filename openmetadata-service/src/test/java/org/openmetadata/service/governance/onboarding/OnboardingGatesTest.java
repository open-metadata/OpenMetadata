package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingReassignPolicy;
import org.openmetadata.schema.governance.onboarding.OnboardingStallPolicy;

class OnboardingGatesTest {
  private static final long NOW = 1_700_000_000_000L;

  @Test
  void aGateBlocksUnlessItsAuthorTurnedThatOff() {
    assertTrue(OnboardingGates.blocks(new OnboardingGate()));
    assertTrue(OnboardingGates.blocks(new OnboardingGate().withBlockTransition(true)));
    assertFalse(OnboardingGates.blocks(new OnboardingGate().withBlockTransition(false)));
  }

  /** A gate that chases nobody must not invent a deadline the playbook never promised. */
  @Test
  void aGateWithNoStallPolicyLeavesTheTaskWithoutADueDate() {
    assertNull(OnboardingGates.dueDate(new OnboardingGate(), NOW));
    assertNull(OnboardingGates.dueDate(null, NOW));
    assertNull(
        OnboardingGates.dueDate(
            new OnboardingGate()
                .withNotifyOnStall(new OnboardingStallPolicy().withEnabled(false).withAfterDays(5)),
            NOW));
  }

  @Test
  void theDueDateIsWhicheverStallPolicyFiresFirst() {
    OnboardingGate notifying =
        new OnboardingGate()
            .withNotifyOnStall(new OnboardingStallPolicy().withEnabled(true).withAfterDays(5))
            .withReassignOnStall(
                new OnboardingReassignPolicy().withEnabled(true).withAfterDays(10));
    OnboardingGate reassigningOnly =
        new OnboardingGate()
            .withReassignOnStall(new OnboardingReassignPolicy().withEnabled(true).withAfterDays(3));

    assertEquals(NOW + TimeUnit.DAYS.toMillis(5), OnboardingGates.dueDate(notifying, NOW));
    assertEquals(NOW + TimeUnit.DAYS.toMillis(3), OnboardingGates.dueDate(reassigningOnly, NOW));
  }

  @Test
  void stalledWorkFallsToTheDomainOwnersWhenNoRoleWasChosen() {
    OnboardingGate gate =
        new OnboardingGate().withReassignOnStall(new OnboardingReassignPolicy().withEnabled(true));

    assertEquals(
        OnboardingAssignment.Role.DOMAIN_OWNERS, OnboardingGates.reassignRole(gate).getRole());
  }

  @Test
  void anExplicitReassignmentRoleIsKept() {
    OnboardingGate gate =
        new OnboardingGate()
            .withReassignOnStall(
                new OnboardingReassignPolicy()
                    .withEnabled(true)
                    .withRole(
                        new OnboardingAssignment().withRole(OnboardingAssignment.Role.EXPERTS)));

    assertEquals(OnboardingAssignment.Role.EXPERTS, OnboardingGates.reassignRole(gate).getRole());
  }
}

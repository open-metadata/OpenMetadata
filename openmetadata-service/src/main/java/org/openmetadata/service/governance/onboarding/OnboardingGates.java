package org.openmetadata.service.governance.onboarding;

import java.util.List;
import java.util.concurrent.TimeUnit;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingReassignPolicy;
import org.openmetadata.schema.governance.onboarding.OnboardingStallPolicy;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;

/**
 * Gate lookups shared by evaluation, the task scheduler and the stall pass. A gate governs leaving
 * one stage; whether it blocks that exit, and how long it waits before chasing someone, is the only
 * policy onboarding itself owns - the status change belongs to the gate's handoff workflow.
 */
public final class OnboardingGates {
  private OnboardingGates() {}

  public static OnboardingGate gateFor(OnboardingConfiguration configuration, String stage) {
    if (configuration == null || configuration.getGates() == null || stage == null) return null;
    return configuration.getGates().stream()
        .filter(gate -> stage.equals(gate.getStage()))
        .findFirst()
        .orElse(null);
  }

  public static OnboardingGate gateFor(OnboardingPlaybook playbook, String stage) {
    return gateFor(playbook == null ? null : playbook.getOnboarding(), stage);
  }

  public static OnboardingGate gateFor(OnboardingInstance instance, String stage) {
    return instance == null ? null : gateFor(instance.getConfiguration(), stage);
  }

  /** The gate a check belongs to, so a task can read the policy that opened it. */
  public static OnboardingGate gateForStep(OnboardingConfiguration configuration, String stepId) {
    if (configuration == null || configuration.getGates() == null || stepId == null) return null;
    return configuration.getGates().stream()
        .filter(gate -> gate.getSteps().stream().anyMatch(step -> stepId.equals(step.getId())))
        .findFirst()
        .orElse(null);
  }

  public static OnboardingGate gateForStep(OnboardingInstance instance, String stepId) {
    return instance == null || instance.getConfiguration() == null
        ? null
        : gateForStep(instance.getConfiguration().getOnboarding(), stepId);
  }

  /** A gate blocks unless its author turned {@code blockTransition} off. */
  public static boolean blocks(OnboardingGate gate) {
    return gate == null || !Boolean.FALSE.equals(gate.getBlockTransition());
  }

  public static List<OnboardingStep> steps(OnboardingGate gate) {
    return gate == null || gate.getSteps() == null ? List.of() : gate.getSteps();
  }

  public static boolean notifiesOnStall(OnboardingGate gate) {
    OnboardingStallPolicy policy = gate == null ? null : gate.getNotifyOnStall();
    return policy != null && Boolean.TRUE.equals(policy.getEnabled());
  }

  public static boolean reassignsOnStall(OnboardingGate gate) {
    OnboardingReassignPolicy policy = gate == null ? null : gate.getReassignOnStall();
    return policy != null && Boolean.TRUE.equals(policy.getEnabled());
  }

  public static long stallMillis(OnboardingGate gate) {
    return TimeUnit.DAYS.toMillis(gate.getNotifyOnStall().getAfterDays());
  }

  public static long reassignMillis(OnboardingGate gate) {
    return TimeUnit.DAYS.toMillis(gate.getReassignOnStall().getAfterDays());
  }

  /**
   * Role stalled work moves to. Domain owners are the default because they are the one role an
   * asset always has somebody in, which is the point of reassigning in the first place.
   */
  public static OnboardingAssignment reassignRole(OnboardingGate gate) {
    OnboardingAssignment role =
        gate == null || gate.getReassignOnStall() == null
            ? null
            : gate.getReassignOnStall().getRole();
    return role == null || role.getRole() == null
        ? new OnboardingAssignment().withRole(OnboardingAssignment.Role.DOMAIN_OWNERS)
        : role;
  }

  /**
   * When the gate expects the work to be done. Derived from whichever stall policy fires first; a
   * gate that chases nobody leaves the task with no due date rather than inventing one.
   */
  public static Long dueDate(OnboardingGate gate, long now) {
    if (notifiesOnStall(gate)) return now + stallMillis(gate);
    if (reassignsOnStall(gate)) return now + reassignMillis(gate);
    return null;
  }
}

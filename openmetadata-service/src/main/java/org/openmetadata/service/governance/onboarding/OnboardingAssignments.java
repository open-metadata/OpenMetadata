package org.openmetadata.service.governance.onboarding;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

public final class OnboardingAssignments {
  private static final Set<String> ASSIGNABLE_TYPES = Set.of(Entity.USER, Entity.TEAM);

  private OnboardingAssignments() {}

  public static List<EntityReference> resolve(
      OnboardingStep step, EntityInterface entity, OnboardingInstance instance) {
    return resolve(step, entity, instance, OnboardingReadContext.DIRECT);
  }

  static List<EntityReference> resolve(
      OnboardingStep step,
      EntityInterface entity,
      OnboardingInstance instance,
      OnboardingReadContext reads) {
    return resolve(effectiveAssignment(step, instance), entity, instance, reads);
  }

  static List<EntityReference> resolve(
      OnboardingAssignment assignment,
      EntityInterface entity,
      OnboardingInstance instance,
      OnboardingReadContext reads) {
    if (assignment == null || assignment.getRole() == null)
      return active(list(instance.getCreator()), reads);
    return active(
        switch (assignment.getRole()) {
          case CREATOR -> list(instance.getCreator());
          case OWNERS -> safe(entity.getOwners());
          case EXPERTS -> safe(entity.getExperts());
          case EXPLICIT -> safe(assignment.getAssignees());
          case DOMAIN_OWNERS -> domainOwners(entity, reads);
        },
        reads);
  }

  /**
   * A stall reassignment sticks. Without this, the next assignee refresh would hand the task back
   * to whoever the gate already gave up waiting on.
   */
  private static OnboardingAssignment effectiveAssignment(
      OnboardingStep step, OnboardingInstance instance) {
    var binding = OnboardingTasks.binding(instance, step.getId());
    if (binding == null || binding.getReassignedAt() == null) return step.getAssignment();
    return OnboardingGates.reassignRole(OnboardingGates.gateForStep(instance, step.getId()));
  }

  private static List<EntityReference> active(
      List<EntityReference> references, OnboardingReadContext reads) {
    List<EntityReference> result = new ArrayList<>();
    for (var reference : references) {
      if (!assignable(reference)) continue;
      try {
        EntityInterface assignee = reads.entity(reference, "");
        result.add(assignee.getEntityReference());
      } catch (EntityNotFoundException removedAssignee) {
        // Deleted users and teams leave unresolved work until responsibilities are corrected.
      }
    }
    return result;
  }

  /** Only people and teams hold a role; a reference stored without a type holds nothing. */
  private static boolean assignable(EntityReference reference) {
    return reference != null
        && reference.getId() != null
        && reference.getType() != null
        && ASSIGNABLE_TYPES.contains(reference.getType());
  }

  private static List<EntityReference> domainOwners(
      EntityInterface entity, OnboardingReadContext reads) {
    if (Entity.DOMAIN.equals(entity.getEntityReference().getType()))
      return safe(entity.getOwners());
    List<EntityReference> owners = new ArrayList<>();
    for (EntityReference domain : safe(entity.getDomains())) {
      try {
        EntityInterface parent = reads.entity(domain, "owners");
        for (EntityReference owner : safe(parent.getOwners())) {
          if (owners.stream().noneMatch(candidate -> candidate.getId().equals(owner.getId())))
            owners.add(owner);
        }
      } catch (EntityNotFoundException removedDomain) {
        // A removed domain cannot supply active responsibilities.
      }
    }
    return owners;
  }

  private static List<EntityReference> safe(List<EntityReference> references) {
    return references == null ? List.of() : references;
  }

  private static List<EntityReference> list(EntityReference reference) {
    return reference == null ? List.of() : List.of(reference);
  }
}

package org.openmetadata.service.governance.onboarding;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

public final class OnboardingAssignments {
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
    OnboardingAssignment assignment = step.getAssignment();
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

  private static List<EntityReference> active(
      List<EntityReference> references, OnboardingReadContext reads) {
    List<EntityReference> result = new ArrayList<>();
    for (var reference : references) {
      if (reference == null
          || reference.getId() == null
          || !List.of(Entity.USER, Entity.TEAM).contains(reference.getType())) continue;
      try {
        EntityInterface assignee = reads.entity(reference, "");
        result.add(assignee.getEntityReference());
      } catch (EntityNotFoundException removedAssignee) {
        // Deleted users and teams leave unresolved work until responsibilities are corrected.
      }
    }
    return result;
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

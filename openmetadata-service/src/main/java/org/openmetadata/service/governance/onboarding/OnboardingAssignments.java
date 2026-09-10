package org.openmetadata.service.governance.onboarding;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.RequestEntityCache;

public final class OnboardingAssignments {
  private OnboardingAssignments() {}

  public static List<EntityReference> resolve(
      OnboardingStep step, EntityInterface entity, OnboardingInstance instance) {
    OnboardingAssignment assignment = step.getAssignment();
    if (assignment == null || assignment.getRole() == null)
      return active(list(instance.getCreator()));
    return active(
        switch (assignment.getRole()) {
          case CREATOR -> list(instance.getCreator());
          case OWNERS -> safe(entity.getOwners());
          case EXPERTS -> safe(entity.getExperts());
          case EXPLICIT -> safe(assignment.getAssignees());
          case DOMAIN_OWNERS -> domainOwners(entity);
        });
  }

  private static List<EntityReference> active(List<EntityReference> references) {
    List<EntityReference> result = new ArrayList<>();
    for (var reference : references) {
      if (reference == null
          || reference.getId() == null
          || !List.of(Entity.USER, Entity.TEAM).contains(reference.getType())) continue;
      try {
        RequestEntityCache.invalidate(reference.getType(), reference.getId(), null);
        EntityInterface assignee =
            Entity.getEntity(
                reference.getType(), reference.getId(), "", Include.NON_DELETED, false);
        result.add(assignee.getEntityReference());
      } catch (EntityNotFoundException removedAssignee) {
        // Deleted users and teams leave unresolved work until responsibilities are corrected.
      }
    }
    return result;
  }

  private static List<EntityReference> domainOwners(EntityInterface entity) {
    if (Entity.DOMAIN.equals(entity.getEntityReference().getType()))
      return safe(entity.getOwners());
    List<EntityReference> owners = new ArrayList<>();
    for (EntityReference domain : safe(entity.getDomains())) {
      try {
        RequestEntityCache.invalidate(Entity.DOMAIN, domain.getId(), null);
        EntityInterface parent =
            Entity.getEntity(Entity.DOMAIN, domain.getId(), "owners", Include.NON_DELETED, false);
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

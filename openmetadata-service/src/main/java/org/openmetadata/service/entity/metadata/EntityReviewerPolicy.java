package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;

import java.util.List;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.AuthorizationException;

/** Authorizes review decisions using the existing direct-user and team-membership rules. */
public final class EntityReviewerPolicy {
  private final Function<String, List<EntityReference>> teamUsers;

  public EntityReviewerPolicy(final Function<String, List<EntityReference>> teamUsers) {
    this.teamUsers = teamUsers;
  }

  public void check(final EntityInterface entity, final String updatedBy) {
    final List<EntityReference> reviewers = entity.getReviewers();
    if (!nullOrEmpty(reviewers)
        && reviewers.stream().noneMatch(reviewer -> matches(reviewer, updatedBy))) {
      throw new AuthorizationException(notReviewer(updatedBy));
    }
  }

  private boolean matches(final EntityReference reviewer, final String updatedBy) {
    return reviewer.getType().equals(TEAM)
        ? teamUsers.apply(reviewer.getName()).stream()
            .anyMatch(user -> matchesUser(user, updatedBy))
        : matchesUser(reviewer, updatedBy);
  }

  private boolean matchesUser(final EntityReference user, final String updatedBy) {
    return user.getName().equals(updatedBy) || user.getFullyQualifiedName().equals(updatedBy);
  }
}

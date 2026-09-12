package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.POLICY;
import static org.openmetadata.service.Entity.ROLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.util.EntityUtil;

/** Validates reference types and hydrates through the configured entity/cache lookup boundary. */
public final class EntityReferenceValidator {
  private static final EntityReferenceValidator SHARED =
      new EntityReferenceValidator(
          new References(
              Entity::getEntityReferenceById,
              Entity::getEntityReferenceByName,
              id -> Entity.getEntity(TEAM, id, "", NON_DELETED)));

  public static EntityReferenceValidator shared() {
    return SHARED;
  }

  @FunctionalInterface
  public interface ById {
    EntityReference get(String type, UUID id, Include include);
  }

  @FunctionalInterface
  public interface ByName {
    EntityReference get(String type, String fqn, Include include);
  }

  public record References(ById byId, ByName byName, Function<UUID, Team> teams) {}

  private final References references;

  public EntityReferenceValidator(final References references) {
    this.references = references;
  }

  public List<EntityReference> owners(final List<EntityReference> owners) {
    return nullOrEmpty(owners)
        ? null
        : owners.stream().map(this::owner).collect(Collectors.toList());
  }

  public List<EntityReference> validatedOwners(final List<EntityReference> owners) {
    return needsValidation(owners) ? sortedOrOriginal(owners(owners), owners) : owners;
  }

  public List<EntityReference> validatedDomains(
      final List<EntityReference> domains, final boolean supported) {
    return needsValidation(domains)
        ? sortedOrOriginal(domainsByRef(domains, supported), domains)
        : domains;
  }

  private boolean needsValidation(final List<EntityReference> values) {
    return !nullOrEmpty(values)
        && !values.stream().allMatch(reference -> Boolean.TRUE.equals(reference.getInherited()));
  }

  private List<EntityReference> sortedOrOriginal(
      final List<EntityReference> validated, final List<EntityReference> original) {
    if (nullOrEmpty(validated)) {
      return original;
    }
    validated.sort(EntityUtil.compareEntityReference);
    return validated;
  }

  private EntityReference owner(final EntityReference owner) {
    final String type = owner.getType();
    if (type == null) {
      throw new IllegalArgumentException(
          String.format("Owner type must be specified for owner with id [%s]", owner.getId()));
    }
    return switch (type) {
      case TEAM -> teamOwner(owner.getId());
      case USER -> references.byId().get(USER, owner.getId(), NON_DELETED);
      default -> throw new IllegalArgumentException(CatalogExceptionMessage.invalidOwnerType(type));
    };
  }

  private EntityReference teamOwner(final UUID id) {
    final Team team = references.teams().apply(id);
    if (!team.getTeamType().equals(TeamType.GROUP)) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidTeamOwner(team.getTeamType()));
    }
    return team.getEntityReference();
  }

  public void users(final List<EntityReference> users) {
    if (users != null) {
      hydrate(users, USER, ALL, true);
      users.sort(EntityUtil.compareEntityReference);
    }
  }

  public void roles(final List<EntityReference> roles) {
    hydrateSortedIds(roles, ROLE);
  }

  public void policies(final List<EntityReference> policies) {
    hydrateSortedIds(policies, POLICY);
  }

  private void hydrateSortedIds(final List<EntityReference> values, final String type) {
    if (values != null) {
      hydrate(values, type, ALL, false);
      values.sort(EntityUtil.compareEntityReference);
    }
  }

  public void reviewers(final List<EntityReference> reviewers) {
    if (!nullOrEmpty(reviewers)) {
      final boolean allTeams = hasOnlyType(reviewers, TEAM);
      final boolean allUsers = hasOnlyType(reviewers, USER);
      validateReviewerTypes(allTeams, allUsers, reviewers.size());
      hydrate(reviewers, allTeams ? TEAM : USER, ALL, true);
      reviewers.sort(EntityUtil.compareEntityReference);
    }
  }

  private boolean hasOnlyType(final List<EntityReference> values, final String type) {
    return values.stream().allMatch(reference -> reference.getType().equals(type));
  }

  private void validateReviewerTypes(
      final boolean allTeams, final boolean allUsers, final int size) {
    if (allTeams && size > 1) {
      throw new IllegalArgumentException("Only one team can be assigned as reviewer.");
    }
    if (!allTeams && !allUsers) {
      throw new IllegalArgumentException(
          "Invalid Reviewer Type. Only one team or multiple users can be assigned as reviewer.");
    }
  }

  private void hydrate(
      final List<EntityReference> values,
      final String type,
      final Include include,
      final boolean allowName) {
    for (final EntityReference value : values) {
      final EntityReference resolved =
          allowName && value.getId() == null
              ? references.byName().get(type, value.getFullyQualifiedName(), include)
              : references.byId().get(type, value.getId(), include);
      EntityUtil.copy(resolved, value);
    }
  }

  public List<EntityReference> domains(final List<String> fqns, final boolean supported) {
    return !supported || nullOrEmpty(fqns)
        ? null
        : fqns.stream()
            .map(fqn -> references.byName().get(DOMAIN, fqn, NON_DELETED))
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
  }

  public List<EntityReference> domainsByRef(
      final List<EntityReference> domains, final boolean supported) {
    requireField(supported, FIELD_DOMAINS);
    return nullOrEmpty(domains)
        ? null
        : domains.stream()
            .map(domain -> references.byId().get(DOMAIN, domain.getId(), NON_DELETED))
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
  }

  public void dataProducts(final List<EntityReference> dataProducts, final boolean supported) {
    requireField(supported, FIELD_DATA_PRODUCTS);
    if (!nullOrEmpty(dataProducts)) {
      hydrate(dataProducts, DATA_PRODUCT, NON_DELETED, false);
    }
  }

  private void requireField(final boolean supported, final String field) {
    if (!supported) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidField(field));
    }
  }
}

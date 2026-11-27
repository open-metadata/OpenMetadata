package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * The owners an approval task falls back to when the asset resolved nobody: its service's owners,
 * then its domains' owners. A step counts as empty when it yields no user after team expansion.
 * ADR:2026-11-20-suggestion-tasks-fall-back-through-every-owner-to-the-admins
 */
final class OwnerCascade {
  private OwnerCascade() {}

  static List<String> resolve(
      final EntityInterface<?> entity,
      final String entityType,
      final Function<List<EntityReference>, List<String>> expandTeams) {
    final List<String> serviceOwners = expandTeams.apply(serviceOwners(entity));
    return serviceOwners.isEmpty()
        ? expandTeams.apply(domainOwners(entityType, entity))
        : serviceOwners;
  }

  static List<EntityReference> domainOwners(
      final String entityType, final EntityInterface<?> entity) {
    final List<EntityReference> owners =
        Entity.DOMAIN.equals(entityType) ? entity.getOwners() : ownersOf(entity.getDomains());
    return owners == null ? List.of() : owners;
  }

  private static List<EntityReference> ownersOf(final List<EntityReference> domains) {
    return domains == null
        ? List.of()
        : domains.stream()
            .map(
                reference ->
                    Entity.<Domain>getEntity(
                        Entity.DOMAIN, reference.getId(), Entity.FIELD_OWNERS, Include.NON_DELETED))
            .filter(domain -> domain.getOwners() != null)
            .flatMap(domain -> domain.getOwners().stream())
            .toList();
  }

  private static List<EntityReference> serviceOwners(final EntityInterface<?> entity) {
    return Optional.ofNullable(entity.getService())
        .map(
            service ->
                Entity.<EntityInterface<?>>getEntity(service, Entity.FIELD_OWNERS, Include.ALL)
                    .getOwners())
        .orElse(List.of());
  }
}

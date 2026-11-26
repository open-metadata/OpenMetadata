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

package org.openmetadata.service.resources.lineage;

import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import jakarta.ws.rs.core.SecurityContext;
import java.util.function.Function;
import java.util.function.Predicate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Resolves the ends a lineage route names and authorizes them, reading each end once.
 *
 * <p>A caller that is not an admin is evaluated against the end's policy attributes, so the end is
 * loaded with exactly the projection, relation include and cache the lazy authorization context
 * would use, and that copy also answers the name. An admin is never evaluated against an end, so
 * for an admin a reference is the cheaper read. Both branches still call the authorizer, so a wrong
 * admin answer can only cost a read, never skip a check.
 */
final class LineageEdgeAccess {

  /** One end as a route names it: its type, its name and whether a deleted end counts. */
  record LineageEnd(String entityType, String fullyQualifiedName, Include include) {}

  record ResolvedEdge(EntityReference from, EntityReference to) {}

  private record ResolvedEnd(EntityReference reference, ResourceContextInterface context) {}

  private final Authorizer authorizer;
  private final Predicate<SecurityContext> isAdmin;
  private final Function<String, EntityRepository<? extends EntityInterface<?>>> repositories;

  LineageEdgeAccess(Authorizer authorizer) {
    this(
        authorizer,
        securityContext -> getSubjectContext(securityContext).isAdmin(),
        Entity::getEntityRepository);
  }

  LineageEdgeAccess(
      Authorizer authorizer,
      Predicate<SecurityContext> isAdmin,
      Function<String, EntityRepository<? extends EntityInterface<?>>> repositories) {
    this.authorizer = authorizer;
    this.isAdmin = isAdmin;
    this.repositories = repositories;
  }

  /** Resolves both ends before authorizing either, so a missing end is a 404 for every caller. */
  ResolvedEdge resolveAndAuthorizeEdge(
      SecurityContext securityContext,
      LineageEnd from,
      LineageEnd to,
      MetadataOperation operation) {
    boolean admin = isAdmin.test(securityContext);
    ResolvedEnd resolvedFrom = resolve(from, admin);
    ResolvedEnd resolvedTo = resolve(to, admin);
    authorize(securityContext, resolvedFrom, operation);
    authorize(securityContext, resolvedTo, operation);
    return new ResolvedEdge(resolvedFrom.reference(), resolvedTo.reference());
  }

  EntityReference resolveAndAuthorize(
      SecurityContext securityContext, LineageEnd end, MetadataOperation operation) {
    ResolvedEnd resolved = resolve(end, isAdmin.test(securityContext));
    authorize(securityContext, resolved, operation);
    return resolved.reference();
  }

  private ResolvedEnd resolve(LineageEnd end, boolean admin) {
    EntityRepository<? extends EntityInterface<?>> repository =
        repositories.apply(end.entityType());
    return admin ? byReference(end, repository) : byAuthorizationCopy(end, repository);
  }

  private static ResolvedEnd byReference(LineageEnd end, EntityRepository<?> repository) {
    EntityReference reference =
        repository.getReferenceByName(end.fullyQualifiedName(), end.include());
    return new ResolvedEnd(
        reference, new ResourceContext<>(end.entityType(), reference.getId(), reference.getName()));
  }

  /**
   * Loads deleted ends too, as the lazy context does, so relations resolve the same way; the
   * route's own include is then applied to the loaded copy.
   */
  private static <T extends EntityInterface<?>> ResolvedEnd byAuthorizationCopy(
      LineageEnd end, EntityRepository<T> repository) {
    T entity =
        repository.getByName(
            null,
            end.fullyQualifiedName(),
            ResourceContext.authorizationFields(repository),
            RelationIncludes.fromInclude(Include.ALL),
            true);
    requireIncluded(end, entity);
    return new ResolvedEnd(
        entity.getEntityReference().withType(end.entityType()),
        new ResourceContext<>(end.entityType(), entity, repository));
  }

  private static void requireIncluded(LineageEnd end, EntityInterface<?> entity) {
    if (!isIncluded(end.include(), Boolean.TRUE.equals(entity.getDeleted()))) {
      throw EntityNotFoundException.byMessage(
          entityNotFound(end.entityType(), end.fullyQualifiedName()));
    }
  }

  private static boolean isIncluded(Include include, boolean deleted) {
    return switch (include) {
      case NON_DELETED -> !deleted;
      case DELETED -> deleted;
      case ALL -> true;
    };
  }

  private void authorize(
      SecurityContext securityContext, ResolvedEnd end, MetadataOperation operation) {
    authorizer.authorize(
        securityContext, new OperationContext(end.reference().getType(), operation), end.context());
  }
}

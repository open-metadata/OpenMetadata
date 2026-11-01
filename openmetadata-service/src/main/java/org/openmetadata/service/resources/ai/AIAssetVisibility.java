/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Narrows an estate-wide AI governance computation to the AI assets the caller may actually view.
 *
 * <p>The estate-wide endpoints (dashboard, activity feed, policy violations, framework coverage)
 * authorize {@code VIEW_ALL} against a type-only {@code ResourceContext}; {@code hasDomain()}
 * deliberately passes such a context so the entity list endpoints can narrow with a domain query
 * param. These computations have no {@code ListFilter} to push the condition into — they page the
 * whole AI estate in memory — so the narrowing happens here, per page, before anything is
 * aggregated. Assets the caller may not view are excluded from counts, top-N cuts, events and
 * breach rows alike.
 *
 * <p>Two shapes:
 *
 * <ul>
 *   <li>Request threads: {@link #forCaller(SecurityContext, Authorizer)} checks each page with the
 *       batched, fail-closed {@code ViewBasic} filter {@link ViewPermissionFilter} ({@code
 *       ActivityResource} and the lineage filter use the same one), so a decision here can never
 *       diverge from a direct read of the asset. Admins — and a null {@code SecurityContext}, for
 *       internal/test callers — see everything.
 *   <li>The audit-pack worker, which has no {@code SecurityContext}: {@link #forUser(String)}
 *       re-checks every in-scope asset as the named requester via {@link
 *       DefaultAuthorizer#authorizeUser}, one {@code ViewBasic} decision per asset, failing closed.
 * </ul>
 */
@Slf4j
public final class AIAssetVisibility {

  private final PageFilter pageFilter;

  private AIAssetVisibility(PageFilter pageFilter) {
    this.pageFilter = pageFilter;
  }

  /** No narrowing: every asset is visible. Used for admins and already-authorized single-asset reads. */
  public static AIAssetVisibility unrestricted() {
    return new AIAssetVisibility(entities -> List.copyOf(entities));
  }

  /**
   * Visibility of {@code securityContext} on the AI asset types. Admins (and a null context) are
   * unrestricted; everyone else is filtered per page through {@link ViewPermissionFilter}.
   */
  public static AIAssetVisibility forCaller(
      SecurityContext securityContext, Authorizer authorizer) {
    if (securityContext == null) {
      return unrestricted();
    }
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
    if (subjectContext.isAdmin()) {
      return unrestricted();
    }
    ViewPermissionFilter viewFilter = new ViewPermissionFilter(authorizer);
    return new AIAssetVisibility(
        entities -> {
          if (entities.isEmpty()) {
            return List.of();
          }
          Set<UUID> viewable =
              viewFilter.viewableIds(
                  securityContext,
                  entities.stream()
                      .map(EntityInterface::getEntityReference)
                      .filter(Objects::nonNull)
                      .toList());
          List<EntityInterface<?>> result = new ArrayList<>();
          for (EntityInterface<?> entity : entities) {
            if (entity.getId() != null && viewable.contains(entity.getId())) {
              result.add(entity);
            }
          }
          return result;
        });
  }

  /**
   * Visibility of a named user on the AI asset types, for workers that run without a {@code
   * SecurityContext}. One {@code ViewBasic} check per asset, failing closed: a null or unknown
   * user name hides everything rather than defaulting to the unrestricted estate.
   */
  public static AIAssetVisibility forUser(String userName) {
    return new AIAssetVisibility(
        entities -> {
          List<EntityInterface<?>> result = new ArrayList<>();
          if (userName == null || userName.isBlank()) {
            return result;
          }
          for (EntityInterface<?> entity : entities) {
            if (entity.getId() == null || entity.getEntityReference() == null) {
              continue;
            }
            String entityType = entity.getEntityReference().getType();
            if (entityType == null) {
              continue;
            }
            try {
              DefaultAuthorizer.authorizeUser(
                  userName,
                  new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
                  new ResourceContext<>(
                      entityType, entity.getId(), entity.getFullyQualifiedName()));
              result.add(entity);
            } catch (RuntimeException denied) {
              LOG.debug(
                  "Hiding {} {} from requester {}: {}",
                  entityType,
                  entity.getId(),
                  userName,
                  denied.getMessage());
            }
          }
          return result;
        });
  }

  /** The assets of one listed page the visibility admits. Never throws. */
  public List<EntityInterface<?>> filter(List<? extends EntityInterface<?>> entities) {
    return pageFilter.filter(entities);
  }

  @FunctionalInterface
  private interface PageFilter {
    List<EntityInterface<?>> filter(List<? extends EntityInterface<?>> entities);
  }
}

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

package org.openmetadata.service.resources.metrics;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.MetricGroupRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.JsonPatchUtils;

/**
 * The checks metric and metric group writes run on top of the policy check every entity gets: the
 * fields a metric patch may not set, EditAll on the metrics a hierarchy or group change moves and on
 * where they land, and view access to the assets a new metric links.
 *
 * <p>The create, PUT and PATCH endpoints of both resources and the metric bulk PUT call these, and
 * so do the MCP entity tools (ADR:2026-11-03-metric-writes-run-the-same-checks-through-rest-and-mcp).
 * CSV import uses the same membership comparisons for row-level hierarchy authorization. The
 * EditAll and asset checks live in {@code MetricRepository} and {@code MetricGroupRepository}, which
 * also run them on every write through {@code EntityRepository.authorizeWrite}.
 */
public final class MetricAuthorization {

  private MetricAuthorization() {}

  /** For callers that create any entity type; does nothing for types other than these two. */
  public static void authorizeCreate(
      Authorizer authorizer, SecurityContext securityContext, EntityInterface<?> entity) {
    switch (entity) {
      case Metric metric -> authorizeMetricCreate(authorizer, securityContext, metric);
      case MetricGroup group -> authorizeGroupCreate(authorizer, securityContext, group);
      default -> {}
    }
  }

  /** For callers that patch any entity type by name; does nothing for types other than these two. */
  public static void authorizePatch(
      Authorizer authorizer,
      SecurityContext securityContext,
      String entityType,
      String fqn,
      JsonPatch patch) {
    switch (entityType) {
      case Entity.METRIC -> authorizeMetricPatch(
          authorizer,
          securityContext,
          patch,
          () -> metrics().getByName(null, fqn, metrics().getPatchFields()));
      case Entity.METRIC_GROUP -> authorizeGroupPatch(
          authorizer,
          securityContext,
          groups().getByName(null, fqn, groups().getPatchFields()),
          patch);
      default -> {}
    }
  }

  static void authorizeMetricCreate(
      Authorizer authorizer, SecurityContext securityContext, Metric metric) {
    metrics().prepareInternal(metric, false);
    authorizeHierarchyDestinations(authorizer, securityContext, null, metric);
    authorizeRequestedAssets(authorizer, securityContext, metric);
  }

  static void authorizeMetricPatch(
      Authorizer authorizer,
      SecurityContext securityContext,
      JsonPatch patch,
      Supplier<Metric> original) {
    validateMetricPatch(patch);
    if (patchMutatesHierarchy(patch)) {
      authorizePatchedHierarchy(authorizer, securityContext, original.get(), patch);
    }
  }

  private static void authorizePatchedHierarchy(
      Authorizer authorizer, SecurityContext securityContext, Metric original, JsonPatch patch) {
    Metric updated = JsonUtils.applyPatch(original, patch, Metric.class);
    metrics().prepareInternal(updated, true);
    authorizeHierarchyChange(authorizer, securityContext, original, updated);
  }

  static void authorizeHierarchyChange(
      Authorizer authorizer, SecurityContext securityContext, Metric original, Metric updated) {
    metrics().authorizeHierarchyChange(original, updated, asRequest(authorizer, securityContext));
  }

  static void authorizeHierarchyDestinations(
      Authorizer authorizer, SecurityContext securityContext, Metric original, Metric updated) {
    MetricRepository.hierarchyDestinations(original, updated)
        .forEach(
            destination ->
                MetricRepository.authorizeEditAll(
                    destination, asRequest(authorizer, securityContext)));
  }

  /** A whole-document replace can set the parent too, and the patched fields leave it out. */
  static boolean patchMutatesHierarchy(JsonPatch patch) {
    Set<String> fields = JsonUtils.extractPatchedFields(patch);
    return JsonPatchUtils.replacesWholeDocument(patch)
        || fields.contains("parent")
        || fields.contains("metricGroup");
  }

  static void validateMetricPatch(JsonPatch patch) {
    Set<String> fields = JsonUtils.extractPatchedFields(patch);
    if (fields.contains("assets")) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.readOnlyAttribute(Entity.METRIC, "assets"));
    }
    if (fields.contains("children")) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.readOnlyAttribute(Entity.METRIC, "children"));
    }
    if (fields.contains("childrenCount")) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.readOnlyAttribute(Entity.METRIC, "childrenCount"));
    }
  }

  static void authorizeRequestedAssets(
      Authorizer authorizer, SecurityContext securityContext, Metric metric) {
    MetricRepository.authorizeRequestedAssets(metric, asRequest(authorizer, securityContext));
  }

  static boolean canAccess(
      Authorizer authorizer,
      SecurityContext securityContext,
      EntityReference entity,
      MetadataOperation operation) {
    boolean result = true;
    try {
      OperationContext operationContext = new OperationContext(entity.getType(), operation);
      authorizer.authorize(
          securityContext,
          operationContext,
          new ResourceContext<>(entity.getType(), entity.getId(), entity.getFullyQualifiedName()));
    } catch (AuthorizationException
        | EntityNotFoundException
        | IllegalArgumentException exception) {
      result = false;
    }
    return result;
  }

  static void authorizeGroupCreate(
      Authorizer authorizer, SecurityContext securityContext, MetricGroup group) {
    groups().prepareInternal(group, false);
    authorizeMembershipMutation(authorizer, securityContext, null, group);
  }

  static void authorizeGroupPatch(
      Authorizer authorizer,
      SecurityContext securityContext,
      MetricGroup original,
      JsonPatch patch) {
    MetricGroup updated = JsonUtils.applyPatch(original, patch, MetricGroup.class);
    groups().prepareInternal(updated, true);
    authorizeMembershipMutation(authorizer, securityContext, original, updated);
  }

  static void authorizeMembershipMutation(
      Authorizer authorizer,
      SecurityContext securityContext,
      MetricGroup original,
      MetricGroup updated) {
    MetricGroupRepository.authorizeMembershipChange(
        original, updated, asRequest(authorizer, securityContext));
  }

  private static BiConsumer<OperationContext, ResourceContextInterface> asRequest(
      Authorizer authorizer, SecurityContext securityContext) {
    return (operation, resource) -> authorizer.authorize(securityContext, operation, resource);
  }

  private static MetricRepository metrics() {
    return (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
  }

  private static MetricGroupRepository groups() {
    return (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
  }
}

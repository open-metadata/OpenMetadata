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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.json.JsonException;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
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
  private static final List<String> RELATION_FIELDS =
      List.of("parent", "metricGroup", "children", "relatedMetrics");

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
    // The hierarchy check runs first so a move the caller may not make is a 403 whatever its shape;
    // the caller is authorized on the metric before this runs.
    if (patchMutatesHierarchy(patch)) {
      authorizePatchedHierarchy(authorizer, securityContext, original.get(), patch);
    }
    validateMetricPatch(patch);
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
    // The read-only and hierarchy guards work from the field names a patch touches. An operation on
    // the document root rewrites every field while naming none
    // (ADR:2026-11-03-metric-hierarchy-and-membership-patches-are-authorized-before-they-apply).
    if (JsonPatchUtils.replacesWholeDocument(patch)) {
      throw new IllegalArgumentException(
          "A metric patch operation must name a field; the document root can't be patched");
    }
    if (readsRelationElsewhere(patch)) {
      throw new IllegalArgumentException(
          "A metric patch can't test the document root or "
              + String.join(", ", RELATION_FIELDS)
              + ", or copy or move a value out of them into another field");
    }
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

  // Responses drop the relation references the caller may not view, but an operation is authorized
  // by its path only (e.g. copy /parent/description into /description needs EditDescription, and a
  // test of /parent/name answers whether a guess is right).
  private static boolean readsRelationElsewhere(JsonPatch patch) {
    return patch.toJsonArray().stream()
        .map(JsonValue::asJsonObject)
        .anyMatch(MetricAuthorization::readsRelationElsewhere);
  }

  private static boolean readsRelationElsewhere(JsonObject operation) {
    String path = operation.getString("path", "");
    boolean readsRelation;
    if ("test".equals(operation.getString("op", ""))) {
      readsRelation = path.isEmpty() || RELATION_FIELDS.contains(topLevelField(path));
    } else if (operation.containsKey("from")) {
      String from = operation.getString("from", "");
      String fromField = topLevelField(from);
      readsRelation =
          from.isEmpty()
              || (RELATION_FIELDS.contains(fromField) && !fromField.equals(topLevelField(path)));
    } else {
      readsRelation = false;
    }
    return readsRelation;
  }

  private static String topLevelField(String pointer) {
    String stripped = pointer.startsWith("/") ? pointer.substring(1) : pointer;
    int slash = stripped.indexOf('/');
    return slash < 0 ? stripped : stripped.substring(0, slash);
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
    if (addressesMembers(patch)) {
      authorizeMemberView(authorizer, securityContext, original);
    }
    MetricGroup updated;
    try {
      updated = JsonUtils.applyPatch(original, patch, MetricGroup.class);
    } catch (JsonException e) {
      // The JSON-P message prints the document the operation failed on, members included.
      throw new IllegalArgumentException("The JSON Patch cannot be applied to the metric group");
    }
    groups().prepareInternal(updated, true);
    authorizeMembershipMutation(authorizer, securityContext, original, updated);
  }

  /** Whether any operation's path or from is the document root, /metrics, or below it. */
  static boolean addressesMembers(JsonPatch patch) {
    return patch.toJsonArray().stream()
        .map(JsonValue::asJsonObject)
        .anyMatch(
            operation ->
                pointsAtMembers(operation.getString("path", null))
                    || pointsAtMembers(operation.getString("from", null)));
  }

  private static boolean pointsAtMembers(String pointer) {
    return pointer != null
        && (pointer.isEmpty() || pointer.equals("/metrics") || pointer.startsWith("/metrics/"));
  }

  private static void authorizeMemberView(
      Authorizer authorizer, SecurityContext securityContext, MetricGroup group) {
    for (EntityReference metric : listOrEmpty(group.getMetrics())) {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.METRIC, MetadataOperation.VIEW_BASIC),
          new ResourceContext<>(Entity.METRIC, metric.getId(), metric.getFullyQualifiedName()));
    }
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

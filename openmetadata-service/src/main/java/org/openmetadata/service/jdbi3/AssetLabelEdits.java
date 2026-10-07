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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.util.EntityUtil.tagLabelMatch;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.ChildFieldResolver;

/**
 * The label edits an Assets tab change makes to one asset. They only touch the asset in memory, so
 * the caller can diff the result into a JSON patch. DERIVED labels are never touched: they are
 * computed on read and are not the asset's own.
 */
final class AssetLabelEdits {

  private AssetLabelEdits() {}

  /** Adds the label to the asset, or to its child field when {@code childFqn} is set. */
  static void add(EntityInterface asset, String entityType, String childFqn, TagLabel label) {
    if (childFqn == null) {
      addTo(asset.getTags(), label, asset::setTags);
    } else {
      FieldInterface child = child(asset, entityType, childFqn);
      addTo(child.getTags(), label, child::setTags);
    }
  }

  /**
   * Removes the label from the asset and all its child fields, or only from the subtree of one child
   * field when {@code childFqn} is set.
   */
  static void strip(EntityInterface asset, String entityType, String childFqn, TagLabel label) {
    if (childFqn == null) {
      removeFrom(asset.getTags(), label, asset::setTags);
      stripFields(childrenOf(asset, entityType), label);
    } else {
      stripFields(List.of(child(asset, entityType, childFqn)), label);
    }
  }

  private static FieldInterface child(EntityInterface asset, String entityType, String childFqn) {
    return ChildFieldResolver.locate(asset, entityType, childFqn)
        .orElseThrow(() -> new EntityNotFoundException("Column not found: %s".formatted(childFqn)));
  }

  private static List<FieldInterface> childrenOf(EntityInterface asset, String entityType) {
    return ChildFieldResolver.supports(entityType)
        ? ChildFieldResolver.childrenOf(asset, entityType)
        : List.of();
  }

  private static void stripFields(List<? extends FieldInterface> fields, TagLabel label) {
    for (FieldInterface field : listOrEmpty(fields)) {
      removeFrom(field.getTags(), label, field::setTags);
      stripFields(field.getChildren(), label);
    }
  }

  private static void addTo(List<TagLabel> labels, TagLabel label, Consumer<List<TagLabel>> set) {
    if (!hasOwnCopy(labels, label)) {
      List<TagLabel> updated = new ArrayList<>(listOrEmpty(labels));
      updated.add(JsonUtils.deepCopy(label, TagLabel.class));
      set.accept(updated);
    }
  }

  // Only reassigns when something is removed, so an untouched null list does not become [] and
  // show up in the diff.
  private static void removeFrom(
      List<TagLabel> labels, TagLabel label, Consumer<List<TagLabel>> set) {
    if (hasOwnCopy(labels, label)) {
      set.accept(
          new ArrayList<>(
              labels.stream().filter(existing -> !isOwnCopy(existing, label)).toList()));
    }
  }

  private static boolean hasOwnCopy(List<TagLabel> labels, TagLabel label) {
    return listOrEmpty(labels).stream().anyMatch(existing -> isOwnCopy(existing, label));
  }

  private static boolean isOwnCopy(TagLabel existing, TagLabel label) {
    return existing.getLabelType() != LabelType.DERIVED && tagLabelMatch.test(existing, label);
  }
}

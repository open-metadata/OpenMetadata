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

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AssetEditService.AssetEdit;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.security.ChangeActor;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Adds a tag or glossary term to the assets picked on its Assets tab, or removes it, through {@link
 * AssetEditService}.
 *
 * <p>A removal stays within the selected asset: the label comes off the asset and its own fields
 * (a table's columns, a topic's schema fields). Other assets inside it keep labels they were given
 * directly, exactly as on the asset's own page.
 */
public final class AssetTagLabelService {

  private static final String TAGS_NOT_SUPPORTED = "Entity type %s does not support tags";
  private static final String CERTIFICATION_AS_TAG =
      "%s is a certification and cannot be applied as a tag; set the asset's certification instead";

  public record Request(
      TagLabel label, List<EntityReference> assets, boolean dryRun, ChangeActor actor) {}

  @FunctionalInterface
  private interface LabelEdit {
    void apply(EntityInterface asset, String entityType, String childFqn, TagLabel label);
  }

  private AssetTagLabelService() {}

  public static BulkOperationResult addToAssets(Request request) {
    TagLabelUtil.checkDisabledTags(List.of(request.label()));
    return AssetEditService.apply(editRequest(request), labelEdit(request, AssetLabelEdits::add));
  }

  public static BulkOperationResult removeFromAssets(Request request) {
    return AssetEditService.apply(editRequest(request), labelEdit(request, AssetLabelEdits::strip));
  }

  private static AssetEditService.Request editRequest(Request request) {
    return new AssetEditService.Request(request.assets(), request.dryRun(), request.actor());
  }

  private static AssetEdit labelEdit(Request request, LabelEdit labelEdit) {
    TagLabel label = request.label();
    return (asset, selection) -> {
      checkLabelAllowed(selection.entityType(), label);
      labelEdit.apply(asset, selection.entityType(), selection.childFqn(), label);
    };
  }

  private static void checkLabelAllowed(String entityType, TagLabel label) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    if (!repository.isSupportsTags()) {
      throw new IllegalArgumentException(String.format(TAGS_NOT_SUPPORTED, entityType));
    }
    String certification = repository.getCertificationClassification();
    if (certification != null
        && certification.equals(FullyQualifiedName.getParentFQN(label.getTagFQN()))) {
      throw new IllegalArgumentException(String.format(CERTIFICATION_AS_TAG, label.getTagFQN()));
    }
  }
}

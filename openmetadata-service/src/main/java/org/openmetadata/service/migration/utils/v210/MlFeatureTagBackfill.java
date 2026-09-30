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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Indexes existing ML feature tags into tag_usage.
 *
 * <p>MlModelRepository gained an applyTags override that writes a feature's tags there, matching
 * every other entity type with inline children. That only fires on create and update, so features
 * tagged before the upgrade stay absent from tag_usage. Any reader that hydrates a page of children
 * from tag_usage finds nothing for them and sets an empty list, which reports a tagged feature as
 * untagged - and a caller that reads that list, appends to it and writes it back erases the tags
 * the model still carries in its own JSON.
 *
 * <p>The stored JSON is the source of truth here and is never modified. Rows are written through
 * the same DAO the runtime path uses, so the FQN hashing cannot drift from it, and the DAO's
 * insert is upsert-shaped, which is what makes re-running this safe.
 */
@Slf4j
public class MlFeatureTagBackfill {

  private MlFeatureTagBackfill() {}

  private static final int BATCH_SIZE = 200;

  public static void backfillMlFeatureTags(CollectionDAO collectionDAO) {
    int models = 0;
    int tags = 0;
    try {
      EntityDAO<MlModel> modelDAO = collectionDAO.mlModelDAO();
      List<String> batch = nextBatch(modelDAO, "", "");
      while (!nullOrEmpty(batch)) {
        MlModel last = null;
        for (String json : batch) {
          last = JsonUtils.readValue(json, MlModel.class);
          int applied = backfillOne(collectionDAO, last);
          if (applied > 0) {
            models++;
            tags += applied;
          }
        }
        batch =
            batch.size() < BATCH_SIZE
                ? List.of()
                : nextBatch(modelDAO, last.getName(), last.getId().toString());
      }
      LOG.info("Backfilled {} ML feature tag(s) into tag_usage across {} model(s)", tags, models);
    } catch (Exception e) {
      // A failed backfill must not abort the upgrade: the tags remain in the model JSON, which is
      // where they have always been, and the endpoint keeps reporting them as untagged until this
      // is re-run. Losing the server to a migration error is the worse outcome.
      LOG.error("Could not backfill ML feature tags into tag_usage", e);
    }
  }

  private static List<String> nextBatch(
      EntityDAO<MlModel> modelDAO, String afterName, String afterId) {
    return modelDAO.listAfter(new ListFilter(Include.ALL), BATCH_SIZE, afterName, afterId);
  }

  private static int backfillOne(CollectionDAO collectionDAO, MlModel model) {
    int applied = 0;
    for (MlFeature feature : listOrEmpty(model.getMlFeatures())) {
      if (nullOrEmpty(feature.getTags())) {
        continue;
      }
      // Older rows predate the FQN being persisted on the feature, so derive it the way
      // MlModelRepository does rather than trusting what is stored.
      String featureFqn =
          nullOrEmpty(feature.getFullyQualifiedName())
              ? FullyQualifiedName.add(model.getFullyQualifiedName(), feature.getName())
              : feature.getFullyQualifiedName();
      for (TagLabel tag : feature.getTags()) {
        if (TagLabel.LabelType.DERIVED.equals(tag.getLabelType())) {
          // Derived tags are recomputed from their parent, never stored, matching applyTags.
          continue;
        }
        collectionDAO
            .tagUsageDAO()
            .applyTag(
                tag.getSource().ordinal(),
                tag.getTagFQN(),
                tag.getTagFQN(),
                featureFqn,
                tag.getLabelType().ordinal(),
                tag.getState().ordinal(),
                tag.getReason(),
                tag.getAppliedBy(),
                tag.getMetadata());
        applied++;
      }
    }
    return applied;
  }
}

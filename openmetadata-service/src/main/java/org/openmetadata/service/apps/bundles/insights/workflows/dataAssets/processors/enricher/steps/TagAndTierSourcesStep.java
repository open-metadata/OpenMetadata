/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps;

import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;

/**
 * Emits {@code tagSources} and {@code tierSources} counts plus the source-split tag projections
 * {@code classificationTags} and {@code glossaryTags} (entity-level FQN lists), mirroring the live
 * search index's {@link ParseTags}/{@code TaggableIndex.applyTagFields} semantics so Data Insights
 * chart filters match Explore. The defensive null-guards against malformed {@link
 * org.openmetadata.schema.type.TagLabel}s (null {@code labelType} or null {@code tagFQN}) live at
 * the source in {@link SearchIndexUtils#processTagAndTierSources} — applies to every caller of that
 * helper, not just this step.
 */
public final class TagAndTierSourcesStep implements EnrichmentStep {

  public static final String NAME = "tagAndTierSources";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    SearchIndexUtils.TagAndTierSources sources =
        SearchIndexUtils.processTagAndTierSources(target.entity());
    target.entityMap().put("tagSources", sources.getTagSources());
    target.entityMap().put("tierSources", sources.getTierSources());

    // Get nested tags for complex entities (e.g. tables, topics, etc.)
    List<TagLabel> allTags = Entity.getEntityTags(target.context().entityType(), target.entity());
    if (allTags != null) {
      List<TagLabel> safeTags =
          allTags.stream()
              .filter(Objects::nonNull)
              .filter(t -> t.getTagFQN() != null && t.getSource() != null)
              .toList();
      ParseTags parseTags = new ParseTags(safeTags);
      target.entityMap().put("classificationTags", parseTags.getClassificationTags());
      target.entityMap().put("glossaryTags", parseTags.getGlossaryTags());
    }
  }
}

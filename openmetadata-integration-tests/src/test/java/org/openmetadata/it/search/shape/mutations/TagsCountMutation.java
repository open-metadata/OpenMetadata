/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape.mutations;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeMutation;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration.SearchType;
import org.openmetadata.schema.type.TagLabel;

public final class TagsCountMutation implements ShapeMutation {
  @Override
  public String dimension() {
    return "tags.count";
  }

  @Override
  public boolean appliesTo(final EntityInterface entity) {
    return true;
  }

  @Override
  public List<Rung> ladder() {
    return List.of(Rung.of("10", 10), Rung.of("1k", 1_000), Rung.of("50k", 50_000));
  }

  @Override
  public EntityInterface apply(final EntityInterface entity, final Rung rung) {
    final List<TagLabel> tags = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      tags.add(
          new TagLabel()
              .withTagFQN("ShapeCanary.tag_" + i)
              .withName("tag_" + i)
              .withSource(TagLabel.TagSource.CLASSIFICATION)
              .withLabelType(TagLabel.LabelType.MANUAL)
              .withState(TagLabel.State.CONFIRMED));
    }
    entity.setTags(tags);
    return entity;
  }

  @Override
  public Outcome expected(final Rung rung, final SearchType engine) {
    return Outcome.OK;
  }
}

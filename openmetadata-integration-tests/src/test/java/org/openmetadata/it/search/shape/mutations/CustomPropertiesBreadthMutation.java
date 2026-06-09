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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeMutation;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration.SearchType;

public final class CustomPropertiesBreadthMutation implements ShapeMutation {
  @Override
  public String dimension() {
    return "customProperties.breadth";
  }

  @Override
  public boolean appliesTo(final EntityInterface entity) {
    return !(entity instanceof GlossaryTerm);
  }

  @Override
  public List<Rung> ladder() {
    return List.of(Rung.of("100", 100), Rung.of("2k", 2_000));
  }

  @Override
  public EntityInterface apply(final EntityInterface entity, final Rung rung) {
    final Map<String, Object> props = new LinkedHashMap<>();
    for (int i = 0; i < rung.magnitude(); i++) {
      props.put("prop_" + i, "value_" + i);
    }
    entity.setExtension(props);
    return entity;
  }

  @Override
  public Outcome expected(final Rung rung, final SearchType engine) {
    return Outcome.OK;
  }
}

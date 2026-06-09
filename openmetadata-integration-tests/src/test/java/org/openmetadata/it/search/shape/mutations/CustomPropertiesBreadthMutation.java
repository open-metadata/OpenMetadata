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
import java.util.Set;
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeMutation;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration.SearchType;
import org.openmetadata.service.Entity;

public final class CustomPropertiesBreadthMutation implements ShapeMutation {
  private static final int FIELD_LIMIT_RUNG = 2_000;

  /**
   * Entity types whose index mapping lets a wide bag of custom properties inflate the dynamic field
   * count past the per-index total-fields limit, so the doc is rejected. The other entities stay
   * {@code OK} for one of two distinct reasons, not a single shared "absorb":
   *
   * <ul>
   *   <li>Entities with a {@code flattened} extension mapping (table/container/dashboard/topic/
   *       storedProcedure) collapse every custom-property key into a single field, so breadth never
   *       grows the field count.
   *   <li>Entities with no {@code extension} property in their schema (e.g. query) never carry the
   *       props onto the document at all, so there is nothing to map.
   * </ul>
   *
   * <p>{@code glossaryTerm} and {@code metric} are the failures: each has an {@code extension} schema
   * property (so the props are carried) but a non-{@code flattened} mapping, so each key becomes its
   * own dynamic field and {@code 2k} keys cross the total-fields limit.
   */
  private static final Set<String> REJECTS_AT_FIELD_LIMIT =
      Set.of(Entity.GLOSSARY_TERM, Entity.METRIC);

  @Override
  public String dimension() {
    return "customProperties.breadth";
  }

  @Override
  public boolean appliesTo(final EntityInterface entity) {
    return true;
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
  public Outcome expected(final Rung rung, final SearchType engine, final String entityType) {
    final Outcome outcome;
    if (rung.magnitude() >= FIELD_LIMIT_RUNG && REJECTS_AT_FIELD_LIMIT.contains(entityType)) {
      outcome = Outcome.REJECT_FIELDS;
    } else {
      outcome = Outcome.OK;
    }
    return outcome;
  }
}

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
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeMutation;
import org.openmetadata.schema.EntityInterface;

public final class CustomPropertiesBreadthMutation implements ShapeMutation {

  @Override
  public String dimension() {
    return "customProperties.breadth";
  }

  /**
   * Only entity types whose generated class overrides {@link EntityInterface#getExtension()} put the
   * {@code extension} map into their search document. For the rest, {@code setExtension} is the
   * no-op interface default, so ramping custom properties would index nothing and the case would
   * pass trivially — masking the very gap this dimension exists to catch. Checking the declaring
   * class (not {@code getExtension() != null}, which is always null on the un-mutated entity) keeps
   * the filter type-aware.
   */
  @Override
  public boolean appliesTo(final EntityInterface entity) {
    boolean serializesExtension;
    try {
      serializesExtension =
          entity.getClass().getMethod("getExtension").getDeclaringClass() != EntityInterface.class;
    } catch (final NoSuchMethodException impossible) {
      serializesExtension = false;
    }
    return serializesExtension;
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
}

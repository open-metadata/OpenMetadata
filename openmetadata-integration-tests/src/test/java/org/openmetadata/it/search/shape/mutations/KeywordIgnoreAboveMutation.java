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

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.openmetadata.it.search.shape.FieldProbe;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeMutation;
import org.openmetadata.schema.EntityInterface;

public final class KeywordIgnoreAboveMutation implements ShapeMutation {
  private static final int OVER_IGNORE_ABOVE = 300;

  @Override
  public String dimension() {
    return "keyword.overIgnoreAbove";
  }

  @Override
  public boolean appliesTo(final EntityInterface entity) {
    return true;
  }

  @Override
  public List<Rung> ladder() {
    return List.of(Rung.of("300chars", OVER_IGNORE_ABOVE));
  }

  @Override
  public EntityInterface apply(final EntityInterface entity, final Rung rung) {
    entity.setDisplayName(value(rung));
    return entity;
  }

  @Override
  public FieldProbe probe(final Rung rung) {
    final String value = value(rung);
    return (httpSearch, indexName) -> {
      final String body = "{\"query\":{\"term\":{\"displayName.keyword\":\"" + value + "\"}}}";
      final JsonNode response = httpSearch.post("/" + indexName + "/_search", body);
      return response.path("hits").path("total").path("value").asLong(0) > 0;
    };
  }

  private static String value(final Rung rung) {
    return "d".repeat(rung.magnitude());
  }
}

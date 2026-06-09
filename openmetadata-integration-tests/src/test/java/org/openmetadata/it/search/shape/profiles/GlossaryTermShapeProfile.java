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
package org.openmetadata.it.search.shape.profiles;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.it.search.shape.EntityCases;
import org.openmetadata.it.search.shape.EntityShapeProfile;
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.PlannedCase;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

public final class GlossaryTermShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.GLOSSARY_TERM;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new GlossaryTerm()
        .withId(ctx.id())
        .withName("term")
        .withFullyQualifiedName("shapeCanaryGlossary." + ctx.unique("term"))
        .withGlossary(
            new EntityReference().withId(UUID.randomUUID()).withType("glossary").withName("g"));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("synonyms.count", Rung.of("1k", 1_000), this::synonyms, e -> Outcome.OK)
        .add("synonyms.count", Rung.of("100k", 100_000), this::synonyms, e -> Outcome.OK)
        .add("customProperties.breadth", Rung.of("100", 100), this::customProps, e -> Outcome.OK)
        .add(
            "customProperties.breadth",
            Rung.of("2k", 2_000),
            this::customProps,
            e -> Outcome.REJECT_FIELDS)
        .build();
  }

  private EntityInterface synonyms(final EntityInterface entity, final Rung rung) {
    final GlossaryTerm term = (GlossaryTerm) entity;
    final List<String> synonyms = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      synonyms.add("synonym_" + i);
    }
    term.setSynonyms(synonyms);
    return term;
  }

  private EntityInterface customProps(final EntityInterface entity, final Rung rung) {
    final Map<String, Object> props = new LinkedHashMap<>();
    for (int i = 0; i < rung.magnitude(); i++) {
      props.put("prop_" + i, "value_" + i);
    }
    entity.setExtension(props);
    return entity;
  }
}

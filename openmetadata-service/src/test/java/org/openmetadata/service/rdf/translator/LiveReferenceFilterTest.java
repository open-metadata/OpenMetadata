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
package org.openmetadata.service.rdf.translator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

class LiveReferenceFilterTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String LIVE_TAG = "PII.Sensitive";
  private static final String DELETED_TERM = "Retired.Revenue";
  private static final UUID LIVE_TAG_ID = UUID.randomUUID();

  private final List<Set<String>> lookups = new ArrayList<>();
  private final LiveTagLookup lookup =
      (type, fqns) -> {
        lookups.add(fqns);
        return Entity.TAG.equals(type) && fqns.contains(LIVE_TAG)
            ? Map.of(LIVE_TAG, LIVE_TAG_ID)
            : Map.of();
      };
  private final EntityReference liveChart = reference("chart", false);
  private final EntityReference deletedChart = reference("chart", true);
  private final EntityReference deletedOwner = reference("user", true);
  private final Dashboard dashboard =
      new Dashboard()
          .withId(UUID.randomUUID())
          .withName("revenue")
          .withFullyQualifiedName("looker.revenue")
          .withCharts(List.of(liveChart, deletedChart))
          .withOwners(List.of(deletedOwner))
          .withTags(
              List.of(
                  label(LIVE_TAG, TagLabel.TagSource.CLASSIFICATION),
                  label(DELETED_TERM, TagLabel.TagSource.GLOSSARY)));

  @BeforeAll
  static void registerType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("dashboard", Entity.DASHBOARD);
  }

  @Test
  void graphProjectionLeavesOutDeletedReferencesAndLabelsWhoseTagIsNotLive() {
    final Model model = translate(ReferenceScope.LIVE);
    try {
      final Resource subject = model.createResource(uri(Entity.DASHBOARD, dashboard.getId()));
      assertTrue(model.contains(subject, null, model.createResource(uri(liveChart))));
      assertFalse(mentions(model, uri(deletedChart)));
      assertFalse(mentions(model, uri(deletedOwner)));
      assertTrue(
          model.contains(
              subject,
              model.createProperty(OM + "hasTag"),
              model.createResource(uri(Entity.TAG, LIVE_TAG_ID))));
      assertFalse(model.contains(null, model.createProperty(OM + "tagFQN"), DELETED_TERM));
      assertFalse(model.contains(subject, model.createProperty(OM + "hasGlossaryTerm")));
    } finally {
      model.close();
    }
  }

  @Test
  void storedRenderingKeepsEveryReferenceAndLabel() {
    final Model model = translate(ReferenceScope.ALL);
    try {
      assertTrue(mentions(model, uri(deletedChart)));
      assertTrue(model.contains(null, model.createProperty(OM + "tagFQN"), DELETED_TERM));
    } finally {
      model.close();
    }
  }

  @Test
  void labelsOfOneEntityAreResolvedWithOneLookupPerLabelType() {
    translate(ReferenceScope.LIVE).close();
    assertEquals(Set.of(Set.of(LIVE_TAG), Set.of(DELETED_TERM)), Set.copyOf(lookups));
  }

  @Test
  void aReindexPageTranslatesEachEntityAsTheLiveWritePathDoes() {
    final JsonLdTranslator translator =
        new JsonLdTranslator(new ObjectMapper(), BASE, lookup, ReferenceScope.LIVE);
    final Model single = translator.toRdf(dashboard);
    final Model paged = translator.page(List.of(dashboard)).toRdf(dashboard);
    try {
      assertTrue(paged.isIsomorphicWith(single));
    } finally {
      single.close();
      paged.close();
    }
  }

  private Model translate(final ReferenceScope scope) {
    return new JsonLdTranslator(new ObjectMapper(), BASE, lookup, scope).toRdf(dashboard);
  }

  private static boolean mentions(final Model model, final String resourceUri) {
    final Resource resource = model.createResource(resourceUri);
    return model.contains(resource, null, (RDFNode) null) || model.contains(null, null, resource);
  }

  private static EntityReference reference(final String type, final boolean deleted) {
    final UUID id = UUID.randomUUID();
    return new EntityReference()
        .withId(id)
        .withType(type)
        .withName(type + id)
        .withFullyQualifiedName(type + id)
        .withDeleted(deleted);
  }

  private static TagLabel label(final String fqn, final TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static String uri(final EntityReference reference) {
    return uri(reference.getType(), reference.getId());
  }

  private static String uri(final String type, final UUID id) {
    return BASE + "entity/" + type + "/" + id;
  }
}

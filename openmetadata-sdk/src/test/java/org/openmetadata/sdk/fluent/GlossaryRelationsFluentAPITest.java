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
package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;
import org.openmetadata.sdk.services.system.SystemSettingsService;

/**
 * Verifies the fluent surface over glossary term relations: the relation type vocabulary is
 * readable through {@link GlossaryRelationTypes}, and remove/graph have fluent builders alongside
 * the existing {@code relateTo}. The service layer is mocked so each test asserts the call the
 * fluent builder ends up making.
 */
class GlossaryRelationsFluentAPITest {

  private static final String PRESCRIBES = "prescribes";

  private OpenMetadataClient client;
  private SystemSettingsService settings;
  private GlossaryTermService glossaryTerms;

  @BeforeEach
  void setUp() {
    client = mock(OpenMetadataClient.class);
    settings = mock(SystemSettingsService.class);
    glossaryTerms = mock(GlossaryTermService.class);
    when(client.settings()).thenReturn(settings);
    when(client.glossaryTerms()).thenReturn(glossaryTerms);
    GlossaryRelationTypes.setDefaultClient(client);
    GlossaryTerms.setDefaultClient(client);
  }

  @Test
  void listReturnsConfiguredRelationTypes() {
    when(settings.glossaryRelationTypes()).thenReturn(configuredTypes());

    List<GlossaryTermRelationType> relationTypes = GlossaryRelationTypes.list().fetch();

    assertEquals(2, relationTypes.size());
    assertEquals(List.of(PRESCRIBES, "broader"), GlossaryRelationTypes.list().names());
  }

  @Test
  void listFiltersByCategory() {
    when(settings.glossaryRelationTypes()).thenReturn(configuredTypes());

    List<GlossaryTermRelationType> hierarchical =
        GlossaryRelationTypes.list().inCategory(RelationCategory.HIERARCHICAL).fetch();

    assertEquals(1, hierarchical.size());
    assertEquals("broader", hierarchical.get(0).getName());
  }

  @Test
  void findLocatesRelationTypeByName() {
    when(settings.glossaryRelationTypes()).thenReturn(configuredTypes());

    assertTrue(GlossaryRelationTypes.find(PRESCRIBES).isPresent());
    assertEquals(PRESCRIBES, GlossaryRelationTypes.find(PRESCRIBES).get().getName());
    assertTrue(GlossaryRelationTypes.exists(PRESCRIBES));
    assertFalse(GlossaryRelationTypes.exists("unconfigured"));
  }

  @Test
  void settingsReturnsWholeRelationConfiguration() {
    GlossaryTermRelationSettings configuration =
        new GlossaryTermRelationSettings().withRelationTypes(configuredTypes());
    when(settings.getGlossaryRelationSettings()).thenReturn(configuration);

    assertSame(configuration, GlossaryRelationTypes.settings());
  }

  @Test
  void usageReturnsPerTypeCounts() {
    when(glossaryTerms.relationTypeUsage()).thenReturn(Map.of(PRESCRIBES, 3));

    assertEquals(3, GlossaryRelationTypes.usage().get(PRESCRIBES));
  }

  @Test
  void defineDelegatesToSettingsService() {
    GlossaryTermRelationType newType = new GlossaryTermRelationType().withName(PRESCRIBES);
    GlossaryTermRelationSettings updated = new GlossaryTermRelationSettings();
    when(settings.defineGlossaryRelationType(newType)).thenReturn(updated);

    assertSame(updated, GlossaryRelationTypes.define(newType));
    verify(settings).defineGlossaryRelationType(newType);
  }

  @Test
  void unrelateFromRemovesASingleRelationType() {
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    GlossaryTerm updated = new GlossaryTerm();
    when(glossaryTerms.removeRelation(fromId, toId, PRESCRIBES)).thenReturn(updated);

    GlossaryTerm result =
        GlossaryTerms.find(fromId.toString()).unrelateFrom(toId.toString()).as(PRESCRIBES).apply();

    assertSame(updated, result);
    verify(glossaryTerms).removeRelation(fromId, toId, PRESCRIBES);
  }

  @Test
  void unrelateFromWithoutTypeRemovesEveryRelation() {
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    when(glossaryTerms.removeRelation(eq(fromId), eq(toId), isNull()))
        .thenReturn(new GlossaryTerm());

    GlossaryTerms.find(fromId.toString()).unrelateFrom(toId.toString()).apply();

    verify(glossaryTerms).removeRelation(eq(fromId), eq(toId), isNull());
  }

  @Test
  void unrelateFromResolvesFullyQualifiedNames() {
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    when(glossaryTerms.getByName("Medical.HCP")).thenReturn(new GlossaryTerm().withId(fromId));
    when(glossaryTerms.getByName("Medical.Drug")).thenReturn(new GlossaryTerm().withId(toId));
    when(glossaryTerms.removeRelation(fromId, toId, PRESCRIBES)).thenReturn(new GlossaryTerm());

    GlossaryTerms.findByName("Medical.HCP").unrelateFrom("Medical.Drug").as(PRESCRIBES).apply();

    verify(glossaryTerms).removeRelation(fromId, toId, PRESCRIBES);
  }

  @Test
  void relationsFetchesGraphWithDepthAndTypes() {
    UUID rootId = UUID.randomUUID();
    Map<String, Object> graph = Map.of("nodes", List.of(), "edges", List.of());
    when(glossaryTerms.relationGraph(rootId, 2, List.of(PRESCRIBES, "treats"))).thenReturn(graph);

    Map<String, Object> result =
        GlossaryTerms.find(rootId.toString())
            .relations()
            .depth(2)
            .ofTypes(PRESCRIBES, "treats")
            .fetch();

    assertSame(graph, result);
    verify(glossaryTerms).relationGraph(rootId, 2, List.of(PRESCRIBES, "treats"));
  }

  @Test
  void relationsDefaultsToDepthOneAndAllTypes() {
    UUID rootId = UUID.randomUUID();
    when(glossaryTerms.relationGraph(rootId, 1, List.of())).thenReturn(Map.of());

    GlossaryTerms.find(rootId.toString()).relations().fetch();

    verify(glossaryTerms).relationGraph(rootId, 1, List.of());
  }

  private List<GlossaryTermRelationType> configuredTypes() {
    return List.of(
        new GlossaryTermRelationType()
            .withName(PRESCRIBES)
            .withDisplayName("Prescribes")
            .withCategory(RelationCategory.ASSOCIATIVE),
        new GlossaryTermRelationType()
            .withName("broader")
            .withDisplayName("Broader")
            .withCategory(RelationCategory.HIERARCHICAL));
  }
}

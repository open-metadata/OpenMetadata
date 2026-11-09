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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.DataQuality;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.LineageEdgeContext;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.SharedKnowledge;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;

class PersonaContextVisibilityTest {
  @Test
  void unknownIndexedIdentitiesAreNotAuthorized() {
    PersonaContextVisibility visibility = new PersonaContextVisibility(null, null);
    assertFalse(visibility.canView(null, "unknown.asset"));
    assertFalse(visibility.canView(Entity.TABLE, null));
    assertFalse(visibility.canView(Entity.TABLE, ""));
  }

  @Test
  void explicitMetricKeepsVisibleRelationshipsAndDropsDeniedAssets() {
    Metric metric =
        new Metric()
            .withName("Revenue")
            .withFullyQualifiedName("public.metric")
            .withAssets(
                List.of(
                    ref(Entity.DASHBOARD, "hidden.dashboard"), ref(Entity.TABLE, "public.table")))
            .withRelatedMetrics(List.of(ref(Entity.METRIC, "public.related.metric")));
    var source =
        new PersonaContextBuilder.SelectedEntity(
            "id", Map.of(), new AIContext().withEntityType(Entity.METRIC), null, metric, List.of());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      Metric filtered = (Metric) visibility().filter(source).knowledgeEntity();
      assertEquals(List.of(ref(Entity.TABLE, "public.table")), filtered.getAssets());
      assertEquals(metric.getRelatedMetrics(), filtered.getRelatedMetrics());
      assertEquals(2, metric.getAssets().size());
    }
  }

  @Test
  void explicitGlossaryKnowledgeKeepsItsVisibleRelatedTerms() {
    GlossaryTerm term =
        new GlossaryTerm()
            .withName("Revenue")
            .withFullyQualifiedName("public.revenue")
            .withRelatedTerms(
                List.of(new TermRelation().withTerm(ref(Entity.GLOSSARY_TERM, "public.income"))));
    var source =
        new PersonaContextBuilder.SelectedEntity(
            "id",
            Map.of(),
            new AIContext().withEntityType(Entity.GLOSSARY_TERM),
            null,
            term,
            List.of());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      var visibility =
          new PersonaContextVisibility(mock(Authorizer.class), mock(SecurityContext.class));
      GlossaryTerm filtered = (GlossaryTerm) visibility.filter(source).knowledgeEntity();
      assertEquals(term.getRelatedTerms(), filtered.getRelatedTerms());
      assertFalse(filtered == term);
    }
  }

  @Test
  void cachedObservabilityRespectsProfileAndTestPermissions() {
    AIContext context =
        new AIContext()
            .withEntityType(Entity.TABLE)
            .withFullyQualifiedName("public.table")
            .withObservability(
                new Observability()
                    .withRowCount(42.0)
                    .withProfiledAt(123L)
                    .withDataQuality(new DataQuality().withFailed(1)));
    var source =
        new PersonaContextBuilder.SelectedEntity("id", Map.of(), context, null, null, List.of());
    Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              OperationContext operation = invocation.getArgument(1);
              if (operation.getOperations(invocation.getArgument(2)).stream()
                  .anyMatch(
                      permission ->
                          permission == MetadataOperation.VIEW_DATA_PROFILE
                              || permission == MetadataOperation.VIEW_TESTS)) {
                throw new AuthorizationException("Field denied");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      PersonaContextVisibility visibility =
          new PersonaContextVisibility(authorizer, mock(SecurityContext.class));
      assertTrue(visibility.canView(Entity.TABLE, "public.table"));
      AIContext filtered = visibility.filter(source).context();
      assertNull(filtered.getObservability().getRowCount());
      assertNull(filtered.getObservability().getProfiledAt());
      assertNull(filtered.getObservability().getDataQuality());
      assertEquals(42.0, context.getObservability().getRowCount());
      assertEquals(1, context.getObservability().getDataQuality().getFailed());
    }
  }

  @Test
  void cachedKnowledgeColumnsAndLineageAreFilteredWithoutMutatingTheSource() {
    KnowledgeItem term =
        item(KnowledgeItem.Type.GLOSSARY_TERM, "hidden.term", "private definition");
    KnowledgeItem page = item(KnowledgeItem.Type.PAGE, "public.page", "public article");
    AIContext context =
        new AIContext()
            .withEntityType(Entity.TABLE)
            .withFullyQualifiedName("public.table")
            .withGlossaryTerms(List.of(term))
            .withArticles(List.of(page))
            .withAssetContext(
                new AssetContext()
                    .withTable(
                        new TableContext()
                            .withColumns(
                                List.of(
                                    new FieldContext()
                                        .withName("id")
                                        .withGlossaryTerms(List.of(term))))))
            .withUpstream(List.of("hidden.dashboard", "public.upstream"))
            .withUpstreamEdges(
                List.of(
                    new LineageEdgeContext().withFullyQualifiedName("hidden.dashboard"),
                    new LineageEdgeContext().withFullyQualifiedName("public.upstream")));
    var source =
        new PersonaContextBuilder.SelectedEntity(
            "id",
            Map.of(),
            context,
            null,
            null,
            List.of(
                ref(Entity.DASHBOARD, "hidden.dashboard"), ref(Entity.TABLE, "public.upstream")));
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      PersonaContextVisibility visibility = visibility();
      var filtered = visibility.filter(source);
      String json = JsonUtils.pojoToJson(filtered.context());
      assertFalse(json.contains("hidden.term"));
      assertFalse(json.contains("private definition"));
      assertFalse(json.contains("hidden.dashboard"));
      assertTrue(json.contains("public.upstream"));
      assertTrue(json.contains("public article"));
      assertTrue(JsonUtils.pojoToJson(source.context()).contains("private definition"));

      SharedKnowledge knowledge =
          visibility.filterSharedKnowledge(
              new SharedKnowledge()
                  .withGlossaryTerms(List.of(term))
                  .withArticles(
                      List.of(
                          page,
                          item(KnowledgeItem.Type.PAGE, "unreferenced.page", "unrelated content"))),
              List.of(
                  new PersonaContextBuilder.RuleMaterialization(
                      new ContextRule().withName("Tables").withEntityType(Entity.TABLE),
                      1,
                      List.of(filtered))));
      assertTrue(knowledge.getGlossaryTerms().isEmpty());
      assertEquals(List.of(page), knowledge.getArticles());
    }
  }

  @Test
  void explicitKnowledgeCannotRenderDeniedRelatedAssets() {
    Page page =
        new Page()
            .withName("Guide")
            .withFullyQualifiedName("public.guide")
            .withRelatedEntities(
                List.of(
                    ref(Entity.DASHBOARD, "hidden.dashboard"), ref(Entity.TABLE, "public.table")));
    var source =
        new PersonaContextBuilder.SelectedEntity(
            "id", Map.of(), new AIContext().withEntityType(Entity.PAGE), null, page, List.of());
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenReturn(mock(EntityRepository.class));
      Page filtered = (Page) visibility().filter(source).knowledgeEntity();
      assertEquals(List.of(ref(Entity.TABLE, "public.table")), filtered.getRelatedEntities());
      assertEquals(2, page.getRelatedEntities().size());
    }
  }

  private static PersonaContextVisibility visibility() {
    Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            invocation -> {
              OperationContext operation = invocation.getArgument(1);
              if (Set.of(Entity.GLOSSARY_TERM, Entity.DASHBOARD)
                  .contains(operation.getResource())) {
                throw new AuthorizationException("Denied");
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    return new PersonaContextVisibility(authorizer, mock(SecurityContext.class));
  }

  private static EntityReference ref(String type, String fqn) {
    return new EntityReference().withType(type).withFullyQualifiedName(fqn);
  }

  private static KnowledgeItem item(KnowledgeItem.Type type, String fqn, String content) {
    return new KnowledgeItem().withType(type).withFullyQualifiedName(fqn).withContent(content);
  }
}

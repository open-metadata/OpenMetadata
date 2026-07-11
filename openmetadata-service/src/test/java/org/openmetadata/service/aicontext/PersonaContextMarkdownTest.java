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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.type.aicontext.TableContext;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.schema.type.personaContext.SharedKnowledge;

class PersonaContextMarkdownTest {

  @Test
  void renderEnforcesTheHardBudgetAcrossAssetsAndSharedKnowledge() {
    String fullArticle = "A".repeat(3000);
    Persona persona = persona();
    PersonaContextDefinition definition =
        new PersonaContextDefinition().withMaxTotalChars(300).withRules(List.of(rule()));
    PersonaContext context =
        new PersonaContext()
            .withPersona(persona.getEntityReference())
            .withGeneratedAt(1782864000000L)
            .withSharedKnowledge(
                new SharedKnowledge()
                    .withArticles(
                        List.of(
                            new KnowledgeItem()
                                .withType(KnowledgeItem.Type.PAGE)
                                .withName("Revenue Rules")
                                .withFullyQualifiedName("kb.revenue")
                                .withContent(fullArticle))));

    PersonaContextBuilder.MaterializedPersonaContext result =
        PersonaContextMarkdown.render(
            persona, definition, List.of(materializedRule()), context, false);

    assertFalse(result.markdown().contains(fullArticle));
    assertEquals(300, result.markdown().length());
    assertTrue(Boolean.TRUE.equals(result.context().getTruncated()));
    assertEquals(2, result.context().getManifest().size());
  }

  @Test
  void knowledgeRulesHonorSectionsUnlessFullyRendered() {
    Persona persona = persona();
    ContextRule selectedRule =
        new ContextRule()
            .withName("Revenue metrics")
            .withEntityType("metric")
            .withSections(Set.of(ContextSection.DEFINITION))
            .withFullyRendered(false);
    Metric metric =
        new Metric()
            .withName("revenue")
            .withFullyQualifiedName("metrics.revenue")
            .withDescription("Recognized revenue after adjustments.")
            .withMetricExpression(new MetricExpression().withCode("SUM(order_total)"));
    KnowledgeItem item =
        new KnowledgeItem()
            .withType(KnowledgeItem.Type.METRIC)
            .withName("revenue")
            .withFullyQualifiedName("metrics.revenue")
            .withContent("Recognized revenue after adjustments.\nSUM(order_total)");
    AIContext aiContext =
        new AIContext()
            .withEntityType("metric")
            .withFullyQualifiedName("metrics.revenue")
            .withDisplayName("Revenue");
    PersonaContextBuilder.SelectedEntity selected =
        new PersonaContextBuilder.SelectedEntity(
            "33333333-3333-3333-3333-333333333333", Map.of(), aiContext, item, metric);
    PersonaContextDefinition definition =
        new PersonaContextDefinition().withCharacterBudget(50_000).withRules(List.of(selectedRule));
    PersonaContext context =
        new PersonaContext()
            .withPersona(persona.getEntityReference())
            .withGeneratedAt(1782864000000L)
            .withSharedKnowledge(new SharedKnowledge());

    String selectedMarkdown =
        PersonaContextMarkdown.render(
                persona,
                definition,
                List.of(
                    new PersonaContextBuilder.RuleMaterialization(
                        selectedRule, 1, List.of(selected))),
                context,
                false)
            .markdown();

    assertTrue(selectedMarkdown.contains("### Definition"));
    assertFalse(selectedMarkdown.contains("SUM(order_total)"));

    selectedRule.setFullyRendered(true);
    String fullMarkdown =
        PersonaContextMarkdown.render(
                persona,
                definition,
                List.of(
                    new PersonaContextBuilder.RuleMaterialization(
                        selectedRule, 1, List.of(selected))),
                new PersonaContext()
                    .withPersona(persona.getEntityReference())
                    .withGeneratedAt(1782864000000L)
                    .withSharedKnowledge(new SharedKnowledge()),
                false)
            .markdown();

    assertTrue(fullMarkdown.contains("SUM(order_total)"));
  }

  @Test
  void renderHonorsSelectedAssetSections() {
    Persona persona = persona();
    ContextRule selectedRule =
        rule().withSections(Set.of(ContextSection.DESCRIPTION, ContextSection.SCHEMA));
    PersonaContextDefinition definition =
        new PersonaContextDefinition().withMaxTotalChars(50_000).withRules(List.of(selectedRule));
    PersonaContext context =
        new PersonaContext()
            .withPersona(persona.getEntityReference())
            .withGeneratedAt(1782864000000L)
            .withSharedKnowledge(new SharedKnowledge());
    PersonaContextBuilder.RuleMaterialization materialization =
        new PersonaContextBuilder.RuleMaterialization(selectedRule, 1, List.of(selectedEntity()));

    String markdown =
        PersonaContextMarkdown.render(persona, definition, List.of(materialization), context, false)
            .markdown();

    assertTrue(markdown.contains("### Schema"));
    assertFalse(markdown.contains("Frequent Joins"));
    assertFalse(markdown.contains("Data Profile"));
  }

  @Test
  void fullyRenderedAssetRulesIgnoreSectionSelection() {
    Persona persona = persona();
    ContextRule selectedRule =
        rule().withSections(Set.of(ContextSection.DESCRIPTION)).withFullyRendered(true);
    PersonaContext context =
        new PersonaContext()
            .withPersona(persona.getEntityReference())
            .withGeneratedAt(1782864000000L)
            .withSharedKnowledge(new SharedKnowledge());

    String markdown =
        PersonaContextMarkdown.render(
                persona,
                new PersonaContextDefinition()
                    .withCharacterBudget(50_000)
                    .withRules(List.of(selectedRule)),
                List.of(
                    new PersonaContextBuilder.RuleMaterialization(
                        selectedRule, 1, List.of(selectedEntity()))),
                context,
                false)
            .markdown();

    assertTrue(markdown.contains("### Schema"));
  }

  @Test
  void definitionHashIsStableForEquivalentDefinitions() {
    PersonaContextDefinition first =
        new PersonaContextDefinition().withRules(List.of(rule())).withMaxTotalChars(400_000);
    PersonaContextDefinition second =
        new PersonaContextDefinition().withRules(List.of(rule())).withMaxTotalChars(400_000);

    assertEquals(
        PersonaContextHash.definitionHash(first), PersonaContextHash.definitionHash(second));
  }

  @Test
  void renderIncludesBatchedProfileSummaryAndCallerSensitivePointer() {
    Persona persona = persona();
    ContextRule selectedRule =
        rule().withSections(Set.of(ContextSection.DESCRIPTION, ContextSection.PROFILE));
    PersonaContextDefinition definition =
        new PersonaContextDefinition().withMaxTotalChars(50_000).withRules(List.of(selectedRule));
    PersonaContext context =
        new PersonaContext()
            .withPersona(persona.getEntityReference())
            .withGeneratedAt(1782864000000L)
            .withSharedKnowledge(new SharedKnowledge());
    PersonaContextBuilder.SelectedEntity selected = selectedEntity();
    selected
        .context()
        .withObservability(new Observability().withRowCount(42.0).withProfiledAt(1782864000000L));

    String markdown =
        PersonaContextMarkdown.render(
                persona,
                definition,
                List.of(
                    new PersonaContextBuilder.RuleMaterialization(
                        selectedRule, 1, List.of(selected))),
                context,
                false)
            .markdown();

    assertTrue(markdown.contains("**Row count:** 42"));
    assertTrue(markdown.contains("**Profiled at:** 2026-07-01T"));
    assertTrue(markdown.contains("Column-level profile details are caller-sensitive"));
    assertEquals(1, markdown.split("### Data Profile", -1).length - 1);
  }

  private static Persona persona() {
    return new Persona()
        .withId(UUID.fromString("11111111-1111-1111-1111-111111111111"))
        .withName("businessAnalyst")
        .withFullyQualifiedName("businessAnalyst")
        .withDisplayName("Business Analyst");
  }

  private static ContextRule rule() {
    return new ContextRule()
        .withName("Semantic tables")
        .withEntityType("table")
        .withMaxAssets(200)
        .withSections(Set.of(ContextSection.DESCRIPTION, ContextSection.SCHEMA));
  }

  private static PersonaContextBuilder.RuleMaterialization materializedRule() {
    return new PersonaContextBuilder.RuleMaterialization(rule(), 1, List.of(selectedEntity()));
  }

  private static PersonaContextBuilder.SelectedEntity selectedEntity() {
    AIContext context =
        new AIContext()
            .withEntityType("table")
            .withFullyQualifiedName("ecommerce.public.semantic.fact_orders")
            .withDisplayName("Fact Orders")
            .withDescription("One row per order.")
            .withAssetContext(
                new AssetContext()
                    .withTable(
                        new TableContext()
                            .withColumns(
                                List.of(
                                    new FieldContext()
                                        .withName("order_id")
                                        .withDataType("BIGINT")))));
    return new PersonaContextBuilder.SelectedEntity(
        "22222222-2222-2222-2222-222222222222", Map.of(), context, null, null);
  }
}

package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.service.Entity;

/**
 * A glossary term or metric reaches AI context as governed knowledge only once Approved; release
 * testing saw an In Review term called "the governed glossary definition"
 * (ADR:2026-11-03-only-approved-definitions-reach-ai-context-as-governed-knowledge).
 */
class GovernedDefinitionTest {

  private static Metric metric(EntityStatus status) {
    return new Metric()
        .withId(UUID.randomUUID())
        .withName("refund_rate")
        .withFullyQualifiedName("finance.refund_rate")
        .withDescription("Share of orders refunded.")
        .withEntityStatus(status);
  }

  @Test
  void onlyApprovedOrUnstatedDefinitionsGovern() {
    assertFalse(AIContextBuilder.isGovernedDefinition(metric(EntityStatus.IN_REVIEW)));
    assertFalse(
        AIContextBuilder.isGovernedDefinition(
            new GlossaryTerm().withEntityStatus(EntityStatus.DRAFT)));
    assertTrue(AIContextBuilder.isGovernedDefinition(metric(EntityStatus.APPROVED)));
    assertTrue(AIContextBuilder.isGovernedDefinition(metric(null)));
    assertTrue(AIContextBuilder.isGovernedDefinition(new Table().withName("orders")));
  }

  @Test
  void onlyAnApprovedDefinitionGetsConceptContext() {
    assertFalse(AIContextBuilder.hasConceptContext(metric(EntityStatus.IN_REVIEW)));
    assertFalse(
        AIContextBuilder.hasConceptContext(
            new GlossaryTerm().withEntityStatus(EntityStatus.REJECTED)));
    assertTrue(AIContextBuilder.hasConceptContext(metric(EntityStatus.APPROVED)));
    assertFalse(AIContextBuilder.hasConceptContext(new Table().withName("orders")));
  }

  @Test
  void anUnapprovedMetricIsNoKnowledgeItem() {
    assertNull(PersonaContextBuilder.fullKnowledgeItem(Entity.METRIC, metric(EntityStatus.DRAFT)));
    assertNotNull(
        PersonaContextBuilder.fullKnowledgeItem(Entity.METRIC, metric(EntityStatus.APPROVED)));
  }

  /** A Draft metric applied to a selected asset used to throw and fail the whole persona build. */
  @Test
  void anUnapprovedMetricOnAPersonaAssetAttachesNothing() {
    AIContext context = new AIContext();
    List<KnowledgeItem> collected = new ArrayList<>();

    PersonaContextBuilder.attachFullKnowledge(
        Entity.METRIC, metric(EntityStatus.DRAFT), context, collected::add);
    assertTrue(collected.isEmpty());
    assertTrue(context.getMetrics() == null || context.getMetrics().isEmpty());

    PersonaContextBuilder.attachFullKnowledge(
        Entity.METRIC, metric(EntityStatus.APPROVED), context, collected::add);
    assertEquals(1, collected.size());
    assertEquals(1, context.getMetrics().size());
  }

  /** Metrics applied to, or related to, the anchor reach its context and its concept only Approved. */
  @Test
  void anAnchorsUnapprovedMetricIsNotInItsContext() {
    assertNull(AIContextBuilder.metricKnowledgeItem(metric(EntityStatus.IN_REVIEW), true));
    assertNull(AIContextBuilder.metricKnowledgeItem(metric(EntityStatus.APPROVED), false));
    assertNotNull(AIContextBuilder.metricKnowledgeItem(metric(EntityStatus.APPROVED), true));
  }

  @Test
  void searchContextDropsAnUnapprovedMetricLikeAnUnapprovedTerm() {
    assertFalse(
        AIContextFinder.isApprovedForContext(
            Map.of("entityStatus", "In Review"), KnowledgeItem.Type.METRIC));
    assertTrue(
        AIContextFinder.isApprovedForContext(
            Map.of("entityStatus", "Approved"), KnowledgeItem.Type.METRIC));
    assertTrue(AIContextFinder.isApprovedForContext(Map.of(), KnowledgeItem.Type.METRIC));
    assertTrue(
        AIContextFinder.isApprovedForContext(
            Map.of("entityStatus", "Draft"), KnowledgeItem.Type.PAGE));
  }
}

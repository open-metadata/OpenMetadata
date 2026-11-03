package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
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

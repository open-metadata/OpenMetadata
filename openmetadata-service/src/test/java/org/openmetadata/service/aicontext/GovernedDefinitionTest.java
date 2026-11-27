package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

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
    AIContextFinder finder = new AIContextFinder();
    assertFalse(
        finder.isApprovedForContext(
            Map.of("entityStatus", "In Review"), KnowledgeItem.Type.METRIC));
    assertTrue(
        finder.isApprovedForContext(Map.of("entityStatus", "Approved"), KnowledgeItem.Type.METRIC));
    assertFalse(
        finder.isApprovedForContext(Map.of(), KnowledgeItem.Type.METRIC),
        "a hit with no stage and no entity to read one from is not an Approved definition");
    assertTrue(
        finder.isApprovedForContext(Map.of("entityStatus", "Draft"), KnowledgeItem.Type.PAGE));
  }

  /**
   * Vector chunk docs carry no stage: a Draft or In Review definition used to reach search-found
   * context through them as governed knowledge.
   */
  @Test
  void aChunkHitIsJudgedOnItsEntitysStage() {
    UUID termId = UUID.randomUUID();
    UUID metricId = UUID.randomUUID();
    AIContextFinder finder = new AIContextFinder();
    Map<String, KnowledgeItem> items = new LinkedHashMap<>();
    Map<String, AIContextFinder.CandidateAsset> candidates = new LinkedHashMap<>();

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityRepository(Entity.METRIC))
          .thenReturn(mock(EntityRepository.class));
      entity
          .when(() -> Entity.getEntityOrNull(Entity.GLOSSARY_TERM, termId, "", NON_DELETED))
          .thenReturn(new GlossaryTerm().withEntityStatus(EntityStatus.IN_REVIEW));
      entity
          .when(() -> Entity.getEntityOrNull(Entity.METRIC, metricId, "", NON_DELETED))
          .thenReturn(metric(EntityStatus.APPROVED));

      finder.collectHit(
          chunkHit(Entity.GLOSSARY_TERM, "Business.Churn", termId, 0), items, candidates);
      finder.collectHit(
          chunkHit(Entity.GLOSSARY_TERM, "Business.Churn", termId, 1), items, candidates);
      finder.collectHit(
          chunkHit(Entity.METRIC, "finance.refund_rate", metricId, 1), items, candidates);

      assertEquals(
          List.of("metric:finance.refund_rate"),
          List.copyOf(items.keySet()),
          "the In Review term's chunks are dropped; the Approved metric's chunk is kept");
      entity.verify(
          () -> Entity.getEntityOrNull(Entity.GLOSSARY_TERM, termId, "", NON_DELETED), times(1));
    }
  }

  @Test
  void aChunkHitWhoseEntityCannotBeReadIsDropped() {
    AIContextFinder finder = new AIContextFinder();
    UUID goneId = UUID.randomUUID();
    UUID unreadableId = UUID.randomUUID();

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityOrNull(Entity.METRIC, unreadableId, "", NON_DELETED))
          .thenThrow(new IllegalStateException("cache unavailable"));

      assertFalse(
          finder.isApprovedForContext(
              chunkHit(Entity.METRIC, "finance.gone", goneId, 0), KnowledgeItem.Type.METRIC));
      assertFalse(
          finder.isApprovedForContext(
              chunkHit(Entity.METRIC, "finance.unreadable", unreadableId, 0),
              KnowledgeItem.Type.METRIC));
    }
  }

  /** A hit as the chunk index returns it: the entity id only as {@code parentId}, and no stage. */
  private static Map<String, Object> chunkHit(
      String entityType, String fqn, UUID parentId, int chunkIndex) {
    return Map.of(
        "entityType", entityType,
        "fullyQualifiedName", fqn,
        "name", fqn,
        "parentId", parentId.toString(),
        "chunkIndex", chunkIndex,
        "chunkCount", 2,
        "textToLLMContext", "A definition | chunk " + (chunkIndex + 1) + "/2");
  }
}

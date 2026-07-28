package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;

// #30555: scoping filters must match a thread against its parent entity, never pass it through.
class AlertsRuleEvaluatorThreadScopeTest {

  private static final String TERM_FQN = "glossary.term";
  private static final String OTHER_TERM_FQN = "glossary.otherTerm";
  private static final UUID TERM_ID = UUID.randomUUID();

  @Test
  void matchAnyEntityFqn_threadAboutListedEntity_returnsTrue() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef(TERM_FQN));
    assertTrue(evaluator.matchAnyEntityFqn(List.of(TERM_FQN)));
  }

  @Test
  void matchAnyEntityFqn_threadAboutOtherEntity_returnsFalse() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef(TERM_FQN));
    assertFalse(evaluator.matchAnyEntityFqn(List.of(OTHER_TERM_FQN)));
  }

  @Test
  void matchAnyEntityFqn_threadAboutDescendantOfListedEntity_returnsTrue() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef("glossary.term.child"));
    assertTrue(evaluator.matchAnyEntityFqn(List.of("glossary.term")));
  }

  @Test
  void matchAnyEntityFqn_threadAboutSiblingWithSharedPrefix_returnsFalse() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef("glossary.termOther"));
    assertFalse(evaluator.matchAnyEntityFqn(List.of("glossary.term")));
  }

  @Test
  void matchAnyEntityId_threadAboutListedEntity_returnsTrue() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef(TERM_FQN));
    assertTrue(evaluator.matchAnyEntityId(List.of(TERM_ID.toString())));
  }

  @Test
  void matchAnyEntityId_threadAboutOtherEntity_returnsFalse() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef(TERM_FQN));
    assertFalse(evaluator.matchAnyEntityId(List.of(UUID.randomUUID().toString())));
  }

  @Test
  void matchAnyEntityId_malformedFilterValue_isSkippedInsteadOfThrowing() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef(TERM_FQN));
    assertFalse(evaluator.matchAnyEntityId(List.of("not-a-uuid")));
    assertTrue(evaluator.matchAnyEntityId(List.of("not-a-uuid", TERM_ID.toString())));
  }

  @Test
  void matchAnySource_threadAboutListedEntityType_returnsTrue() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef(TERM_FQN));
    assertTrue(evaluator.matchAnySource(List.of("glossaryTerm")));
  }

  @Test
  void matchAnySource_threadAboutOtherEntityType_returnsFalse() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(termRef(TERM_FQN));
    assertFalse(evaluator.matchAnySource(List.of("table")));
  }

  @Test
  void scopingFilters_threadWithoutEntityRef_returnFalse() {
    AlertsRuleEvaluator evaluator = evaluatorForThreadAbout(null);
    assertFalse(evaluator.matchAnyEntityFqn(List.of(TERM_FQN)));
    assertFalse(evaluator.matchAnyEntityId(List.of(TERM_ID.toString())));
    assertFalse(evaluator.matchAnySource(List.of("glossaryTerm")));
    assertFalse(evaluator.matchAnyOwnerName(List.of("admin")));
    assertFalse(evaluator.matchAnyDomain(List.of("domain")));
  }

  private static AlertsRuleEvaluator evaluatorForThreadAbout(EntityReference parent) {
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withType(ThreadType.Conversation)
            .withEntityRef(parent);
    ChangeEvent event =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.THREAD_CREATED)
            .withEntityType(Entity.THREAD)
            .withEntity(thread);
    return new AlertsRuleEvaluator(event);
  }

  private static EntityReference termRef(String fqn) {
    return new EntityReference()
        .withId(TERM_ID)
        .withType("glossaryTerm")
        .withFullyQualifiedName(fqn);
  }
}

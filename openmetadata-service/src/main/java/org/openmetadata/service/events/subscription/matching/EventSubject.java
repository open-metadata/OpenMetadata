package org.openmetadata.service.events.subscription.matching;

import java.util.Locale;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;

/**
 * What an event is about. A change event is about the entity that changed. A conversation, and a
 * legacy thread, is about another entity, and that entity is its subject. Tasks and announcements
 * are entities, so their events are change events about themselves.
 *
 * @param ownType the type of the event itself, such as conversation
 * @param subjectType the type of the entity the event is about; null when it cannot be told
 * @param changeEvent false for a conversation or a thread, which no trigger applies to
 */
public record EventSubject(String ownType, String subjectType, boolean changeEvent) {

  public static final String CONVERSATION = "conversation";

  public static EventSubject of(ChangeEvent event) {
    EventSubject subject;
    if (CONVERSATION.equals(event.getEntityType())) {
      Conversation conversation = AlertsRuleEvaluator.getConversation(event);
      subject = new EventSubject(CONVERSATION, typeOf(conversation.getEntityRef()), false);
    } else if (Entity.THREAD.equals(event.getEntityType())) {
      Thread thread = AlertsRuleEvaluator.getThread(event);
      String threadType = thread.getType().value().toLowerCase(Locale.ROOT);
      subject = new EventSubject(threadType, typeOf(thread.getEntityRef()), false);
    } else {
      subject = new EventSubject(event.getEntityType(), event.getEntityType(), true);
    }
    return subject;
  }

  private static String typeOf(EntityReference reference) {
    return reference == null ? null : reference.getType();
  }
}

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

package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Verifies the precise-mention semantics of {@link AlertsRuleEvaluator#getTaskMentions}: a task
 * mention notification must fire only for the comment that triggered the event, never re-notify
 * earlier comments' mentionees, and never fire on non-comment task updates.
 */
class AlertsRuleEvaluatorTaskMentionsTest {

  private TaskComment comment(String message) {
    return new TaskComment().withMessage(message);
  }

  private ChangeDescription added(String field, Object newValue) {
    return new ChangeDescription()
        .withFieldsAdded(List.of(new FieldChange().withName(field).withNewValue(newValue)));
  }

  private ChangeDescription updated(String field) {
    return new ChangeDescription().withFieldsUpdated(List.of(new FieldChange().withName(field)));
  }

  @Test
  void commentAdd_returnsOnlyTheNewlyAddedCommentMention() {
    Task task =
        new Task()
            .withComments(
                List.of(comment("first <#E::user::alice>"), comment("second <#E::user::bob>")))
            .withChangeDescription(added("comments", "second <#E::user::bob>"));

    List<MessageParser.EntityLink> mentions = AlertsRuleEvaluator.getTaskMentions(task);

    assertEquals(1, mentions.size(), () -> mentions.toString());
    assertEquals("bob", mentions.get(0).getEntityFQN()); // not alice (a prior comment)
  }

  @Test
  void assigneeChange_returnsNoMentions() {
    Task task =
        new Task()
            .withComments(List.of(comment("ping <#E::user::alice>")))
            .withChangeDescription(updated("assignees"));

    assertTrue(AlertsRuleEvaluator.getTaskMentions(task).isEmpty());
  }

  @Test
  void noChangeDescription_fallsBackToLatestComment() {
    Task task =
        new Task()
            .withComments(
                List.of(comment("old <#E::user::alice>"), comment("new <#E::user::bob>")));

    List<MessageParser.EntityLink> mentions = AlertsRuleEvaluator.getTaskMentions(task);

    assertEquals(1, mentions.size());
    assertEquals("bob", mentions.get(0).getEntityFQN());
  }

  @Test
  void noChangeDescriptionNoComments_fallsBackToDescription() {
    Task task = new Task().withDescription("incident for <#E::user::carol>");

    List<MessageParser.EntityLink> mentions = AlertsRuleEvaluator.getTaskMentions(task);

    assertEquals(1, mentions.size());
    assertEquals("carol", mentions.get(0).getEntityFQN());
  }
}

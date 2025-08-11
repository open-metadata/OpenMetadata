package org.openmetadata.service.resources.feeds;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.CreateTaskDetails;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.service.Entity;

public class FeedMapper {
  public Thread createToEntity(CreateThread create, String user) {
    UUID randomUUID = UUID.randomUUID();
    return new Thread()
        .withId(randomUUID)
        .withThreadTs(System.currentTimeMillis())
        .withMessage(create.getMessage())
        .withCreatedBy(create.getFrom())
        .withAbout(create.getAbout())
        .withAddressedTo(create.getAddressedTo())
        .withReactions(Collections.emptyList())
        .withType(create.getType())
        .withTask(getTaskDetails(create.getTaskDetails()))
        .withAnnouncement(create.getAnnouncementDetails())
        .withChatbot(create.getChatbotDetails())
        .withUpdatedBy(user)
        .withUpdatedAt(System.currentTimeMillis())
        .withEntityRef(new EntityReference().withId(randomUUID).withType(Entity.THREAD))
        .withGeneratedBy(Thread.GeneratedBy.USER)
        .withDomains(create.getDomains());
  }

  private TaskDetails getTaskDetails(CreateTaskDetails create) {
    if (create != null) {
      return new TaskDetails()
          .withAssignees(formatAssignees(create.getAssignees()))
          .withType(create.getType())
          .withStatus(TaskStatus.Open)
          .withOldValue(create.getOldValue())
          .withSuggestion(create.getSuggestion());
    }
    return null;
  }

  public static List<EntityReference> formatAssignees(List<EntityReference> assignees) {
    List<EntityReference> result = new ArrayList<>();
    assignees.forEach(
        assignee ->
            result.add(
                new EntityReference().withId(assignee.getId()).withType(assignee.getType())));
    return result;
  }
}

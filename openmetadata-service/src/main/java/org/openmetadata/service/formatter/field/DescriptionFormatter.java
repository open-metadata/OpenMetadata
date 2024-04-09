package org.openmetadata.service.formatter.field;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;

import org.openmetadata.schema.entity.feed.DescriptionFeedInfo;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

public class DescriptionFormatter extends DefaultFieldFormatter {
  private static final String HEADER_MESSAGE = "%s %s the description for %s %s";

  public DescriptionFormatter(
      MessageDecorator<?> messageDecorator, Thread thread, FieldChange fieldChange) {
    super(messageDecorator, thread, fieldChange);
  }

  @Override
  public String formatAddedField() {
    String message = super.formatAddedField();
    // Update the thread with the required information
    populateDescriptionFeedInfo(Thread.FieldOperation.ADDED, message, message);
    return message;
  }

  @Override
  public String formatUpdatedField() {
    String message = super.formatUpdatedField();
    // Update the thread with the required information
    populateDescriptionFeedInfo(Thread.FieldOperation.UPDATED, message, message);
    return message;
  }

  @Override
  public String formatDeletedField() {
    String message = super.formatDeletedField();
    // Update the thread with the required information
    populateDescriptionFeedInfo(Thread.FieldOperation.DELETED, message, message);
    return message;
  }

  private void populateDescriptionFeedInfo(
      Thread.FieldOperation operation, String threadMessage, String diffMessage) {
    DescriptionFeedInfo descriptionFeedInfo =
        new DescriptionFeedInfo()
            .withPreviousDescription(fieldOldValue)
            .withNewDescription(fieldNewValue)
            .withDiffMessage(diffMessage);
    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(getHeaderForDescriptionUpdate(operation.value()))
            .withFieldName(FIELD_DESCRIPTION)
            .withEntitySpecificInfo(descriptionFeedInfo);
    populateThreadFeedInfo(
        thread, threadMessage, Thread.CardStyle.DESCRIPTION, operation, feedInfo);
  }

  private String getHeaderForDescriptionUpdate(String eventTypeMessage) {
    return String.format(
        HEADER_MESSAGE,
        thread.getUpdatedBy(),
        eventTypeMessage,
        thread.getEntityType(),
        thread.getEntityUrlLink());
  }
}

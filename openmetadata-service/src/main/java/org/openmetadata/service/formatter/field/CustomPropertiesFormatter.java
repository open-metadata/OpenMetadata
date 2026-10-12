package org.openmetadata.service.formatter.field;

import org.openmetadata.schema.entity.feed.CustomPropertyFeedInfo;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormattedMessage;

public class CustomPropertiesFormatter extends DefaultFieldFormatter {
  private static final String HEADER_MESSAGE = "%s %s custom property %s for asset %s";

  public CustomPropertiesFormatter(
      MessageDecorator<?> messageDecorator, FormattedMessage thread, FieldChange fieldChange) {
    super(messageDecorator, thread, fieldChange);
    String[] fieldChangeNameParts = fieldChange.getName().split("\\.");
    if (fieldChangeNameParts.length > 1) {
      this.fieldChangeName = fieldChangeNameParts[1];
    } else {
      this.fieldChangeName = "";
    }
  }

  @Override
  public String formatAddedField() {
    String message = getHeaderForCustomPropertyUpdate("", "Added", thread.getEntityUrlLink());
    populateCustomPropertiesInfo(FormattedMessage.FieldOperation.ADDED, message);
    return message;
  }

  @Override
  public String formatUpdatedField() {
    String message = getHeaderForCustomPropertyUpdate("", "Updated", thread.getEntityUrlLink());
    populateCustomPropertiesInfo(FormattedMessage.FieldOperation.UPDATED, message);
    return message;
  }

  @Override
  public String formatDeletedField() {
    String message = getHeaderForCustomPropertyUpdate("", "Deleted", thread.getEntityUrlLink());
    populateCustomPropertiesInfo(FormattedMessage.FieldOperation.DELETED, message);
    return message;
  }

  private void populateCustomPropertiesInfo(
      FormattedMessage.FieldOperation operation, String threadMessage) {
    CustomPropertyFeedInfo customPropertyFeedInfo =
        new CustomPropertyFeedInfo()
            .withPreviousValue(fieldChange.getOldValue())
            .withUpdatedValue(fieldChange.getNewValue());
    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(
                getHeaderForCustomPropertyUpdate(
                    thread.getUpdatedBy(), operation.value(), thread.getEntityUrlLink()))
            .withFieldName(fieldChangeName)
            .withEntitySpecificInfo(customPropertyFeedInfo);
    populateThreadFeedInfo(
        thread, threadMessage, FormattedMessage.CardStyle.CUSTOM_PROPERTIES, operation, feedInfo);
  }

  private String getHeaderForCustomPropertyUpdate(
      String prefix, String eventTypeMessage, String entityUrl) {
    return String.format(HEADER_MESSAGE, prefix, eventTypeMessage, fieldChangeName, entityUrl);
  }
}

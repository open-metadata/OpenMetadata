package org.openmetadata.service.formatter.field;

import org.openmetadata.schema.entity.feed.CertificationFeedInfo;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

public class CertificationFormatter extends DefaultFieldFormatter {
  private static final String HEADER_MESSAGE = "%s %s certification %s for asset %s";

  public CertificationFormatter(
      MessageDecorator<?> messageDecorator, Thread thread, FieldChange fieldChange) {
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
    String message = getHeaderForCertificationUpdate("", "Added", thread.getEntityUrlLink());
    populateCertificationInfo(Thread.FieldOperation.ADDED, message);
    return message;
  }

  @Override
  public String formatUpdatedField() {
    String message = getHeaderForCertificationUpdate("", "Updated", thread.getEntityUrlLink());
    populateCertificationInfo(Thread.FieldOperation.UPDATED, message);
    return message;
  }

  @Override
  public String formatDeletedField() {
    String message = getHeaderForCertificationUpdate("", "Deleted", thread.getEntityUrlLink());
    populateCertificationInfo(Thread.FieldOperation.DELETED, message);
    return message;
  }

  private void populateCertificationInfo(Thread.FieldOperation operation, String threadMessage) {
    CertificationFeedInfo certificationFeedInfo =
        new CertificationFeedInfo()
            .withPreviousValue(fieldChange.getOldValue())
            .withUpdatedValue(fieldChange.getNewValue());
    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(
                getHeaderForCertificationUpdate(
                    thread.getUpdatedBy(), operation.value(), thread.getEntityUrlLink()))
            .withFieldName(fieldChangeName)
            .withEntitySpecificInfo(certificationFeedInfo);
    populateThreadFeedInfo(
        thread, threadMessage, Thread.CardStyle.CERTIFICATION, operation, feedInfo);
  }

  private String getHeaderForCertificationUpdate(
      String prefix, String eventTypeMessage, String entityUrl) {
    return String.format(HEADER_MESSAGE, prefix, eventTypeMessage, fieldChangeName, entityUrl);
  }
}

package org.openmetadata.service.formatter.field;

import static org.openmetadata.service.Entity.FIELD_DOMAIN;

import org.openmetadata.schema.entity.feed.DomainFeedInfo;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

public class DomainFormatter extends DefaultFieldFormatter {
  private static final String HEADER_MESSAGE = "%s %s asset %s in Domain %s";

  public DomainFormatter(
      MessageDecorator<?> messageDecorator, Thread thread, FieldChange fieldChange) {
    super(messageDecorator, thread, fieldChange);
  }

  @Override
  public String formatAddedField() {
    String message = super.formatAddedField();
    populateDomainFeedInfo(Thread.FieldOperation.ADDED, message);
    return message;
  }

  @Override
  public String formatUpdatedField() {
    String message = super.formatUpdatedField();
    populateDomainFeedInfo(Thread.FieldOperation.UPDATED, message);
    return message;
  }

  @Override
  public String formatDeletedField() {
    String message = super.formatDeletedField();
    populateDomainFeedInfo(Thread.FieldOperation.DELETED, message);
    return message;
  }

  private void populateDomainFeedInfo(Thread.FieldOperation operation, String threadMessage) {
    DomainFeedInfo domainFeedInfo =
        new DomainFeedInfo()
            .withPreviousDomain(
                JsonUtils.readOrConvertValue(fieldChange.getOldValue(), EntityReference.class))
            .withUpdatedDomain(
                JsonUtils.readOrConvertValue(fieldChange.getNewValue(), EntityReference.class));

    String domainUrl = null;
    // in case of deletion updated domain will be null
    if (domainFeedInfo.getUpdatedDomain() != null) {
      domainUrl =
          messageDecorator.getEntityUrl(
              Entity.DOMAIN, domainFeedInfo.getUpdatedDomain().getFullyQualifiedName(), "");
    }

    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(getHeaderForOwnerUpdate(operation.value(), domainUrl))
            .withFieldName(FIELD_DOMAIN)
            .withEntitySpecificInfo(domainFeedInfo);
    populateThreadFeedInfo(thread, threadMessage, Thread.CardStyle.DOMAIN, operation, feedInfo);
  }

  private String getHeaderForOwnerUpdate(String eventTypeMessage, String domainUrl) {
    return String.format(
        HEADER_MESSAGE,
        thread.getUpdatedBy(),
        eventTypeMessage,
        thread.getEntityUrlLink(),
        domainUrl);
  }
}

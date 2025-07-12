package org.openmetadata.service.formatter.field;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;

import java.util.ArrayList;
import java.util.List;
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
            .withPreviousDomains(
                JsonUtils.readOrConvertValues(fieldChange.getOldValue(), EntityReference.class))
            .withUpdatedDomains(
                JsonUtils.readOrConvertValues(fieldChange.getNewValue(), EntityReference.class));

    List<String> domainUrls = new ArrayList<>();
    // in case of deletion updated domain will be null
    if (!nullOrEmpty(domainFeedInfo.getUpdatedDomains())) {
      for (EntityReference domain : domainFeedInfo.getUpdatedDomains()) {
        domainUrls.add(
            messageDecorator.getEntityUrl(Entity.DOMAIN, domain.getFullyQualifiedName(), ""));
      }
    }

    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(getHeaderForOwnerUpdate(operation.value(), domainUrls))
            .withFieldName(FIELD_DOMAINS)
            .withEntitySpecificInfo(domainFeedInfo);
    populateThreadFeedInfo(thread, threadMessage, Thread.CardStyle.DOMAIN, operation, feedInfo);
  }

  private String getHeaderForOwnerUpdate(String eventTypeMessage, List<String> domainUrls) {
    String concatenatedDomainUrls = String.join(", ", domainUrls);
    return String.format(
        HEADER_MESSAGE,
        thread.getUpdatedBy(),
        eventTypeMessage,
        thread.getEntityUrlLink(),
        concatenatedDomainUrls);
  }
}

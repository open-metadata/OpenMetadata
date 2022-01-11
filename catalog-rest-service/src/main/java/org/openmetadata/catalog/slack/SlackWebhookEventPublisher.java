package org.openmetadata.catalog.slack;

import java.util.concurrent.TimeUnit;
import javax.ws.rs.ProcessingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import org.openmetadata.catalog.events.AbstractEventPublisher;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SlackWebhookEventPublisher extends AbstractEventPublisher {
  private static final Logger LOG = LoggerFactory.getLogger(SlackWebhookEventPublisher.class);
  private Invocation.Builder target;
  private Client client;

  public SlackWebhookEventPublisher(SlackPublisherConfiguration config) {
    super(config.getBatchSize(), config.getFilters());
    String slackWebhookURL = config.getWebhookUrl();
    ClientBuilder clientBuilder = ClientBuilder.newBuilder();
    clientBuilder.connectTimeout(10, TimeUnit.SECONDS);
    clientBuilder.readTimeout(12, TimeUnit.SECONDS);
    client = clientBuilder.build();
    target = client.target(slackWebhookURL).request();
  }

  @Override
  public void onStart() {
    LOG.info("Slack Webhook Publisher Started");
  }

  @Override
  public void onShutdown() {
    if (client != null) {
      client.close();
    }
  }

  @Override
  public void publish(ChangeEventList events) throws EventPublisherException {
    for (ChangeEvent event : events.getData()) {
      LOG.info("log event {}", event);
      try {
        SlackMessage slackMessage = buildSlackMessage(event);
        Response response =
            target.post(javax.ws.rs.client.Entity.entity(slackMessage, MediaType.APPLICATION_JSON_TYPE));
        if (response.getStatus() >= 300 && response.getStatus() < 400) {
          throw new EventPublisherException(
              "Slack webhook callback is getting redirected. " + "Please check your configuration");
        } else if (response.getStatus() >= 300 && response.getStatus() < 600) {
          throw new SlackRetriableException(response.getStatusInfo().getReasonPhrase());
        }
      } catch (ProcessingException e) {
        LOG.error("Failed to publish event {} to slack ", event);
        throw new EventPublisherException(e.getMessage());
      }
    }
  }

  private SlackMessage buildSlackMessage(ChangeEvent event) {
    StringBuilder stringBuilder = new StringBuilder();
    SlackMessage slackMessage = new SlackMessage();
    slackMessage.setUsername(event.getUserName());
    String headerText = getHeaderText(event);
    slackMessage.setText(headerText);

    String addedEvents = getAddedEventsText(event);
    if (changeDescription.getFieldsAdded() != null && !changeDescription.getFieldsAdded().isEmpty()) {
      stringBuilder.append("Added ");
      for (FieldChange fieldChange : changeDescription.getFieldsAdded()) {
        stringBuilder.append(fieldChange.getName());
        stringBuilder.append(" added ");
        stringBuilder.append(fieldChange.getNewValue());
      }
    }
    if (changeDescription.getFieldsUpdated() != null && !changeDescription.getFieldsUpdated().isEmpty()) {
      stringBuilder.append("Updated ");
      for (FieldChange fieldChange : changeDescription.getFieldsUpdated()) {
        stringBuilder.append(fieldChange.getName());
        stringBuilder.append(" updated from _");
        stringBuilder.append(fieldChange.getOldValue());
        stringBuilder.append("_ to _");
        stringBuilder.append(fieldChange.getNewValue());
        stringBuilder.append("_");
      }
    }
    if (changeDescription.getFieldsDeleted() != null && !changeDescription.getFieldsDeleted().isEmpty()) {
      stringBuilder.append("Deleted ");
      for (FieldChange fieldChange : changeDescription.getFieldsDeleted()) {
        stringBuilder.append(fieldChange.getName());
        stringBuilder.append(" deleted ");
        stringBuilder.append(fieldChange.getOldValue());
      }
    }
    SlackAttachment[] attachments = new SlackAttachment[1];
    attachments[0] = new SlackAttachment();
    attachments[0].setText(stringBuilder.toString());
    slackMessage.setAttachments(attachments);
    return slackMessage;
  }

  private String getHeaderText(ChangeEvent event) {
    String headerTxt = "%s %s %s";
    String operation = "";
    String entityUrl =
        String.format(
            "<http://localhost:8585/%s/%s|%s>",
            event.getEntityType(), event.getEntityFullyQualifiedName(), event.getEntityFullyQualifiedName());
    if (event.getEventType().equals(EventType.ENTITY_CREATED)) {
      operation = "created";
    } else if (event.getEventType().equals(EventType.ENTITY_UPDATED)) {
      operation = "updated";
    } else if (event.getEventType().equals(EventType.ENTITY_DELETED)) {
      operation = "deleted";
    }
    return String.format(headerTxt, event.getUserName(), operation, entityUrl);
  }

  private SlackAttachment getAddedEventsText(ChangeEvent event) {
    SlackAttachment attachment = new SlackAttachment();
    ChangeDescription changeDescription = event.getChangeDescription();
    if (changeDescription.getFieldsAdded() != null && !changeDescription.getFieldsAdded().isEmpty()) {
      attachment.setTitle("Added Following");
      for (FieldChange fieldChange : changeDescription.getFieldsAdded()) {
        if (fieldChange.getName().equals("tags")) {}
      }
    }
    return String.format(headerTxt, event.getUserName(), operation, entityUrl);
  }
}

package org.openmetadata.catalog.slack;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import org.json.JSONArray;
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
      } catch (Exception e) {
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
    List<SlackAttachment> attachmentList = new ArrayList<>();
    List<SlackAttachment> addedEvents = getAddedEventsText(event);
    SlackAttachment updatedEvents = getUpdatedEventsText(event);
    SlackAttachment deletedEvents = getDeletedEventsText(event);
    attachmentList.addAll(addedEvents);
    if (updatedEvents != null) {
      attachmentList.add(updatedEvents);
    }
    if (deletedEvents != null) {
      attachmentList.add(deletedEvents);
    }
    slackMessage.setAttachments(attachmentList.toArray(new SlackAttachment[0]));
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

  private List<SlackAttachment> getAddedEventsText(ChangeEvent event) {
    List<SlackAttachment> attachments = new ArrayList<>();
    ChangeDescription changeDescription = event.getChangeDescription();
    if (changeDescription.getFieldsAdded() != null && !changeDescription.getFieldsAdded().isEmpty()) {
      for (FieldChange fieldChange : changeDescription.getFieldsAdded()) {
        SlackAttachment attachment = new SlackAttachment();
        StringBuilder title = new StringBuilder();
        if (fieldChange.getName().contains("tags")) {
          title.append("Added tags to ");
          title.append(fieldChange.getName().replace(".tags", ""));
          String tags = (String) fieldChange.getNewValue();
          JSONArray jsonTags = new JSONArray(tags);
          StringBuilder tagsText = new StringBuilder("Tags \n");
          for (int i = 0; i < jsonTags.length(); i++) {
            String tagFQN = jsonTags.getJSONObject(i).getString("tagFQN");
            tagsText.append("- ");
            tagsText.append(tagFQN);
            tagsText.append("\n");
          }
          attachment.setText(tagsText.toString());
          attachment.setTitle(title.toString());
        }
        attachments.add(attachment);
      }
    }
    return attachments;
  }

  private SlackAttachment getUpdatedEventsText(ChangeEvent event) {
    SlackAttachment attachment = null;
    ChangeDescription changeDescription = event.getChangeDescription();
    if (changeDescription.getFieldsUpdated() != null && !changeDescription.getFieldsUpdated().isEmpty()) {
      attachment = new SlackAttachment();
      attachment.setTitle("Updated the following fields");
      for (FieldChange fieldChange : changeDescription.getFieldsUpdated()) {
        attachment.setText((String) fieldChange.getNewValue());
      }
    }
    return attachment;
  }

  private SlackAttachment getDeletedEventsText(ChangeEvent event) {
    SlackAttachment attachment = null;
    ChangeDescription changeDescription = event.getChangeDescription();
    if (changeDescription.getFieldsDeleted() != null && !changeDescription.getFieldsDeleted().isEmpty()) {
      attachment = new SlackAttachment();
      attachment.setTitle("Deleted the following");
      for (FieldChange fieldChange : changeDescription.getFieldsUpdated()) {
        attachment.setText((String) fieldChange.getNewValue());
      }
    }
    return attachment;
  }
}

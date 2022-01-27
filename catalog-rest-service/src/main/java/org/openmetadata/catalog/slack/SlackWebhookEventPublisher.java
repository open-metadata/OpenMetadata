package org.openmetadata.catalog.slack;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.openmetadata.catalog.events.AbstractEventPublisher;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;

@Slf4j
public class SlackWebhookEventPublisher extends AbstractEventPublisher {
  private Invocation.Builder target;
  private Client client;
  private String openMetadataUrl;

  public SlackWebhookEventPublisher(SlackPublisherConfiguration config) {
    super(config.getBatchSize(), config.getFilters());
    String slackWebhookURL = config.getWebhookUrl();
    ClientBuilder clientBuilder = ClientBuilder.newBuilder();
    clientBuilder.connectTimeout(10, TimeUnit.SECONDS);
    clientBuilder.readTimeout(12, TimeUnit.SECONDS);
    client = clientBuilder.build();
    target = client.target(slackWebhookURL).request();
    openMetadataUrl = config.getOpenMetadataUrl();
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
        LOG.error("Failed to publish event {} to slack due to {} ", event, e.getMessage());
      }
    }
  }

  private SlackMessage buildSlackMessage(ChangeEvent event) {
    SlackMessage slackMessage = new SlackMessage();
    slackMessage.setUsername(event.getUserName());
    if (event.getEntity() != null) {
      String headerText = getHeaderText(event);
      slackMessage.setText(headerText);
    }
    List<SlackAttachment> attachmentList = new ArrayList<>();
    List<SlackAttachment> addedEvents = getAddedEventsText(event);
    List<SlackAttachment> updatedEvents = getUpdatedEventsText(event);
    List<SlackAttachment> deletedEvents = getDeletedEventsText(event);
    attachmentList.addAll(addedEvents);
    attachmentList.addAll(updatedEvents);
    attachmentList.addAll(deletedEvents);
    slackMessage.setAttachments(attachmentList.toArray(new SlackAttachment[0]));
    return slackMessage;
  }

  private String getHeaderText(ChangeEvent event) {
    String headerTxt = "%s %s %s";
    String operation = "";
    String entityUrl = getEntityUrl(event);
    if (event.getEventType().equals(EventType.ENTITY_CREATED)) {
      operation = "created";
    } else if (event.getEventType().equals(EventType.ENTITY_UPDATED)) {
      operation = "updated";
    } else if (event.getEventType().equals(EventType.ENTITY_SOFT_DELETED)) {
      operation = "deleted";
    }
    return String.format(headerTxt, event.getUserName(), operation, entityUrl);
  }

  private List<SlackAttachment> getAddedEventsText(ChangeEvent event) {
    List<SlackAttachment> attachments = new ArrayList<>();
    ChangeDescription changeDescription = event.getChangeDescription();
    if (changeDescription != null
        && changeDescription.getFieldsAdded() != null
        && !changeDescription.getFieldsAdded().isEmpty()) {
      for (FieldChange fieldChange : changeDescription.getFieldsAdded()) {
        SlackAttachment attachment = new SlackAttachment();
        StringBuilder title = new StringBuilder();
        if (fieldChange.getName().contains("tags")) {
          title.append("Added tags ");
          title.append(fieldChange.getName().replace("tags", ""));
          attachment.setText(parseTags((String) fieldChange.getNewValue()));
        } else if (fieldChange.getName().equals("columns")) {
          title.append("Added new columns ");
          attachment.setText(parseColumns((String) fieldChange.getNewValue(), event));
        } else if (fieldChange.getName().equals("owner")) {
          title.append("Added ownership");
          attachment.setText(parseOwnership((String) fieldChange.getOldValue(), (String) fieldChange.getNewValue()));
        } else if (fieldChange.getName().equals("followers")) {
          String followers = parseFollowers((List<EntityReference>) fieldChange.getNewValue());
          String entityUrl = getEntityUrl(event);
          attachment.setText(followers + " started following " + entityUrl);
        } else if (fieldChange.getName().contains("description")) {
          title.append("Added description to ");
          title.append(fieldChange.getName());
          attachment.setText((String) fieldChange.getNewValue());
        }
        attachment.setTitle(title.toString());
        attachments.add(attachment);
      }
    }
    return attachments;
  }

  private List<SlackAttachment> getUpdatedEventsText(ChangeEvent event) {
    List<SlackAttachment> attachments = new ArrayList<>();
    ChangeDescription changeDescription = event.getChangeDescription();
    if (changeDescription != null
        && changeDescription.getFieldsUpdated() != null
        && !changeDescription.getFieldsUpdated().isEmpty()) {
      for (FieldChange fieldChange : changeDescription.getFieldsUpdated()) {
        // when the entity is deleted we will get deleted set as true. We do not need to parse this for slack messages.
        if (!fieldChange.getName().equals("deleted")) {
          SlackAttachment attachment = new SlackAttachment();
          attachment.setTitle("Updated " + fieldChange.getName());
          if (fieldChange.getName().equals("owner")) {
            attachment.setText(parseOwnership((String) fieldChange.getOldValue(), (String) fieldChange.getNewValue()));
          } else {
            String updatedStr = fieldChange.getOldValue() + " to " + fieldChange.getNewValue();
            attachment.setText(updatedStr);
          }
          attachments.add(attachment);
        }
      }
    }
    return attachments;
  }

  private List<SlackAttachment> getDeletedEventsText(ChangeEvent event) {
    List<SlackAttachment> attachments = new ArrayList<>();
    ChangeDescription changeDescription = event.getChangeDescription();
    if (changeDescription != null
        && changeDescription.getFieldsDeleted() != null
        && !changeDescription.getFieldsDeleted().isEmpty()) {
      for (FieldChange fieldChange : changeDescription.getFieldsDeleted()) {
        SlackAttachment attachment = new SlackAttachment();
        StringBuilder title = new StringBuilder();
        if (fieldChange.getName().contains("tags")) {
          attachment = new SlackAttachment();
          title.append("Deleted tags from ");
          title.append(fieldChange.getName().replace(".tags", ""));
          attachment.setText(parseTags((String) fieldChange.getOldValue()));
          attachment.setTitle(title.toString());
        } else if (fieldChange.getName().contains("columns")) {
          attachment = new SlackAttachment();
          title.append("Deleted columns ");
          attachment.setText(parseColumns((String) fieldChange.getOldValue(), event));
          attachment.setTitle(title.toString());
        } else if (fieldChange.getName().equals("followers")) {
          String followers = parseFollowers((List<EntityReference>) fieldChange.getOldValue());
          String entityUrl = getEntityUrl(event);
          attachment.setText(followers + " unfollowed " + entityUrl);
        }
        attachments.add(attachment);
      }
    }
    return attachments;
  }

  private String parseTags(String tags) {
    JSONArray jsonTags = new JSONArray(tags);
    StringBuilder tagsText = new StringBuilder("\n");
    for (int i = 0; i < jsonTags.length(); i++) {
      String tagFQN = jsonTags.getJSONObject(i).getString("tagFQN");
      tagsText.append("- ");
      tagsText.append(tagFQN);
      tagsText.append("\n");
    }
    return tagsText.toString();
  }

  private String parseColumns(String columns, ChangeEvent event) {
    JSONArray jsonColumns = new JSONArray(columns);
    StringBuilder columnsText = new StringBuilder("\n");
    for (int i = 0; i < jsonColumns.length(); i++) {
      String columnName = jsonColumns.getJSONObject(i).getString("name");
      String columnType = jsonColumns.getJSONObject(i).getString("dataType");
      String columnFQDN = jsonColumns.getJSONObject(i).getString("fullyQualifiedName");
      String columnURL = String.format("<%s/%s/%s|%s>", openMetadataUrl, event.getEntityType(), columnFQDN, columnName);
      columnsText.append("- ");
      columnsText.append(columnURL);
      columnsText.append(" of type ");
      columnsText.append(columnType);
      columnsText.append("\n");
    }
    return columnsText.toString();
  }

  private String parseOwnership(String prevOwner, String newOwner) {
    StringBuilder owner = new StringBuilder("\n");
    if (prevOwner != null) {
      JSONObject prevOwnerJson = new JSONObject(prevOwner);
      owner.append("Updated from previous owner ");
      owner.append(prevOwnerJson.getString("name"));
      owner.append(" to ");
    } else {
      owner.append("Set owner to ");
    }
    JSONObject newOwnerJson = new JSONObject(newOwner);
    owner.append(newOwnerJson.getString("name"));
    return owner.toString();
  }

  private String parseFollowers(List<EntityReference> followers) {
    return followers.stream().map(EntityReference::getName).collect(Collectors.joining(","));
  }

  private String getEntityUrl(ChangeEvent event) {
    return String.format(
        "<%s/%s/%s|%s>",
        openMetadataUrl,
        event.getEntityType(),
        event.getEntityFullyQualifiedName(),
        event.getEntityFullyQualifiedName());
  }
}

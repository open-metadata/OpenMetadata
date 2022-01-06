package org.openmetadata.catalog.slack;

import java.util.Map;
import java.util.concurrent.TimeUnit;
import javax.ws.rs.ProcessingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.events.EventPubSub;
import org.openmetadata.catalog.events.EventPublisher;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.FieldChange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SlackWebhookEventPublisher implements EventPublisher {
  private static final Logger LOG = LoggerFactory.getLogger(SlackWebhookEventPublisher.class);
  private Invocation.Builder target;
  private Client client;

  public void init(Map<String, Object> config, Jdbi jdbi) {
    String slackWebhookURL = (String) config.get("webhookUrl");
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
    close();
  }

  @Override
  public void onEvent(EventPubSub.ChangeEventHolder changeEventHolder, long sequence, boolean endOfBatch)
      throws Exception {
    ChangeEvent changeEvent = changeEventHolder.get();
    long attemptTime = System.currentTimeMillis();
    try {
      publish(changeEvent);
    } catch (ProcessingException ex) {
      LOG.error("error", ex);
    }
  }

  @Override
  public void publish(ChangeEvent event) {
    LOG.info("log event {}", event);
    try {
      SlackMessage slackMessage = buildSlackMessage(event);
      target.post(Entity.entity(slackMessage, MediaType.APPLICATION_JSON_TYPE));
    } catch (Exception e) {
      LOG.error("failed to update ES doc", e);
    }
  }

  @Override
  public void close() {
    client.close();
  }

  private SlackMessage buildSlackMessage(ChangeEvent event) {
    StringBuilder stringBuilder = new StringBuilder();
    SlackMessage slackMessage = new SlackMessage();
    slackMessage.setUsername(event.getUserName());
    stringBuilder.append(event.getUserName());
    switch (event.getEventType()) {
      case ENTITY_CREATED:
        stringBuilder.append(" created ");
        break;
      case ENTITY_UPDATED:
        stringBuilder.append(" updated ");
        break;
      case ENTITY_DELETED:
        stringBuilder.append(" deleted ");
        break;
    }
    stringBuilder.append("\n");
    ChangeDescription changeDescription = event.getChangeDescription();
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
}

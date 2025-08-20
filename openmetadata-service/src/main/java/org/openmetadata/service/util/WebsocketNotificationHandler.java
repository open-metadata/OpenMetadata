/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.socket.WebSocketManager;

@Slf4j
public class WebsocketNotificationHandler {
  private final ExecutorService threadScheduler;

  public WebsocketNotificationHandler() {
    this.threadScheduler =
        ExecutorManager.getInstance().getVirtualThreadExecutor("websocket-notification", 1);
  }

  public void processNotifications(ContainerResponseContext responseContext) {
    threadScheduler.submit(
        () -> {
          try {
            handleNotifications(responseContext);
          } catch (Exception ex) {
            LOG.error("[NotificationHandler] Failed to use mapper in converting to Json", ex);
          }
        });
  }

  public static void sendCsvExportCompleteNotification(
      String jobId, SecurityContext securityContext, String csvData) {
    CSVExportMessage message = new CSVExportMessage(jobId, "COMPLETED", csvData, null);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.CSV_EXPORT_CHANNEL, jsonMessage);
    }
  }

  public static void bulkAssetsOperationCompleteNotification(
      String jobId, SecurityContext securityContext, BulkOperationResult result) {
    BulkAssetsOperationMessage message =
        new BulkAssetsOperationMessage(jobId, "COMPLETED", result, null);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.BULK_ASSETS_CHANNEL, jsonMessage);
    }
  }

  public static void bulkAssetsOperationFailedNotification(
      String jobId, SecurityContext securityContext, String errorMessage) {
    CSVExportMessage message = new CSVExportMessage(jobId, "FAILED", null, errorMessage);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.BULK_ASSETS_CHANNEL, jsonMessage);
    }
  }

  private void handleNotifications(ContainerResponseContext responseContext) {
    int responseCode = responseContext.getStatus();
    if (responseCode == Response.Status.CREATED.getStatusCode()
        && responseContext.getEntity() != null
        && responseContext.getEntity().getClass().equals(Thread.class)) {
      Thread thread = (Thread) responseContext.getEntity();
      switch (thread.getType()) {
        case Task -> handleTaskNotification(thread);
        case Conversation -> handleConversationNotification(thread);
        case Announcement -> handleAnnouncementNotification(thread);
      }
    }
  }

  public static void handleTaskNotification(Thread thread) {
    String jsonThread = JsonUtils.pojoToJson(thread);
    if (thread.getPostsCount() == 0) {
      List<EntityReference> assignees = thread.getTask().getAssignees();
      Set<UUID> receiversList = new HashSet<>();
      // Update Assignee
      assignees.forEach(
          e -> {
            if (Entity.USER.equals(e.getType())) {
              receiversList.add(e.getId());
            } else if (Entity.TEAM.equals(e.getType())) {
              // fetch all that are there in the team
              List<CollectionDAO.EntityRelationshipRecord> records =
                  Entity.getCollectionDAO()
                      .relationshipDAO()
                      .findTo(e.getId(), TEAM, Relationship.HAS.ordinal(), Entity.USER);
              records.forEach(eRecord -> receiversList.add(eRecord.getId()));
            }
          });

      // Send WebSocket Notification
      WebSocketManager.getInstance()
          .sendToManyWithUUID(receiversList, WebSocketManager.TASK_BROADCAST_CHANNEL, jsonThread);
    } else {
      List<MessageParser.EntityLink> mentions;
      Post latestPost = thread.getPosts().get(thread.getPostsCount() - 1);
      mentions = MessageParser.getEntityLinks(latestPost.getMessage());
      notifyMentionedUsers(mentions, jsonThread);
    }
  }

  private void handleAnnouncementNotification(Thread thread) {
    String jsonThread = JsonUtils.pojoToJson(thread);
    AnnouncementDetails announcementDetails = thread.getAnnouncement();
    Long currentTimestamp = Instant.now().getEpochSecond();
    if (announcementDetails.getStartTime() <= currentTimestamp
        && currentTimestamp <= announcementDetails.getEndTime()) {
      WebSocketManager.getInstance()
          .broadCastMessageToAll(WebSocketManager.ANNOUNCEMENT_CHANNEL, jsonThread);
    }
  }

  private void handleConversationNotification(Thread thread) {
    String jsonThread = JsonUtils.pojoToJson(thread);
    WebSocketManager.getInstance()
        .broadCastMessageToAll(WebSocketManager.FEED_BROADCAST_CHANNEL, jsonThread);
    List<MessageParser.EntityLink> mentions;
    if (thread.getPostsCount() == 0) {
      mentions = MessageParser.getEntityLinks(thread.getMessage());
    } else {
      Post latestPost = thread.getPosts().get(thread.getPostsCount() - 1);
      mentions = MessageParser.getEntityLinks(latestPost.getMessage());
    }
    notifyMentionedUsers(mentions, jsonThread);
  }

  private static void notifyMentionedUsers(
      List<MessageParser.EntityLink> mentions, String jsonThread) {
    mentions.forEach(
        entityLink -> {
          String fqn = entityLink.getEntityFQN();
          if (USER.equals(entityLink.getEntityType())) {
            User user = Entity.getCollectionDAO().userDAO().findEntityByName(fqn);
            WebSocketManager.getInstance()
                .sendToOne(user.getId(), WebSocketManager.MENTION_CHANNEL, jsonThread);
          } else if (TEAM.equals(entityLink.getEntityType())) {
            Team team = Entity.getCollectionDAO().teamDAO().findEntityByName(fqn);
            // fetch all that are there in the team
            List<CollectionDAO.EntityRelationshipRecord> records =
                Entity.getCollectionDAO()
                    .relationshipDAO()
                    .findTo(team.getId(), TEAM, Relationship.HAS.ordinal(), USER);
            // Notify on WebSocket for Realtime
            WebSocketManager.getInstance()
                .sendToManyWithString(records, WebSocketManager.MENTION_CHANNEL, jsonThread);
          }
        });
  }

  public static void sendCsvExportFailedNotification(
      String jobId, SecurityContext securityContext, String errorMessage) {
    CSVExportMessage message = new CSVExportMessage(jobId, "FAILED", null, errorMessage);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.CSV_EXPORT_CHANNEL, jsonMessage);
    }
  }

  private static UUID getUserIdFromSecurityContext(SecurityContext securityContext) {
    try {
      String username = securityContext.getUserPrincipal().getName();
      User user =
          Entity.getCollectionDAO()
              .userDAO()
              .findEntityByName(FullyQualifiedName.quoteName(username));
      return user.getId();
    } catch (EntityNotFoundException e) {
      LOG.error("User not found ", e);
    }
    return null;
  }

  public static void sendCsvImportStartedNotification(
      String jobId, SecurityContext securityContext) {
    CSVImportMessage message = new CSVImportMessage(jobId, "STARTED", null, null);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.CSV_IMPORT_CHANNEL, jsonMessage);
    }
  }

  public static void sendCsvImportCompleteNotification(
      String jobId, SecurityContext securityContext, CsvImportResult result) {
    CSVImportMessage message = new CSVImportMessage(jobId, "COMPLETED", result, null);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.CSV_IMPORT_CHANNEL, jsonMessage);
    }
  }

  public static void sendCsvImportFailedNotification(
      String jobId, SecurityContext securityContext, String errorMessage) {
    CSVExportMessage message = new CSVExportMessage(jobId, "FAILED", null, errorMessage);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.CSV_IMPORT_CHANNEL, jsonMessage);
    }
  }

  public static void sendDeleteOperationCompleteNotification(
      String jobId, SecurityContext securityContext, EntityInterface entity) {
    DeleteEntityMessage message =
        new DeleteEntityMessage(jobId, "COMPLETED", entity.getName(), null);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    LOG.info(
        "[AsyncDelete] Delete operation completed successfully - jobId: {}, userId:{}, entity: {}, ",
        jobId,
        userId,
        entity.getName());
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.DELETE_ENTITY_CHANNEL, jsonMessage);
    }
  }

  public static void sendDeleteOperationFailedNotification(
      String jobId, SecurityContext securityContext, EntityInterface entity, String error) {
    DeleteEntityMessage message = new DeleteEntityMessage(jobId, "FAILED", entity.getName(), error);
    String jsonMessage = JsonUtils.pojoToJson(message);

    UUID userId = getUserIdFromSecurityContext(securityContext);
    LOG.error(
        "[AsyncDelete] Delete operation failed - jobId: {}, userId:{} ,entity: {}, error: {}",
        jobId,
        userId,
        entity.getName(),
        error);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.DELETE_ENTITY_CHANNEL, jsonMessage);
    }
  }

  public static void sendMoveOperationCompleteNotification(
      String jobId, SecurityContext securityContext, EntityInterface entity) {
    MoveGlossaryTermMessage message =
        new MoveGlossaryTermMessage(
            jobId, "COMPLETED", entity.getName(), entity.getFullyQualifiedName(), null);
    String jsonMessage = JsonUtils.pojoToJson(message);
    UUID userId = getUserIdFromSecurityContext(securityContext);
    LOG.info(
        "[AsyncMove] Move operation completed successfully - jobId: {}, userId:{}, entity: {}, ",
        jobId,
        userId,
        entity.getName());
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.MOVE_GLOSSARY_TERM_CHANNEL, jsonMessage);
    }
  }

  public static void sendMoveOperationFailedNotification(
      String jobId, SecurityContext securityContext, EntityInterface entity, String error) {
    MoveGlossaryTermMessage message =
        new MoveGlossaryTermMessage(
            jobId, "FAILED", entity.getName(), entity.getFullyQualifiedName(), error);
    String jsonMessage = JsonUtils.pojoToJson(message);

    UUID userId = getUserIdFromSecurityContext(securityContext);
    LOG.error(
        "[AsyncMove] Move operation failed - jobId: {}, userId:{} ,entity: {}, error: {}",
        jobId,
        userId,
        entity.getName(),
        error);
    if (userId != null) {
      WebSocketManager.getInstance()
          .sendToOne(userId, WebSocketManager.MOVE_GLOSSARY_TERM_CHANNEL, jsonMessage);
    }
  }
}

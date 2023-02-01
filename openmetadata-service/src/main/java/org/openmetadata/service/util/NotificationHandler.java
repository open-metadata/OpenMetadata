package org.openmetadata.service.util;

import static org.openmetadata.schema.settings.SettingsType.TASK_NOTIFICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.TEST_RESULT_NOTIFICATION_CONFIGURATION;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.USER;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import freemarker.template.TemplateException;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.api.configuration.airflow.TaskNotificationConfiguration;
import org.openmetadata.api.configuration.airflow.TestResultNotificationConfiguration;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.socket.WebSocketManager;

@Slf4j
public class NotificationHandler {
  private final CollectionDAO dao;
  private final ObjectMapper mapper;

  private final ExecutorService threadScheduler;

  public NotificationHandler(CollectionDAO dao) {
    this.dao = dao;
    this.mapper = new ObjectMapper();
    this.threadScheduler = Executors.newFixedThreadPool(1);
  }

  public void processNotifications(ContainerResponseContext responseContext) {
    threadScheduler.submit(
        () -> {
          try {
            handleNotifications(responseContext);
          } catch (JsonProcessingException e) {
            LOG.error("[NotificationHandler] Failed to use mapper in converting to Json", e);
          }
        });
  }

  private void handleNotifications(ContainerResponseContext responseContext) throws JsonProcessingException {
    int responseCode = responseContext.getStatus();
    if (responseCode == Response.Status.CREATED.getStatusCode()
        && responseContext.getEntity() != null
        && responseContext.getEntity().getClass().equals(Thread.class)) {
      Thread thread = (Thread) responseContext.getEntity();
      switch (thread.getType()) {
        case Task:
          handleTaskNotification(thread);
          break;
        case Conversation:
          handleConversationNotification(thread);
          break;
        case Announcement:
          handleAnnouncementNotification(thread);
          break;
      }
    } else if (responseContext.getEntity() != null
        && responseContext.getEntity().getClass().equals(ChangeEvent.class)) {
      ChangeEvent changeEvent = (ChangeEvent) responseContext.getEntity();
      handleTestResultEmailNotification(changeEvent);
    }
  }

  private void handleTaskNotification(Thread thread) throws JsonProcessingException {
    String jsonThread = mapper.writeValueAsString(thread);
    if (thread.getPostsCount() == 0) {
      List<EntityReference> assignees = thread.getTask().getAssignees();
      HashSet<UUID> receiversList = new HashSet<>();
      assignees.forEach(
          e -> {
            if (Entity.USER.equals(e.getType())) {
              receiversList.add(e.getId());
            } else if (Entity.TEAM.equals(e.getType())) {
              // fetch all that are there in the team
              List<CollectionDAO.EntityRelationshipRecord> records =
                  dao.relationshipDAO().findTo(e.getId().toString(), TEAM, Relationship.HAS.ordinal(), Entity.USER);
              records.forEach((eRecord) -> receiversList.add(eRecord.getId()));
            }
          });

      // Send WebSocket Notification
      WebSocketManager.getInstance()
          .sendToManyWithUUID(receiversList, WebSocketManager.TASK_BROADCAST_CHANNEL, jsonThread);

      // Send Email Notification If Enabled
      TaskNotificationConfiguration taskSetting =
          SettingsCache.getInstance().getSetting(TASK_NOTIFICATION_CONFIGURATION, TaskNotificationConfiguration.class);
      if (taskSetting.getEnabled()) {
        handleEmailNotifications(receiversList, thread);
      }
    }
  }

  private void handleAnnouncementNotification(Thread thread) throws JsonProcessingException {
    String jsonThread = mapper.writeValueAsString(thread);
    AnnouncementDetails announcementDetails = thread.getAnnouncement();
    Long currentTimestamp = Instant.now().getEpochSecond();
    if (announcementDetails.getStartTime() <= currentTimestamp
        && currentTimestamp <= announcementDetails.getEndTime()) {
      WebSocketManager.getInstance().broadCastMessageToAll(WebSocketManager.ANNOUNCEMENT_CHANNEL, jsonThread);
    }
  }

  private void handleConversationNotification(Thread thread) throws JsonProcessingException {
    String jsonThread = mapper.writeValueAsString(thread);
    WebSocketManager.getInstance().broadCastMessageToAll(WebSocketManager.FEED_BROADCAST_CHANNEL, jsonThread);
    List<MessageParser.EntityLink> mentions;
    if (thread.getPostsCount() == 0) {
      mentions = MessageParser.getEntityLinks(thread.getMessage());
    } else {
      Post latestPost = thread.getPosts().get(thread.getPostsCount() - 1);
      mentions = MessageParser.getEntityLinks(latestPost.getMessage());
    }
    mentions.forEach(
        entityLink -> {
          String fqn = entityLink.getEntityFQN();
          if (USER.equals(entityLink.getEntityType())) {
            User user = dao.userDAO().findEntityByName(fqn);
            WebSocketManager.getInstance().sendToOne(user.getId(), WebSocketManager.MENTION_CHANNEL, jsonThread);
          } else if (TEAM.equals(entityLink.getEntityType())) {
            Team team = dao.teamDAO().findEntityByName(fqn);
            // fetch all that are there in the team
            List<CollectionDAO.EntityRelationshipRecord> records =
                dao.relationshipDAO().findTo(team.getId().toString(), TEAM, Relationship.HAS.ordinal(), USER);
            // Notify on WebSocket for Realtime
            WebSocketManager.getInstance().sendToManyWithString(records, WebSocketManager.MENTION_CHANNEL, jsonThread);
          }
        });
  }

  private void handleEmailNotifications(HashSet<UUID> userList, Thread thread) {
    UserRepository repository = (UserRepository) Entity.getEntityRepository(USER);
    URI urlInstance = thread.getHref();
    userList.forEach(
        (id) -> {
          try {
            User user = repository.get(null, id, repository.getFields("name,email,href"));
            EmailUtil.getInstance()
                .sendTaskAssignmentNotificationToUser(
                    user.getName(),
                    user.getEmail(),
                    String.format(
                        "%s/users/%s/tasks", EmailUtil.getInstance().buildBaseUrl(urlInstance), user.getName()),
                    thread,
                    EmailUtil.getInstance().getTaskAssignmentSubject(),
                    EmailUtil.TASK_NOTIFICATION_TEMPLATE);
          } catch (IOException ex) {
            LOG.error("Task Email Notification Failed :", ex);
          } catch (TemplateException ex) {
            LOG.error("Task Email Notification Template Parsing Exception :", ex);
          }
        });
  }

  private void handleTestResultEmailNotification(ChangeEvent changeEvent) {
    if (Objects.nonNull(changeEvent.getChangeDescription())) {
      FieldChange fieldChange = changeEvent.getChangeDescription().getFieldsUpdated().get(0);
      String updatedField = fieldChange.getName();
      if (updatedField.equals("testCaseResult")) {
        TestCaseResult result = (TestCaseResult) fieldChange.getNewValue();
        // Send Email Notification If Enabled
        TestResultNotificationConfiguration testNotificationSetting =
            SettingsCache.getInstance()
                .getSetting(TEST_RESULT_NOTIFICATION_CONFIGURATION, TestResultNotificationConfiguration.class);
        if (testNotificationSetting.getEnabled()
            && testNotificationSetting.getOnResult().contains(result.getTestCaseStatus())) {
          List<String> receivers =
              testNotificationSetting.getReceivers() != null
                  ? testNotificationSetting.getReceivers()
                  : new ArrayList<>();
          if (testNotificationSetting.getSendToOwners()) {
            EntityInterface entity = (TestCase) changeEvent.getEntity();
            // Find the Table that have the test case
            List<CollectionDAO.EntityRelationshipRecord> tableToTestRecord =
                dao.relationshipDAO()
                    .findFrom(entity.getId().toString(), TEST_CASE, Relationship.CONTAINS.ordinal(), TABLE);
            tableToTestRecord.forEach(
                (tableRecord) -> {
                  // Find the owners owning the Table , can be a team or Users
                  List<CollectionDAO.EntityRelationshipRecord> tableOwners =
                      dao.relationshipDAO()
                          .findFrom(tableRecord.getId().toString(), TABLE, Relationship.OWNS.ordinal());
                  tableOwners.forEach(
                      (owner) -> {
                        try {
                          if (USER.equals(owner.getType())) {
                            User user = dao.userDAO().findEntityById(owner.getId());
                            receivers.add(user.getEmail());
                          } else if (TEAM.equals(owner.getType())) {
                            Team team = dao.teamDAO().findEntityById(owner.getId());
                            // Fetch the users in the team
                            List<CollectionDAO.EntityRelationshipRecord> records =
                                dao.relationshipDAO()
                                    .findTo(team.getId().toString(), TEAM, Relationship.HAS.ordinal(), USER);

                            records.forEach(
                                (userRecord) -> {
                                  try {
                                    User user = dao.userDAO().findEntityById(userRecord.getId());
                                    receivers.add(user.getEmail());
                                  } catch (IOException e) {
                                    throw new RuntimeException(e);
                                  }
                                });
                          }
                        } catch (IOException e) {
                          throw new RuntimeException(e);
                        }
                      });
                });
          }
          sendTestResultEmailNotifications(receivers, (TestCase) changeEvent.getEntity(), result);
        }
      }
    }
  }

  private void sendTestResultEmailNotifications(List<String> emails, TestCase testCase, TestCaseResult result) {
    emails.forEach(
        (email) -> {
          URI urlInstance = testCase.getHref();
          String testLinkUrl =
              String.format(
                  "%s/table/%s/activity_feed",
                  EmailUtil.getInstance().buildBaseUrl(urlInstance), testCase.getEntityFQN());
          try {
            EmailUtil.getInstance()
                .sendTestResultEmailNotificationToUser(
                    email,
                    testLinkUrl,
                    testCase.getName(),
                    result,
                    EmailUtil.getInstance().getTestResultSubject(),
                    EmailUtil.TEST_NOTIFICATION_TEMPLATE);
          } catch (IOException e) {
            LOG.error("TestResult Email Notification Failed :", e);
          } catch (TemplateException e) {
            LOG.error("Task Email Notification Template Parsing Exception :", e);
          }
        });
  }
}

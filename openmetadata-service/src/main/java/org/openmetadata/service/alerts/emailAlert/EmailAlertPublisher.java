package org.openmetadata.service.alerts.emailAlert;

import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.alerts.AlertsActionPublisher;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.ChangeEventParser;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class EmailAlertPublisher extends AlertsActionPublisher {
  private final EmailAlertConfig emailAlertConfig;
  private final CollectionDAO daoCollection;

  public EmailAlertPublisher(Alert alert, AlertAction alertAction, CollectionDAO dao) {
    super(alert, alertAction, dao);
    if (alertAction.getAlertActionType() == AlertAction.AlertActionType.EMAIL) {
      this.emailAlertConfig = JsonUtils.convertValue(alertAction.getAlertActionConfig(), EmailAlertConfig.class);
      this.daoCollection = dao;
    } else {
      throw new IllegalArgumentException("Email Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void onStartDelegate() {
    LOG.info("Email Publisher Started");
  }

  @Override
  public void onShutdownDelegate() {
    LOG.info("Email Publisher Stopped");
  }

  @Override
  public void sendAlert(ChangeEvent event) {
    try {
      List<String> receivers = buildReceiversList(event);
      EmailMessage emailMessage = ChangeEventParser.buildEmailMessage(event);
      for (String email : receivers) {
        EmailUtil.sendChangeEventMail(email, emailMessage);
      }
    } catch (Exception e) {
      LOG.error("Failed to publish event {} to email due to {} ", event, e.getMessage());
      throw new EventPublisherException(
          String.format("Failed to publish event %s to email due to %s ", event, e.getMessage()));
    }
  }

  private List<String> sendToAdmins() {
    List<User> allUsers = SubjectCache.getInstance().getAllUsers();
    List<String> emailList = new ArrayList<>();
    allUsers.forEach(
        (user) -> {
          if (user.getIsAdmin()) emailList.add(user.getEmail());
        });
    return emailList;
  }

  private List<String> sendToOwners(ChangeEvent changeEvent) {
    return findOwnerOrFollowers(changeEvent, Relationship.OWNS);
  }

  private List<String> sendToFollowers(ChangeEvent changeEvent) {
    return findOwnerOrFollowers(changeEvent, Relationship.FOLLOWS);
  }

  private List<String> findOwnerOrFollowers(ChangeEvent changeEvent, Relationship relationship) {
    List<String> emailList = new ArrayList<>();
    try {
      EntityInterface entityInterface = (EntityInterface) changeEvent.getEntity();
      List<CollectionDAO.EntityRelationshipRecord> ownerOrFollowers =
          daoCollection
              .relationshipDAO()
              .findFrom(entityInterface.getId().toString(), changeEvent.getEntityType(), relationship.ordinal());
      ownerOrFollowers.forEach(
          (owner) -> {
            if (USER.equals(owner.getType())) {
              User user = SubjectCache.getInstance().getSubjectContext(owner.getId()).getUser();
              emailList.add(user.getEmail());
            } else if (TEAM.equals(owner.getType())) {
              Team team = SubjectCache.getInstance().getTeam(owner.getId());
              // Fetch the users in the team
              List<CollectionDAO.EntityRelationshipRecord> records =
                  daoCollection
                      .relationshipDAO()
                      .findTo(team.getId().toString(), TEAM, Relationship.HAS.ordinal(), USER);

              records.forEach(
                  (userRecord) -> {
                    User user = SubjectCache.getInstance().getSubjectContext(userRecord.getId()).getUser();
                    emailList.add(user.getEmail());
                  });
            }
          });
    } catch (Exception ex) {
      LOG.error("Failed in listing all Admin User, Reason : ", ex);
    }
    return emailList;
  }

  private List<String> buildReceiversList(ChangeEvent changeEvent) {
    List<String> receiverList =
        emailAlertConfig.getReceivers() == null ? new ArrayList<>() : emailAlertConfig.getReceivers();

    // Send to Admins
    if (emailAlertConfig.getSendToAdmins()) {
      receiverList.addAll(sendToAdmins());
    }

    // Send To Owners
    if (emailAlertConfig.getSendToOwners()) {
      receiverList.addAll(sendToOwners(changeEvent));
    }

    // Send To Followers
    if (emailAlertConfig.getSendToFollowers()) {
      receiverList.addAll(sendToFollowers(changeEvent));
    }

    return receiverList;
  }
}

package org.openmetadata.service.events.subscription.emailAlert;

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.EMAIL;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.SubscriptionPublisher;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.ChangeEventParser;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class EmailAlertPublisher extends SubscriptionPublisher {
  private final EmailAlertConfig emailAlertConfig;
  private final CollectionDAO daoCollection;

  public EmailAlertPublisher(EventSubscription eventSub, CollectionDAO dao) {
    super(eventSub, dao);
    if (eventSub.getSubscriptionType() == EMAIL) {
      this.emailAlertConfig = JsonUtils.convertValue(eventSub.getSubscriptionConfig(), EmailAlertConfig.class);
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
  public void sendAlert(EventResource.ChangeEventList list) throws IOException, InterruptedException {
    for (ChangeEvent event : list.getData()) {
      try {
        Set<String> receivers = buildReceiversList(event);
        EmailMessage emailMessage = ChangeEventParser.buildEmailMessage(event);
        for (String email : receivers) {
          EmailUtil.sendChangeEventMail(email, emailMessage);
        }
        setSuccessStatus(System.currentTimeMillis());
      } catch (Exception e) {
        setErrorStatus(System.currentTimeMillis(), 500, e.getMessage());
        throw new EventPublisherException(
            String.format("Failed to publish event %s to email due to %s ", event, e.getMessage()));
      }
    }
  }

  private Set<String> sendToAdmins() {
    Set<String> emailList = new HashSet<>();
    UserRepository userEntityRepository = (UserRepository) Entity.getEntityRepository(USER);
    ResultList<User> result;
    ListFilter listFilter = new ListFilter(Include.ALL);
    listFilter.addQueryParam("isAdmin", "true");
    String after = null;
    try {
      do {
        result = userEntityRepository.listAfter(null, userEntityRepository.getFields("email"), listFilter, 50, after);
        result.getData().forEach((user) -> emailList.add(user.getEmail()));
        after = result.getPaging().getAfter();
      } while (after != null);
    } catch (Exception ex) {
      LOG.error("Failed in listing all Users , Reason", ex);
    }
    return emailList;
  }

  private Set<String> sendToOwners(ChangeEvent changeEvent) {
    return findOwnerOrFollowers(changeEvent, Relationship.OWNS);
  }

  private Set<String> sendToFollowers(ChangeEvent changeEvent) {
    return findOwnerOrFollowers(changeEvent, Relationship.FOLLOWS);
  }

  private Set<String> findOwnerOrFollowers(ChangeEvent changeEvent, Relationship relationship) {
    Set<String> emailList = new HashSet<>();
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

  private Set<String> buildReceiversList(ChangeEvent changeEvent) {
    Set<String> receiverList =
        emailAlertConfig.getReceivers() == null ? new HashSet<>() : emailAlertConfig.getReceivers();

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

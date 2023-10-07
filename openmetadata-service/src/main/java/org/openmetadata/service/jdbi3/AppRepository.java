package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.resources.teams.UserResource.getUser;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.InternalServerErrorException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.apps.AppResource;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.SchedulerException;

@Slf4j
public class AppRepository extends EntityRepository<Application> {
  public static String APP_BOT_ROLE = "ApplicationBotRole";
  public static String APP_SCHEDULE_EXTENSION = "ScheduleExtension";

  public AppRepository(CollectionDAO dao) {
    super(
        AppResource.COLLECTION_PATH,
        Entity.APPLICATION,
        Application.class,
        Entity.getCollectionDAO().applicationDAO(),
        "",
        "");
    supportsSearch = false;
  }

  @Override
  public Application setFields(Application entity, EntityUtil.Fields fields) {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : entity.getPipelines());
    return entity.withBot(getBotUser(entity));
  }

  private List<AppSchedule> getApplicationSchedule(Application app) {
    List<CollectionDAO.ExtensionRecord> schedules =
        daoCollection.entityExtensionDAO().getExtensions(app.getId(), APP_SCHEDULE_EXTENSION);
    return schedules.stream()
        .map((schedule) -> JsonUtils.readValue(schedule.getExtensionJson(), AppSchedule.class))
        .collect(Collectors.toList());
  }

  public AppMarketPlaceRepository getMarketPlace() {
    return (AppMarketPlaceRepository) Entity.getEntityRepository(Entity.APP_MARKET_PLACE_DEF);
  }

  @Override
  public Application clearFields(Application entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public void prepare(Application entity, boolean update) {
    if (entity.getBot() == null) {}
  }

  public EntityReference createNewAppBot(Application application) {
    String botName = String.format("%sBot", application.getName());
    BotRepository botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User botUser = null;
    Bot bot = null;
    try {
      botUser = userRepository.findByName(botName, Include.NON_DELETED);
    } catch (EntityNotFoundException ex) {
      // Get Bot Role
      EntityReference roleRef = Entity.getEntityReferenceByName(Entity.ROLE, APP_BOT_ROLE, Include.NON_DELETED);
      // Create Bot User
      AuthenticationMechanism authMechanism =
          new AuthenticationMechanism()
              .withAuthType(AuthenticationMechanism.AuthType.JWT)
              .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
      CreateUser createUser =
          new CreateUser()
              .withName(botName)
              .withEmail(String.format("%s@openmetadata.org", botName))
              .withIsAdmin(false)
              .withIsBot(true)
              .withAuthenticationMechanism(authMechanism)
              .withRoles(List.of(roleRef.getId()));
      User user = getUser("admin", createUser);

      // Set User Ownership to the application creator
      user.setOwner(application.getOwner());

      // Set Auth Mechanism in Bot
      JWTAuthMechanism jwtAuthMechanism = (JWTAuthMechanism) authMechanism.getConfig();
      authMechanism.setConfig(
          JWTTokenGenerator.getInstance().generateJWTToken(user, jwtAuthMechanism.getJWTTokenExpiry()));
      user.setAuthenticationMechanism(authMechanism);

      // Create User
      botUser = userRepository.createInternal(user);
    }

    try {
      bot = botRepository.findByName(botName, Include.NON_DELETED);
    } catch (EntityNotFoundException ex) {
      Bot appBot =
          new Bot()
              .withId(UUID.randomUUID())
              .withName(botUser.getName())
              .withUpdatedBy("admin")
              .withUpdatedAt(System.currentTimeMillis())
              .withBotUser(botUser.getEntityReference())
              .withProvider(ProviderType.USER)
              .withFullyQualifiedName(botUser.getName());

      // Create Bot with above user
      bot = botRepository.createInternal(appBot);
    }

    if (bot != null) {
      return bot.getEntityReference();
    }
    LOG.error("System Failed in Creating a Bot for the Application.");
    return null;
  }

  @Override
  public void storeEntity(Application entity, boolean update) {
    EntityReference botUserRef = entity.getBot();
    EntityReference ownerRef = entity.getOwner();
    entity.withBot(null).withOwner(null);

    // Store
    store(entity, update);

    // Restore entity fields
    entity.withBot(botUserRef).withOwner(ownerRef);
  }

  @SuppressWarnings("unused")
  protected void postUpdate(Application original, Application updated) {
    super.postUpdate(original, updated);
    // TODO: here we should handle Live as well

  }

  public void postDelete(Application entity) {
    try {
      AppScheduler.getInstance().deleteScheduledApplication(entity);
    } catch (SchedulerException ex) {
      LOG.error("Failed in delete Application from Scheduler.", ex);
      throw new InternalServerErrorException("Failed in Delete App from Scheduler.");
    }
  }

  public EntityReference getBotUser(Application application) {
    return application.getBot() != null
        ? application.getBot()
        : getToEntityRef(application.getId(), Relationship.HAS, Entity.BOT, false);
  }

  @Override
  public void storeRelationships(Application entity) {
    if (entity.getBot() != null) {
      addRelationship(entity.getId(), entity.getBot().getId(), Entity.APPLICATION, Entity.BOT, Relationship.HAS);
    }
  }
}

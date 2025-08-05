package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.UserUtil.getUser;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.apps.AppResource;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class AppRepository extends EntityRepository<App> {
  public static final String APP_BOT_ROLE = "ApplicationBotRole";

  public static final String UPDATE_FIELDS = "appConfiguration,appSchedule";

  public AppRepository() {
    super(
        AppResource.COLLECTION_PATH,
        Entity.APPLICATION,
        App.class,
        Entity.getCollectionDAO().applicationDAO(),
        UPDATE_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = false;
    quoteFqn = true;
  }

  @Override
  public void setFields(App entity, EntityUtil.Fields fields) {
    entity.setPipelines(
        fields.contains("pipelines") ? getIngestionPipelines(entity) : entity.getPipelines());
    entity.withBot(getBotUser(entity));
  }

  @Override
  protected List<EntityReference> getIngestionPipelines(App service) {
    return findTo(service.getId(), entityType, Relationship.HAS, Entity.INGESTION_PIPELINE);
  }

  public AppMarketPlaceRepository getMarketPlace() {
    return (AppMarketPlaceRepository) Entity.getEntityRepository(Entity.APP_MARKET_PLACE_DEF);
  }

  @Override
  public void clearFields(App entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(App entity, boolean update) {}

  public EntityReference createNewAppBot(App application) {
    String botName = String.format("%sBot", application.getName());
    BotRepository botRepository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User botUser;
    Bot bot;
    try {
      botUser = userRepository.getByName(null, botName, userRepository.getFields("id"));
    } catch (EntityNotFoundException ex) {
      // Get Bot Role
      EntityReference roleRef =
          Entity.getEntityReferenceByName(Entity.ROLE, APP_BOT_ROLE, Include.NON_DELETED);
      // Create Bot User
      AuthenticationMechanism authMechanism =
          new AuthenticationMechanism()
              .withAuthType(AuthenticationMechanism.AuthType.JWT)
              .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
      CreateUser createUser =
          new CreateUser()
              .withName(botName)
              .withDisplayName(application.getDisplayName())
              .withEmail(String.format("%s@openmetadata.org", botName))
              .withIsAdmin(false)
              .withIsBot(true)
              .withAuthenticationMechanism(authMechanism)
              .withRoles(List.of(roleRef.getId()));
      User user = getUser("admin", createUser);

      // Set User Ownership to the application creator
      user.setOwners(application.getOwners());

      // Set Auth Mechanism in Bot
      JWTAuthMechanism jwtAuthMechanism = (JWTAuthMechanism) authMechanism.getConfig();
      authMechanism.setConfig(
          JWTTokenGenerator.getInstance()
              .generateJWTToken(user, jwtAuthMechanism.getJWTTokenExpiry()));
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
              .withName(botName)
              .withUpdatedBy("admin")
              .withUpdatedAt(System.currentTimeMillis())
              .withBotUser(botUser.getEntityReference())
              .withProvider(ProviderType.USER)
              .withFullyQualifiedName(botName);

      // Create Bot with above user
      bot = botRepository.createInternal(appBot);
    }

    if (bot != null) {
      return bot.getEntityReference();
    }
    LOG.error("System Failed in Creating a Bot for the Application.");
    return null;
  }

  public List<EntityReference> listAllAppsReference() {
    return daoCollection.applicationDAO().listAppsRef();
  }

  @Override
  public void storeEntity(App entity, boolean update) {
    List<EntityReference> ownerRefs = entity.getOwners();
    entity.withOwners(null);
    store(entity, update);
    entity.withOwners(ownerRefs);
  }

  public EntityReference getBotUser(App application) {
    return application.getBot() != null
        ? application.getBot()
        : getToEntityRef(application.getId(), Relationship.CONTAINS, Entity.BOT, false);
  }

  @Override
  public void storeRelationships(App entity) {
    if (entity.getBot() != null) {
      addRelationship(
          entity.getId(),
          entity.getBot().getId(),
          Entity.APPLICATION,
          Entity.BOT,
          Relationship.CONTAINS);
    }
  }

  @Override
  protected void postDelete(App entity) {
    // Delete the status stored in the app extension
    // Note that we don't want to delete the LIMITS, since we want to keep them
    // between different app installations
    daoCollection
        .appExtensionTimeSeriesDao()
        .delete(entity.getId().toString(), AppExtension.ExtensionType.STATUS.toString());
  }

  public final List<App> listAll() {
    List<String> jsons = dao.listAfterWithOffset(Integer.MAX_VALUE, 0);
    List<App> entities = new ArrayList<>();
    for (String json : jsons) {
      App entity = JsonUtils.readValue(json, App.class);
      entities.add(entity);
    }
    return entities;
  }

  public ResultList<AppRunRecord> listAppRuns(App app, int limitParam, int offset) {
    return listAppExtensionById(
        app, limitParam, offset, AppRunRecord.class, AppExtension.ExtensionType.STATUS, null);
  }

  public ResultList<AppRunRecord> listAppRuns(App app, int limitParam, int offset, UUID service) {
    return listAppExtensionById(
        app, limitParam, offset, AppRunRecord.class, AppExtension.ExtensionType.STATUS, service);
  }

  public AppRunRecord getLatestAppRuns(App app) {
    return getLatestExtensionById(app, AppRunRecord.class, AppExtension.ExtensionType.STATUS, null);
  }

  public AppRunRecord getLatestAppRuns(App app, UUID service) {
    return getLatestExtensionById(
        app, AppRunRecord.class, AppExtension.ExtensionType.STATUS, service);
  }

  public AppRunRecord getLatestAppRunsAfterStartTime(App app, long startTime) {
    return getLatestExtensionAfterStartTimeById(
        app, startTime, AppRunRecord.class, AppExtension.ExtensionType.STATUS);
  }

  public <T> ResultList<T> listAppExtensionByName(
      App app,
      int limitParam,
      int offset,
      Class<T> clazz,
      AppExtension.ExtensionType extensionType) {
    int total =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtensionCountByName(app.getName(), extensionType.toString());
    List<T> entities = new ArrayList<>();
    if (limitParam > 0) {
      List<String> jsons =
          daoCollection
              .appExtensionTimeSeriesDao()
              .listAppExtensionByName(app.getName(), limitParam, offset, extensionType.toString());
      for (String json : jsons) {
        T entity = JsonUtils.readValue(json, clazz);
        entities.add(entity);
      }

      return new ResultList<>(entities, offset, total);
    } else {
      // limit == 0 , return total count of entity.
      return new ResultList<>(entities, null, total);
    }
  }

  public <T> ResultList<T> listAppExtensionById(
      App app,
      int limitParam,
      int offset,
      Class<T> clazz,
      AppExtension.ExtensionType extensionType) {
    return listAppExtensionById(app, limitParam, offset, clazz, extensionType, null);
  }

  public <T> ResultList<T> listAppExtensionById(
      App app,
      int limitParam,
      int offset,
      Class<T> clazz,
      AppExtension.ExtensionType extensionType,
      UUID service) {
    int total =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtensionCount(app.getId().toString(), extensionType.toString(), service);
    List<T> entities = new ArrayList<>();
    if (limitParam > 0) {
      // forward scrolling, if after == null then first page is being asked
      List<String> jsons =
          daoCollection
              .appExtensionTimeSeriesDao()
              .listAppExtension(
                  app.getId().toString(), limitParam, offset, extensionType.toString(), service);
      for (String json : jsons) {
        T entity = JsonUtils.readValue(json, clazz);
        entities.add(entity);
      }
      return new ResultList<>(entities, offset, total);
    } else {
      // limit == 0 , return total count of entity.
      return new ResultList<>(entities, null, total);
    }
  }

  public <T> ResultList<T> listAppExtensionAfterTimeByName(
      App app,
      long startTime,
      int limitParam,
      int offset,
      Class<T> clazz,
      AppExtension.ExtensionType extensionType) {
    int total =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtensionCountAfterTimeByName(
                app.getName(), startTime, extensionType.toString());
    List<T> entities = new ArrayList<>();
    if (limitParam > 0) {
      List<String> jsons =
          daoCollection
              .appExtensionTimeSeriesDao()
              .listAppExtensionAfterTimeByName(
                  app.getName(), limitParam, offset, startTime, extensionType.toString());
      for (String json : jsons) {
        T entity = JsonUtils.readValue(json, clazz);
        entities.add(entity);
      }

      return new ResultList<>(entities, offset, total);
    } else {
      return new ResultList<>(entities, null, total);
    }
  }

  public <T> ResultList<T> listAppExtensionAfterTimeById(
      App app,
      long startTime,
      int limitParam,
      int offset,
      Class<T> clazz,
      AppExtension.ExtensionType extensionType) {
    int total =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtensionCountAfterTime(
                app.getId().toString(), startTime, extensionType.toString());
    List<T> entities = new ArrayList<>();
    if (limitParam > 0) {
      // forward scrolling, if after == null then first page is being asked
      List<String> jsons =
          daoCollection
              .appExtensionTimeSeriesDao()
              .listAppExtensionAfterTime(
                  app.getId().toString(), limitParam, offset, startTime, extensionType.toString());
      for (String json : jsons) {
        T entity = JsonUtils.readValue(json, clazz);
        entities.add(entity);
      }
      return new ResultList<>(entities, offset, total);
    } else {
      // limit == 0 , return total count of entity.
      return new ResultList<>(entities, null, total);
    }
  }

  public <T> T getLatestExtensionByName(
      App app, Class<T> clazz, AppExtension.ExtensionType extensionType) {
    List<String> result =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtensionByName(app.getName(), 1, 0, extensionType.toString());
    if (nullOrEmpty(result)) {
      throw AppException.byExtension(extensionType);
    }
    return JsonUtils.readValue(result.get(0), clazz);
  }

  public <T> T getLatestExtensionById(
      App app, Class<T> clazz, AppExtension.ExtensionType extensionType, UUID service) {
    List<String> result =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtension(app.getId().toString(), 1, 0, extensionType.toString(), service);
    if (nullOrEmpty(result)) {
      throw AppException.byExtension(extensionType);
    }
    return JsonUtils.readValue(result.get(0), clazz);
  }

  public <T> T getLatestExtensionAfterStartTimeByName(
      App app, long startTime, Class<T> clazz, AppExtension.ExtensionType extensionType) {
    List<String> result =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtensionAfterTimeByName(
                app.getName(), 1, 0, startTime, extensionType.toString());
    if (nullOrEmpty(result)) {
      throw AppException.byExtension(extensionType);
    }
    return JsonUtils.readValue(result.get(0), clazz);
  }

  public <T> T getLatestExtensionAfterStartTimeById(
      App app, long startTime, Class<T> clazz, AppExtension.ExtensionType extensionType) {
    List<String> result =
        daoCollection
            .appExtensionTimeSeriesDao()
            .listAppExtensionAfterTime(
                app.getId().toString(), 1, 0, startTime, extensionType.toString());
    if (nullOrEmpty(result)) {
      throw AppException.byExtension(extensionType);
    }
    return JsonUtils.readValue(result.get(0), clazz);
  }

  @Override
  protected void entitySpecificCleanup(App app) {
    // Remove the Pipelines for Application
    List<EntityReference> pipelineRef = getIngestionPipelines(app);
    pipelineRef.forEach(
        reference ->
            Entity.deleteEntity("admin", reference.getType(), reference.getId(), true, true));
  }

  @Override
  public EntityRepository<App>.EntityUpdater getUpdater(
      App original, App updated, Operation operation, ChangeSource changeSource) {
    return new AppUpdater(original, updated, operation);
  }

  public App addEventSubscription(App app, EventSubscription eventSubscription) {
    EntityReference existing =
        listOrEmpty(app.getEventSubscriptions()).stream()
            .filter(e -> e.getId().equals(eventSubscription.getId()))
            .findFirst()
            .orElse(null);
    if (existing != null) {
      return app;
    }
    addRelationship(
        app.getId(),
        eventSubscription.getId(),
        Entity.APPLICATION,
        Entity.EVENT_SUBSCRIPTION,
        Relationship.CONTAINS);
    List<EntityReference> newSubs = new ArrayList<>(listOrEmpty(app.getEventSubscriptions()));
    newSubs.add(eventSubscription.getEntityReference());
    App updated = JsonUtils.deepCopy(app, App.class).withEventSubscriptions(newSubs);
    updated.setOpenMetadataServerConnection(null);
    getUpdater(app, updated, Operation.PUT, null).update();
    return updated;
  }

  public App deleteEventSubscription(App app, UUID eventSubscriptionId) {
    deleteRelationship(
        app.getId(),
        Entity.APPLICATION,
        eventSubscriptionId,
        Entity.EVENT_SUBSCRIPTION,
        Relationship.CONTAINS);
    List<EntityReference> newSubs = new ArrayList<>(listOrEmpty(app.getEventSubscriptions()));
    newSubs.removeIf(sub -> sub.getId().equals(eventSubscriptionId));
    App updated = JsonUtils.deepCopy(app, App.class).withEventSubscriptions(newSubs);
    updated.setOpenMetadataServerConnection(null);
    getUpdater(app, updated, Operation.PUT, null).update();
    return updated;
  }

  public void updateAppStatus(UUID appID, AppRunRecord record) {
    daoCollection
        .appExtensionTimeSeriesDao()
        .update(
            appID.toString(),
            JsonUtils.pojoToJson(record),
            record.getTimestamp(),
            AppExtension.ExtensionType.STATUS.toString());
  }

  public void addAppStatus(AppRunRecord record) {
    daoCollection
        .appExtensionTimeSeriesDao()
        .insert(JsonUtils.pojoToJson(record), AppExtension.ExtensionType.STATUS.toString());
  }

  public class AppUpdater extends EntityUpdater {
    public AppUpdater(App original, App updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange(
          "appConfiguration", original.getAppConfiguration(), updated.getAppConfiguration());
      recordChange("appSchedule", original.getAppSchedule(), updated.getAppSchedule());
      recordChange("bot", original.getBot(), updated.getBot());
      recordChange(
          "eventSubscriptions", original.getEventSubscriptions(), updated.getEventSubscriptions());
    }
  }
}

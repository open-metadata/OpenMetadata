package org.openmetadata.service.apps;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.unitofwork.JdbiUnitOfWorkProvider;
import org.openmetadata.service.resources.apps.AppResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.quartz.SchedulerException;

public class AppRepository extends EntityRepository<Application> {
  public static String APP_SCHEDULE_EXTENSION = "ScheduleExtension";
  public static String APP_SCHEDULE_INFO_SCHEMA = "scheduleInfo.json";

  public AppRepository(CollectionDAO dao) {
    super(AppResource.COLLECTION_PATH, Entity.APPLICATION, Application.class, dao.applicationDAO(), dao, "", "");
    supportsSearchIndex = false;
  }

  @Override
  public Application setFields(Application entity, EntityUtil.Fields fields) {
    entity.setSchedules(fields.contains("schedules") ? getApplicationSchedule(entity) : null);
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

  @Override
  public Application clearFields(Application entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public void prepare(Application entity, boolean update) {}

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

  public EntityReference getBotUser(Application application) {
    return application.getBot() != null
        ? application.getBot()
        : getToEntityRef(application.getId(), Relationship.HAS, Entity.BOT, false);
  }

  public RestUtil.PutResponse<?> addApplicationSchedule(UriInfo uriInfo, UUID appId, AppSchedule appScheduleInfo) {
    // Get Application
    Application application = get(uriInfo, appId, getFields("schedules"));
    if (application.getSchedules() != null && !application.getSchedules().isEmpty()) {
      throw new IllegalArgumentException("Job has already been Scheduled please remove any existing schedules.");
    }

    daoCollection
        .entityExtensionDAO()
        .insert(
            appId,
            String.format("%s.%s", APP_SCHEDULE_EXTENSION, appScheduleInfo.getScheduleId().toString()),
            APP_SCHEDULE_INFO_SCHEMA,
            JsonUtils.pojoToJson(appScheduleInfo));
    application.getSchedules().add(appScheduleInfo);

    ChangeDescription change = addScheduleChangeDescription(application.getVersion(), appScheduleInfo);
    ChangeEvent changeEvent =
        getChangeEvent(withHref(uriInfo, application), change, entityType, application.getVersion());

    // Schedule the application to scheduler
    ApplicationHandler.scheduleApplication(
        application,
        appScheduleInfo,
        JdbiUnitOfWorkProvider.getInstance().getHandle().getJdbi().onDemand(CollectionDAO.class));

    // Response
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> deleteApplicationSchedule(UriInfo uriInfo, UUID appId) throws SchedulerException {
    // Get Application
    Application application = get(uriInfo, appId, getFields("schedules"));
    if (application.getSchedules() != null && !application.getSchedules().isEmpty()) {
      // There is only one schedule per app
      AppSchedule appSchedule = application.getSchedules().get(0);
      daoCollection
          .entityExtensionDAO()
          .delete(appId, String.format("%s.%s", APP_SCHEDULE_EXTENSION, appSchedule.getScheduleId().toString()));

      ChangeDescription change = removeScheduleChangeDescription(application.getVersion(), appSchedule);
      ChangeEvent changeEvent =
          getChangeEvent(withHref(uriInfo, application), change, entityType, application.getVersion());

      // Delete the Application Schedule
      AppScheduler.getInstance().deleteScheduledApplication(application);

      // Response
      return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    }
    throw new IllegalArgumentException("No available schedule for the Job to remove.");
  }

  private ChangeDescription addScheduleChangeDescription(Double version, Object newValue) {
    FieldChange fieldChange = new FieldChange().withName("schedules").withNewValue(newValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsAdded().add(fieldChange);
    return change;
  }

  private ChangeDescription removeScheduleChangeDescription(Double version, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName("schedules").withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsDeleted().add(fieldChange);
    return change;
  }

  private ChangeEvent getChangeEvent(
      EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return new ChangeEvent()
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updated.getUpdatedBy())
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  @Override
  public void storeRelationships(Application entity) {
    if (entity.getBot() != null) {
      addRelationship(entity.getId(), entity.getBot().getId(), Entity.APPLICATION, Entity.BOT, Relationship.HAS);
    }
  }
}

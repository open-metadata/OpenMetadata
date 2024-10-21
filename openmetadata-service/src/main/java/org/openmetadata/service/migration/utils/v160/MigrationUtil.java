package org.openmetadata.service.migration.utils.v160;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import java.util.UUID;
import javax.json.JsonObject;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {

  // Just list status to make this ignore the new `limits` extension if it ever runs again
  private static final String SELECT_ALL_APP_EXTENSION_TIME_SERIES =
      "SELECT appId, json FROM apps_extension_time_series where extension = 'status'";
  private static final String UPDATE_MYSQL_APP_EXTENSION =
      "UPDATE apps_extension_time_series SET json = JSON_SET(json, '$.appName', :appName) WHERE appId = :appId AND extension = 'status'";
  private static final String UPDATE_PG_APP_EXTENSION =
      "UPDATE apps_extension_time_series SET json = jsonb_set(json, '{appName}', to_jsonb(:appName)) WHERE appId = :appId AND extension = 'status'";

  // We'll list the entries in app_extension_time_series, clean those whose appId
  // is not installed, and for those that appId matches from installed Apps, we'll
  // add the appName to the JSON data.
  // Note that we only want to clean up old status data.
  public static void addAppExtensionName(
      Handle handle,
      CollectionDAO daoCollection,
      AuthenticationConfiguration config,
      boolean postgres) {
    LOG.info("Migrating app extension name...");
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);

    try {
      handle
          .createQuery(SELECT_ALL_APP_EXTENSION_TIME_SERIES)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  UUID appId = UUID.fromString(row.get("appid").toString());
                  // Ignore if this has already been migrated
                  JsonObject json = JsonUtils.readJson(row.get("json").toString()).asJsonObject();
                  if (json.containsKey("appName")) {
                    return;
                  }
                  // Else, update the name
                  App app = appRepository.find(appId, Include.ALL);
                  updateAppExtension(handle, app, postgres);
                } catch (EntityNotFoundException ex) {
                  // Clean up the old status data
                  daoCollection
                      .appExtensionTimeSeriesDao()
                      .delete(
                          row.get("appid").toString(),
                          AppExtension.ExtensionType.STATUS.toString());
                } catch (Exception ex) {
                  LOG.warn(
                      String.format("Error migrating app extension [%s] due to [%s]", row, ex));
                }
              });
    } catch (Exception ex) {
      LOG.warn("Error running app extension migration ", ex);
    }
  }

  public static void addViewAllRuleToOrgPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    Policy organizationPolicy = repository.findByName("OrganizationPolicy", Include.NON_DELETED);
    boolean noViewAllRule = true;
    for (Rule rule : organizationPolicy.getRules()) {
      if (rule.getName().equals("OrganizationPolicy-View-All-Rule")) {
        noViewAllRule = false;
        break;
      }
    }
    if (noViewAllRule) {
      Rule viewAllRule =
          new Rule()
              .withName("OrganizationPolicy-ViewAll-Rule")
              .withResources(listOf("all"))
              .withOperations(listOf(MetadataOperation.VIEW_ALL))
              .withEffect(Rule.Effect.ALLOW)
              .withDescription("Allow all users to view all metadata");
      organizationPolicy.getRules().add(viewAllRule);
      collectionDAO
          .policyDAO()
          .update(
              organizationPolicy.getId(),
              organizationPolicy.getFullyQualifiedName(),
              JsonUtils.pojoToJson(organizationPolicy));
    }
  }

  private static void updateAppExtension(Handle handle, App app, boolean postgres) {
    Update update;
    if (postgres) {
      update = handle.createUpdate(UPDATE_PG_APP_EXTENSION);
    } else {
      update = handle.createUpdate(UPDATE_MYSQL_APP_EXTENSION);
    }
    update.bind("appId", app.getId().toString()).bind("appName", app.getName()).execute();
  }

  public static void migrateServiceTypesAndConnections(Handle handle, boolean postgresql) {
    LOG.info("Starting service type and connection type migrations");
    try {
      migrateServiceTypeInApiEndPointServiceType(handle, postgresql);
      migrateServiceTypeInApiServiceEntity(handle, postgresql);
      migrateConnectionTypeInApiServiceEntity(handle, postgresql);
      migrateServiceTypeInApiCollectionEntity(handle, postgresql);
      LOG.info("Successfully completed service type and connection type migrations");
    } catch (Exception e) {
      LOG.error("Error occurred during migration", e);
    }
  }

  private static void migrateServiceTypeInApiEndPointServiceType(
      Handle handle, boolean postgresql) {
    LOG.info("Starting migrateServiceTypeInApiEndPointServiceType");
    String query;

    if (postgresql) {
      query =
          "UPDATE api_endpoint_entity SET json = jsonb_set(json, '{serviceType}', '\"Rest\"', false) WHERE jsonb_extract_path_text(json, 'serviceType') = 'REST'";
    } else {
      query =
          "UPDATE api_endpoint_entity SET json = JSON_SET(json, '$.serviceType', 'Rest') WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'REST'";
    }

    try {
      handle.execute(query);
    } catch (Exception e) {
      LOG.error("Error updating", e);
    }
  }

  private static void migrateServiceTypeInApiServiceEntity(Handle handle, boolean postgresql) {
    LOG.info("Starting migrateServiceTypeInApiServiceEntity");

    String query;
    if (postgresql) {
      query =
          "UPDATE api_service_entity SET json = jsonb_set(json, '{serviceType}', '\"Rest\"', false) WHERE jsonb_extract_path_text(json, 'serviceType') = 'REST'";
    } else {
      query =
          "UPDATE api_service_entity SET json = JSON_SET(json, '$.serviceType', 'Rest') WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'REST'";
    }

    try {
      handle.execute(query);
    } catch (Exception e) {
      LOG.error("Error updating", e);
    }
  }

  private static void migrateServiceTypeInApiCollectionEntity(Handle handle, boolean postgresql) {
    LOG.info("Starting runApiCollectionEntityServiceTypeDataMigrations");

    String query;
    if (postgresql) {
      query =
          "UPDATE api_collection_entity SET json = jsonb_set(json, '{serviceType}', '\"Rest\"', false) WHERE jsonb_extract_path_text(json, 'serviceType') = 'REST'";
    } else {
      query =
          "UPDATE api_collection_entity SET json = JSON_SET(json, '$.serviceType', 'Rest') WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'REST'";
    }

    try {
      handle.execute(query);
    } catch (Exception e) {
      LOG.error("Error updating", e);
    }
  }

  private static void migrateConnectionTypeInApiServiceEntity(Handle handle, boolean postgresql) {
    LOG.info("Starting runApiServiceEntityConnectionTypeMigrate");

    String query;
    if (postgresql) {
      query =
          "UPDATE api_service_entity SET json = jsonb_set(json, '{connection,config,type}', '\"Rest\"', false) WHERE jsonb_extract_path_text(json, 'connection', 'config', 'type') = 'REST'";
    } else {
      query =
          "UPDATE api_service_entity SET json = JSON_SET(json, '$.connection.config.type', 'Rest') WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.type')) = 'REST'";
    }

    try {
      handle.execute(query);
    } catch (Exception e) {
      LOG.error("Error updating", e);
    }
  }
}

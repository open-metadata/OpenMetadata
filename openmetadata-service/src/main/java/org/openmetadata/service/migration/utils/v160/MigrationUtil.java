package org.openmetadata.service.migration.utils.v160;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {

  public static void addViewAllRuleToOrgPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
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
    } catch (EntityNotFoundException ex) {
      LOG.warn("OrganizationPolicy not found, skipping adding view all rule");
    }
  }

  public static void addEditGlossaryTermsToDataConsumerPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy dataConsumerPolicy = repository.findByName("DataConsumerPolicy", Include.NON_DELETED);
      if (dataConsumerPolicy.getRules() == null) {
        LOG.warn("DataConsumerPolicy has no rules defined.");
        return;
      }

      Rule dataConsumerEditRule =
          dataConsumerPolicy.getRules().stream()
              .filter(rule -> "DataConsumerPolicy-EditRule".equals(rule.getName()))
              .findFirst()
              .orElse(null);

      if (dataConsumerEditRule == null || dataConsumerEditRule.getOperations() == null) {
        LOG.warn("DataConsumerPolicy-EditRule not found or has no operations.");
        return;
      }

      List<MetadataOperation> operations = dataConsumerEditRule.getOperations();
      boolean updatedRequired = false;

      if (!operations.contains(MetadataOperation.EDIT_GLOSSARY_TERMS)) {
        operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
        updatedRequired = true;
      }

      if (!operations.contains(MetadataOperation.EDIT_TIER)) {
        operations.add(MetadataOperation.EDIT_TIER);
        updatedRequired = true;
      }

      if (updatedRequired) {
        collectionDAO
            .policyDAO()
            .update(
                dataConsumerPolicy.getId(),
                dataConsumerPolicy.getFullyQualifiedName(),
                JsonUtils.pojoToJson(dataConsumerPolicy));
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("DataConsumerPolicy not found, skipping updates.");
    }
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

  public static void addDisplayNameToCustomProperty(Handle handle, boolean postgresql) {
    String query;
    if (postgresql) {
      query =
          "UPDATE field_relationship "
              + "SET json = CASE "
              + "              WHEN json->>'displayName' IS NULL OR json->'displayName' = '\"\"' "
              + "              THEN jsonb_set(json, '{displayName}', json->'name', true) "
              + "              ELSE json "
              + "           END "
              + "WHERE fromType = :fromType AND toType = :toType AND relation = :relation;";
    } else {
      query =
          "UPDATE field_relationship "
              + "SET json = CASE "
              + "              WHEN JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')) IS NULL "
              + "                   OR JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')) = '' "
              + "              THEN JSON_SET(json, '$.displayName', JSON_EXTRACT(json, '$.name')) "
              + "              ELSE json "
              + "           END "
              + "WHERE fromType = :fromType AND toType = :toType AND relation = :relation;";
    }

    try {
      handle
          .createUpdate(query)
          .bind("fromType", Entity.TYPE)
          .bind("toType", Entity.TYPE)
          .bind("relation", Relationship.HAS.ordinal())
          .execute();
    } catch (Exception e) {
      LOG.error("Error updating displayName of custom properties", e);
    }
  }
}

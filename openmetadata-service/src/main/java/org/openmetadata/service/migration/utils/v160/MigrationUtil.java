package org.openmetadata.service.migration.utils.v160;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.TABLE;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.FullyQualifiedName;

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
    List<MetadataOperation> operationsToAdd =
        Arrays.asList(
            MetadataOperation.EDIT_GLOSSARY_TERMS,
            MetadataOperation.EDIT_TIER,
            MetadataOperation.EDIT_TAGS);
    addOperationsToPolicyRule(
        "DataConsumerPolicy", "DataConsumerPolicy-EditRule", operationsToAdd, collectionDAO);
    addOperationsToPolicyRule(
        "DataStewardPolicy", "DataStewardPolicy-EditRule", operationsToAdd, collectionDAO);
  }

  public static void addOperationsToPolicyRule(
      String policyName,
      String ruleName,
      List<MetadataOperation> operationsToAdd,
      CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName(policyName, Include.NON_DELETED);
      if (policy.getRules() == null) {
        LOG.warn("{} has no rules defined.", policyName);
        return;
      }

      Rule editRule =
          policy.getRules().stream()
              .filter(rule -> ruleName.equals(rule.getName()))
              .findFirst()
              .orElse(null);

      if (editRule == null || editRule.getOperations() == null) {
        LOG.warn("{} not found or has no operations.", ruleName);
        return;
      }

      List<MetadataOperation> existingOperations = editRule.getOperations();
      boolean updatedRequired = false;

      for (MetadataOperation op : operationsToAdd) {
        if (!existingOperations.contains(op)) {
          existingOperations.add(op);
          updatedRequired = true;
          LOG.info("Added operation {} to rule {}", op, ruleName);
        }
      }

      if (updatedRequired) {
        collectionDAO
            .policyDAO()
            .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
        LOG.info("Updated policy {} with new operations.", policyName);
      } else {
        LOG.info("No updates required for policy {}.", policyName);
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("{} not found, skipping updates.", policyName);
    } catch (Exception ex) {
      LOG.error("Error updating policy {}: {}", policyName, ex.getMessage());
    }
  }

  public static void addRelationsForTableConstraints(Handle handle, boolean postgresql) {
    LOG.info("Starting table constraint relationship migration");
    final int batchSize = 1000;
    int offset = 0;
    String fetchQuery =
        "SELECT id, json FROM table_entity "
            + "WHERE JSON_LENGTH(JSON_EXTRACT(json, '$.tableConstraints')) > 0 "
            + "AND JSON_LENGTH(JSON_EXTRACT(json, '$.tableConstraints[*].referredColumns')) > 0 "
            + "LIMIT :limit OFFSET :offset";

    if (postgresql) {
      fetchQuery =
          "SELECT id, json FROM table_entity "
              + "WHERE jsonb_typeof(json->'tableConstraints') = 'array' "
              + "AND jsonb_array_length(json->'tableConstraints') > 0 "
              + "AND EXISTS ("
              + "  SELECT 1 FROM jsonb_array_elements(json->'tableConstraints') AS tc "
              + "  WHERE jsonb_typeof(tc->'referredColumns') = 'array' "
              + "    AND jsonb_array_length(tc->'referredColumns') > 0"
              + ") "
              + "LIMIT :limit OFFSET :offset";
    }

    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);

    while (true) {
      List<Map<String, Object>> tables =
          handle
              .createQuery(fetchQuery)
              .bind("limit", batchSize)
              .bind("offset", offset)
              .mapToMap()
              .list();

      if (tables.isEmpty()) {
        break;
      }

      for (Map<String, Object> tableRow : tables) {
        String tableId = (String) tableRow.get("id");
        String json = tableRow.get("json").toString();
        try {
          Table table = JsonUtils.readValue(json, Table.class);
          addConstraintRelationship(table, table.getTableConstraints(), tableRepository);
        } catch (Exception e) {
          LOG.error("Error processing table ID '{}': {}", tableId, e.getMessage());
        }
      }

      offset += batchSize;
      LOG.debug("Processed of table constraint up to offset {}", offset);
    }
  }

  private static void addConstraintRelationship(
      Table table, List<TableConstraint> constraints, TableRepository tableRepository) {
    if (!nullOrEmpty(constraints)) {
      for (TableConstraint constraint : constraints) {
        if (!nullOrEmpty(constraint.getReferredColumns())) {
          List<EntityReference> relationships =
              tableRepository.findTo(table.getId(), TABLE, Relationship.RELATED_TO, TABLE);
          Map<UUID, EntityReference> relatedTables = new HashMap<>();
          relationships.forEach(r -> relatedTables.put(r.getId(), r));
          for (String column : constraint.getReferredColumns()) {
            String toParent = FullyQualifiedName.getParentFQN(column);
            try {
              EntityReference toTable =
                  Entity.getEntityReferenceByName(TABLE, toParent, NON_DELETED);
              if (!relatedTables.containsKey(toTable.getId())) {
                tableRepository.addRelationship(
                    table.getId(), toTable.getId(), TABLE, TABLE, Relationship.RELATED_TO);
              }
            } catch (EntityNotFoundException e) {
              throw EntityNotFoundException.byName(
                  String.format(
                      "Failed to add table constraint due to missing table %s", toParent));
            }
          }
        }
      }
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

package org.openmetadata.service.alerts;

import static org.openmetadata.schema.type.Function.ParameterType.ALL_INDEX_ELASTIC_SEARCH;
import static org.openmetadata.schema.type.Function.ParameterType.NOT_REQUIRED;
import static org.openmetadata.schema.type.Function.ParameterType.READ_FROM_PARAM_CONTEXT;
import static org.openmetadata.schema.type.Function.ParameterType.SPECIFIC_INDEX_ELASTIC_SEARCH;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.USER;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.Function;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.ChangeEventParser;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class AlertsRuleEvaluator {
  public enum AlertRuleType {
    matchAnySource,
    matchAnyOwnerName,
    matchAnyEntityFqn,
    matchAnyEntityId,
    matchAnyEventType,
    matchTestResult,
    matchUpdatedBy,
    matchAnyFieldChange
  }

  private final ChangeEvent changeEvent;

  public AlertsRuleEvaluator(ChangeEvent event) {
    this.changeEvent = event;
  }

  @Function(
      name = "matchAnySource",
      input = "List of comma separated source",
      description = "Returns true if the change event entity being accessed has source as mentioned in condition",
      examples = {"matchAnySource('bot', 'user')"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchAnySource(String... originEntities) {
    if (changeEvent == null || changeEvent.getEntityType() == null) {
      return false;
    }
    String changeEventEntity = changeEvent.getEntityType();
    for (String entityType : originEntities) {
      if (changeEventEntity.equals(entityType)) {
        return true;
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyOwnerName",
      input = "List of comma separated ownerName",
      description = "Returns true if the change event entity being accessed has following owners from the List.",
      examples = {"matchAnyOwnerName('Owner1', 'Owner2')"},
      paramInputType = SPECIFIC_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyOwnerName(String... ownerNameList) throws IOException {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return false;
    }
    EntityInterface entity = getEntity(changeEvent);
    EntityReference ownerReference = entity.getOwner();
    if (ownerReference != null) {
      if (USER.equals(ownerReference.getType())) {
        User user = SubjectCache.getInstance().getSubjectContext(ownerReference.getId()).getUser();
        for (String name : ownerNameList) {
          if (user.getName().equals(name)) {
            return true;
          }
        }
      } else if (TEAM.equals(ownerReference.getType())) {
        Team team = SubjectCache.getInstance().getTeam(ownerReference.getId());
        for (String name : ownerNameList) {
          if (team.getName().equals(name)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyEntityFqn",
      input = "List of comma separated entityName",
      description = "Returns true if the change event entity being accessed has following entityName from the List.",
      examples = {"matchAnyEntityFqn('Name1', 'Name')"},
      paramInputType = ALL_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyEntityFqn(String... entityNames) throws IOException {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return false;
    }
    EntityInterface entity = getEntity(changeEvent);
    for (String name : entityNames) {
      if (entity.getFullyQualifiedName().equals(name)) {
        return true;
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyEntityId",
      input = "List of comma separated entity Ids",
      description = "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {"matchAnyEntityId('uuid1', 'uuid2')"},
      paramInputType = ALL_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyEntityId(String... entityIds) throws IOException {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return false;
    }
    EntityInterface entity = getEntity(changeEvent);
    for (String id : entityIds) {
      if (entity.getId().equals(UUID.fromString(id))) {
        return true;
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyEventType",
      input = "List of comma separated eventTypes",
      description = "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {"matchAnyEventType('entityCreated', 'entityUpdated', 'entityDeleted', 'entitySoftDeleted')"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchAnyEventType(String... eventTypesList) {
    if (changeEvent == null || changeEvent.getEventType() == null) {
      return false;
    }
    String eventType = changeEvent.getEventType().toString();
    for (String type : eventTypesList) {
      if (eventType.equals(type)) {
        return true;
      }
    }
    return false;
  }

  @Function(
      name = "matchTestResult",
      input = "List of comma separated eventTypes",
      description = "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {"matchTestResult('Success', 'Failed', 'Aborted')"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchTestResult(String... testResults) {
    if (changeEvent == null || changeEvent.getChangeDescription() == null) {
      return false;
    }
    if (!changeEvent.getEntityType().equals(TEST_CASE)) {
      // in case the entity is not test case return since the filter doesn't apply
      return true;
    }
    for (FieldChange fieldChange : changeEvent.getChangeDescription().getFieldsUpdated()) {
      if (fieldChange.getName().equals("testCaseResult") && fieldChange.getNewValue() != null) {
        TestCaseResult testCaseResult = (TestCaseResult) fieldChange.getNewValue();
        TestCaseStatus status = testCaseResult.getTestCaseStatus();
        for (String givenStatus : testResults) {
          if (givenStatus.equals(status.value())) {
            return true;
          }
        }
      }
    }
    return false;
  }

  @Function(
      name = "matchUpdatedBy",
      input = "List of comma separated user names that updated the entity",
      description = "Returns true if the change event entity is updated by the mentioned users",
      examples = {"matchUpdatedBy('user1', 'user2')"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchUpdatedBy(String... updatedByUserList) {
    if (changeEvent == null || changeEvent.getUserName() == null) {
      return false;
    }
    String entityUpdatedBy = changeEvent.getUserName();
    for (String name : updatedByUserList) {
      if (name.equals(entityUpdatedBy)) {
        return true;
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyFieldChange",
      input = "List of comma separated fields change",
      description = "Returns true if the change event entity is updated by the mentioned users",
      examples = {"matchAnyFieldChange('fieldName1', 'fieldName')"},
      paramInputType = NOT_REQUIRED)
  public boolean matchAnyFieldChange(String... fieldChangeUpdate) {
    if (changeEvent == null || changeEvent.getChangeDescription() == null) {
      return false;
    }
    Set<String> fields = ChangeEventParser.getUpdatedField(changeEvent);
    for (String name : fieldChangeUpdate) {
      if (fields.contains(name)) {
        return true;
      }
    }
    return false;
  }

  private EntityInterface getEntity(ChangeEvent event) throws IOException {
    Class<? extends EntityInterface> entityClass = Entity.getEntityClassFromType(event.getEntityType());
    EntityInterface entity;
    if (event.getEntity() instanceof String) {
      entity = JsonUtils.readValue((String) event.getEntity(), entityClass);
    } else {
      entity = JsonUtils.convertValue(event.getEntity(), entityClass);
    }
    return entity;
  }
}

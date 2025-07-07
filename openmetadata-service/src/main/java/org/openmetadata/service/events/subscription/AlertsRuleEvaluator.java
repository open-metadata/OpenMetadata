package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Function.ParameterType.ALL_INDEX_ELASTIC_SEARCH;
import static org.openmetadata.schema.type.Function.ParameterType.NOT_REQUIRED;
import static org.openmetadata.schema.type.Function.ParameterType.READ_FROM_PARAM_CONTEXT;
import static org.openmetadata.schema.type.Function.ParameterType.READ_FROM_PARAM_CONTEXT_PER_ENTITY;
import static org.openmetadata.schema.type.Function.ParameterType.SPECIFIC_INDEX_ELASTIC_SEARCH;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.THREAD;
import static org.openmetadata.service.Entity.USER;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.Function;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class AlertsRuleEvaluator {
  private final ChangeEvent changeEvent;

  public AlertsRuleEvaluator(ChangeEvent event) {
    this.changeEvent = event;
  }

  @Function(
      name = "matchAnySource",
      input = "List of comma separated source",
      description =
          "Returns true if the change event entity being accessed has source as mentioned in condition",
      examples = {"matchAnySource({'bot', 'user'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchAnySource(List<String> originEntities) {
    if (changeEvent == null || changeEvent.getEntityType() == null) {
      return false;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
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
      description =
          "Returns true if the change event entity being accessed has following owners from the List.",
      examples = {"matchAnyOwnerName({'Owner1', 'Owner2'})"},
      paramInputType = SPECIFIC_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyOwnerName(List<String> ownerNameList) {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return false;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    EntityInterface entity = getEntity(changeEvent);
    List<EntityReference> ownerReferences = entity.getOwners();
    if (nullOrEmpty(ownerReferences)) {
      entity =
          Entity.getEntity(
              changeEvent.getEntityType(), entity.getId(), "owners", Include.NON_DELETED);
      ownerReferences = entity.getOwners();
    }
    if (!nullOrEmpty(ownerReferences)) {
      return matchOwners(ownerReferences, ownerNameList);
    }

    if (changeEvent.getEntityType().equals(TEST_CASE)) {
      // If we did not match on the owner name and are dealing with a test case,
      // check if the match happens on the test suite owner name
      TestCase testCase =
          Entity.getEntity(
              changeEvent.getEntityType(),
              entity.getId(),
              "testSuites,owners",
              Include.NON_DELETED);
      Optional<List<TestSuite>> testSuites = Optional.ofNullable(testCase.getTestSuites());
      return testSuites.filter(suites -> testSuiteOwnerMatcher(suites, ownerNameList)).isPresent();
    }
    return false;
  }

  @Function(
      name = "matchAnyEntityFqn",
      input = "List of comma separated entityName",
      description =
          "Returns true if the change event entity being accessed has following entityName from the List.",
      examples = {"matchAnyEntityFqn({'FQN1', 'FQN2'})"},
      paramInputType = ALL_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyEntityFqn(List<String> entityNames) {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return false;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    EntityInterface entity = getEntity(changeEvent);
    for (String name : entityNames) {
      Pattern pattern = Pattern.compile(name);
      Matcher matcher = pattern.matcher(entity.getFullyQualifiedName());
      if (matcher.find()) {
        return true;
      }
    }

    if (changeEvent.getEntityType().equals(TEST_CASE)) {
      // If we did not match on the entity FQN and are dealing with a test case,
      // check if the match happens on the test suite FQN
      TestCase testCase = ((TestCase) entity);
      Optional<List<TestSuite>> testSuites = Optional.ofNullable(testCase.getTestSuites());
      return testSuites.filter(suites -> testSuiteMatcher(suites, entityNames)).isPresent();
    }

    return false;
  }

  @Function(
      name = "matchAnyEntityId",
      input = "List of comma separated entity Ids",
      description =
          "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {"matchAnyEntityId({'uuid1', 'uuid2'})"},
      paramInputType = ALL_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyEntityId(List<String> entityIds) {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return false;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
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
      description =
          "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {
        "matchAnyEventType('entityCreated', 'entityUpdated', 'entityDeleted', 'entitySoftDeleted')"
      },
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchAnyEventType(List<String> eventTypesList) {
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
      description =
          "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {"matchTestResult({'Success', 'Failed', 'Aborted'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchTestResult(List<String> testResults) {
    if (changeEvent == null || changeEvent.getChangeDescription() == null) {
      return false;
    }
    if (!changeEvent.getEntityType().equals(TEST_CASE)) {
      // in case the entity is not test case return since the filter doesn't apply
      return true;
    }

    // we need to handle both fields updated and fields added
    List<FieldChange> fieldChanges = changeEvent.getChangeDescription().getFieldsUpdated();
    if (!changeEvent.getChangeDescription().getFieldsAdded().isEmpty()) {
      fieldChanges.addAll(changeEvent.getChangeDescription().getFieldsAdded());
    }

    for (FieldChange fieldChange : fieldChanges) {
      if (fieldChange.getName().equals("testCaseResult") && fieldChange.getNewValue() != null) {
        TestCaseResult testCaseResult =
            JsonUtils.readOrConvertValue(fieldChange.getNewValue(), TestCaseResult.class);
        TestCaseStatus status = testCaseResult.getTestCaseStatus();
        for (String givenStatus : testResults) {
          if (givenStatus.equalsIgnoreCase(status.value())) {
            return true;
          }
        }
      }
    }
    return false;
  }

  @Function(
      name = "filterByTableNameTestCaseBelongsTo",
      input = "List of comma separated Test Suite",
      description =
          "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {"filterByTableNameTestCaseBelongsTo({'tableName1', 'tableName2'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean filterByTableNameTestCaseBelongsTo(List<String> tableNameList) {
    if (changeEvent == null) {
      return false;
    }
    if (!changeEvent.getEntityType().equals(TEST_CASE)) {
      // in case the entity is not test case return since the filter doesn't apply
      return true;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    EntityInterface entity = getEntity(changeEvent);
    for (String name : tableNameList) {
      // Escape regex special characters in table name for exact matching
      String escapedName = Pattern.quote(name);

      // Construct regex to match table name exactly, allowing for end of string or delimiter (.)
      String regex = "\\b" + escapedName + "(\\b|\\.|$)";
      Pattern pattern = Pattern.compile(regex);

      Matcher matcher = pattern.matcher(entity.getFullyQualifiedName());
      if (matcher.find()) {
        return true;
      }
    }
    return false;
  }

  @Function(
      name = "getTestCaseStatusIfInTestSuite",
      input = "List of comma separated Test Suite",
      description =
          "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {
        "getTestCaseStatusIfInTestSuite({'testSuite1','testSuite2'}, {'Success', 'Failed', 'Aborted'})"
      },
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean getTestCaseStatusIfInTestSuite(
      List<String> testResults, List<String> testSuiteList) {
    if (changeEvent == null || changeEvent.getChangeDescription() == null) {
      return false;
    }
    if (!changeEvent.getEntityType().equals(TEST_CASE)) {
      // in case the entity is not test case return since the filter doesn't apply
      return true;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    // we need to handle both fields updated and fields added
    EntityInterface entity = getEntity(changeEvent);
    TestCase entityWithTestSuite =
        Entity.getEntity(
            changeEvent.getEntityType(), entity.getId(), "testSuites", Include.NON_DELETED);
    boolean testSuiteFiltering =
        listOrEmpty(entityWithTestSuite.getTestSuites()).stream()
            .anyMatch(
                testSuite ->
                    testSuiteList.stream()
                        .anyMatch(name -> testSuite.getFullyQualifiedName().equals(name)));
    if (testSuiteFiltering) {
      return matchTestResult(testResults);
    }
    return false;
  }

  @Function(
      name = "matchUpdatedBy",
      input = "List of comma separated user names that updated the entity",
      description = "Returns true if the change event entity is updated by the mentioned users",
      examples = {"matchUpdatedBy({'user1', 'user2'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchUpdatedBy(List<String> updatedByUserList) {
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
      name = "isBot",
      input = "Check if the updating user is a bot",
      description = "Returns true if the change event entity is updated by a bot",
      examples = {"isBot()"},
      paramInputType = NOT_REQUIRED)
  public boolean isBot() {
    if (changeEvent == null || changeEvent.getUserName() == null) {
      return false;
    }
    String entityUpdatedBy = changeEvent.getUserName();
    User user = Entity.getEntityByName(Entity.USER, entityUpdatedBy, "id", Include.NON_DELETED);
    return user.getIsBot();
  }

  @Function(
      name = "matchIngestionPipelineState",
      input = "List of comma separated ingestion pipeline states",
      description =
          "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {
        "matchIngestionPipelineState({'queued', 'success', 'failed', 'running', 'partialSuccess'})"
      },
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchIngestionPipelineState(List<String> pipelineState) {
    if (changeEvent == null || changeEvent.getChangeDescription() == null) {
      return false;
    }
    if (!changeEvent.getEntityType().equals(INGESTION_PIPELINE)) {
      // in case the entity is not ingestion pipeline return since the filter doesn't apply
      return true;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    for (FieldChange fieldChange : changeEvent.getChangeDescription().getFieldsUpdated()) {
      if (fieldChange.getName().equals("pipelineStatus") && fieldChange.getNewValue() != null) {
        PipelineStatus pipelineStatus =
            JsonUtils.readOrConvertValue(fieldChange.getNewValue(), PipelineStatus.class);
        PipelineStatusType status = pipelineStatus.getPipelineState();
        for (String givenStatus : pipelineState) {
          if (givenStatus.equalsIgnoreCase(status.value())) {
            return true;
          }
        }
      }
    }
    return false;
  }

  @Function(
      name = "matchPipelineState",
      input = "List of comma separated pipeline states",
      description =
          "Returns true if the change event entity being accessed has following entityId from the List.",
      examples = {"matchPipelineState({'Successful', 'Failed', 'Pending', 'Skipped'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchPipelineState(List<String> pipelineState) {
    if (changeEvent == null || changeEvent.getChangeDescription() == null) {
      return false;
    }
    if (!changeEvent.getEntityType().equals(PIPELINE)) {
      // in case the entity is not ingestion pipeline return since the filter doesn't apply
      return true;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    for (FieldChange fieldChange : changeEvent.getChangeDescription().getFieldsUpdated()) {
      if (fieldChange.getName().equals("pipelineStatus") && fieldChange.getNewValue() != null) {
        org.openmetadata.schema.entity.data.PipelineStatus pipelineStatus =
            JsonUtils.convertValue(
                fieldChange.getNewValue(),
                org.openmetadata.schema.entity.data.PipelineStatus.class);
        StatusType status = pipelineStatus.getExecutionStatus();
        for (String givenStatus : pipelineState) {
          if (givenStatus.equalsIgnoreCase(status.value())) {
            return true;
          }
        }
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyFieldChange",
      input = "List of comma separated fields change",
      description = "Returns true if the change event entity is updated by the mentioned users",
      examples = {"matchAnyFieldChange({'fieldName1', 'fieldName'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT_PER_ENTITY)
  public boolean matchAnyFieldChange(List<String> fieldChangeUpdate) {
    if (changeEvent == null || changeEvent.getChangeDescription() == null) {
      return false;
    }
    Set<String> fields = FormatterUtil.getUpdatedField(changeEvent);
    for (String name : fieldChangeUpdate) {
      if (fields.contains(name)) {
        return true;
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyDomain",
      input = "List of comma separated Domains",
      description = "Returns true if the change event entity belongs to a domain from the list",
      examples = {"matchAnyDomain({'domain1', 'domain2'})"},
      paramInputType = SPECIFIC_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyDomain(List<String> fieldChangeUpdate) {
    if (changeEvent == null) {
      return false;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    EntityInterface entity = getEntity(changeEvent);
    EntityInterface entityWithDomainData =
        Entity.getEntity(
            changeEvent.getEntityType(), entity.getId(), "domain", Include.NON_DELETED);
    if (entityWithDomainData.getDomain() != null) {
      for (String name : fieldChangeUpdate) {
        if (entityWithDomainData.getDomain().getFullyQualifiedName().equals(name)) {
          return true;
        }
      }
    }

    if (changeEvent.getEntityType().equals(TEST_CASE)) {
      // If we did not match on the domain and are dealing with a test case,
      // check if the match happens on the test suite domain
      TestCase testCase = ((TestCase) entity);
      Optional<List<TestSuite>> testSuites = Optional.ofNullable(testCase.getTestSuites());
      return testSuites.filter(suites -> testSuiteMatcher(suites, fieldChangeUpdate)).isPresent();
    }
    return false;
  }

  public static EntityInterface getEntity(ChangeEvent event) {
    Class<? extends EntityInterface> entityClass =
        Entity.getEntityClassFromType(event.getEntityType());
    if (entityClass != null) {
      EntityInterface entity;
      if (event.getEntity() instanceof String str) {
        entity = JsonUtils.readValue(str, entityClass);
      } else {
        entity = JsonUtils.convertValue(event.getEntity(), entityClass);
      }
      return entity;
    }
    throw new IllegalArgumentException(
        String.format(
            "Change Event Data Asset is not an entity %s",
            JsonUtils.pojoToJson(event.getEntity())));
  }

  public static Thread getThreadEntity(ChangeEvent event) {
    Thread entity;
    if (event.getEntity() instanceof String str) {
      entity = JsonUtils.readValue(str, Thread.class);
    } else {
      entity = JsonUtils.convertValue(event.getEntity(), Thread.class);
    }
    return entity;
  }

  @Function(
      name = "matchConversationUser",
      input = "List of comma separated user names to matchConversationUser",
      description = "Returns true if the conversation mentions the user names in the list",
      examples = {"matchConversationUser({'user1', 'user2'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean matchConversationUser(List<String> usersOrTeamName) {
    if (changeEvent == null || changeEvent.getEntityType() == null) {
      return false;
    }

    // Filter does not apply to Thread Change Events
    if (!changeEvent.getEntityType().equals(THREAD)) {
      return false;
    }

    if (usersOrTeamName.size() == 1 && usersOrTeamName.get(0).equals("all")) {
      return true;
    }

    Thread thread = getThread(changeEvent);

    List<MessageParser.EntityLink> mentions;
    if (thread.getPostsCount() == 0) {
      mentions = MessageParser.getEntityLinks(thread.getMessage());
    } else {
      Post latestPost = thread.getPosts().get(thread.getPostsCount() - 1);
      mentions = MessageParser.getEntityLinks(latestPost.getMessage());
    }
    for (MessageParser.EntityLink entityLink : mentions) {
      String fqn = entityLink.getEntityFQN();
      if (USER.equals(entityLink.getEntityType())) {
        User user = Entity.getCollectionDAO().userDAO().findEntityByName(fqn);
        if (usersOrTeamName.contains(user.getName())) {
          return true;
        }
      } else if (TEAM.equals(entityLink.getEntityType())) {
        Team team = Entity.getCollectionDAO().teamDAO().findEntityByName(fqn);
        if (usersOrTeamName.contains(team.getName())) {
          return true;
        }
      }
    }
    return false;
  }

  public static Thread getThread(ChangeEvent event) {
    try {
      Thread thread;
      if (event.getEntity() instanceof String str) {
        thread = JsonUtils.readValue(str, Thread.class);
      } else {
        thread = JsonUtils.convertValue(event.getEntity(), Thread.class);
      }
      return thread;
    } catch (Exception ex) {
      throw new IllegalArgumentException(
          String.format(
              "Change Event Data Asset is not an Thread %s",
              JsonUtils.pojoToJson(event.getEntity())));
    }
  }

  private boolean testSuiteMatcher(List<TestSuite> testSuites, List<String> entityNames) {
    for (TestSuite testSuite : testSuites) {
      for (String name : entityNames) {
        Pattern pattern = Pattern.compile(name);
        Matcher matcherTestSuiteFQN = pattern.matcher(testSuite.getFullyQualifiedName());
        if (matcherTestSuiteFQN.find()) return true;
        if (testSuite.getDomain() != null) {
          Matcher matcherDomainFQN = pattern.matcher(testSuite.getDomain().getFullyQualifiedName());
          if (matcherDomainFQN.find()) return true;
        }
      }
    }
    return false;
  }

  private boolean testSuiteOwnerMatcher(List<TestSuite> testSuites, List<String> ownerNameList) {
    boolean match;
    for (TestSuite testSuite : testSuites) {
      List<EntityReference> owners = testSuite.getOwners();
      match = matchOwners(owners, ownerNameList);
      if (match) return true;
    }
    return false;
  }

  private boolean matchOwners(List<EntityReference> ownerReferences, List<String> ownerNameList) {
    for (EntityReference owner : ownerReferences) {
      if (USER.equals(owner.getType())) {
        User user = Entity.getEntity(Entity.USER, owner.getId(), "", Include.NON_DELETED);
        for (String name : ownerNameList) {
          if (user.getName().equals(name)) {
            return true;
          }
        }
      } else if (TEAM.equals(owner.getType())) {
        Team team = Entity.getEntity(Entity.TEAM, owner.getId(), "", Include.NON_DELETED);
        for (String name : ownerNameList) {
          if (team.getName().equals(name)) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

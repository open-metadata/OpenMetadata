package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Function.ParameterType.ALL_INDEX_ELASTIC_SEARCH;
import static org.openmetadata.schema.type.Function.ParameterType.NOT_REQUIRED;
import static org.openmetadata.schema.type.Function.ParameterType.READ_FROM_PARAM_CONTEXT;
import static org.openmetadata.schema.type.Function.ParameterType.READ_FROM_PARAM_CONTEXT_PER_ENTITY;
import static org.openmetadata.schema.type.Function.ParameterType.SPECIFIC_INDEX_ELASTIC_SEARCH;
import static org.openmetadata.service.Entity.DATA_CONTRACT;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.TASK;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.THREAD;
import static org.openmetadata.service.Entity.USER;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.Function;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FullyQualifiedName;

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
      input = "List of comma separated fully qualified entity names",
      description =
          "Returns true if the change event entity's fully qualified name equals, or is a descendant of, any of the listed FQNs.",
      examples = {
        "matchAnyEntityFqn({'service.database.schema.table1', 'service.database.schema.table2'})"
      },
      paramInputType = ALL_INDEX_ELASTIC_SEARCH)
  public boolean matchAnyEntityFqn(List<String> entityFqns) {
    if (changeEvent == null || changeEvent.getEntity() == null) {
      return false;
    }

    // Filter does not apply to Thread Change Events
    if (changeEvent.getEntityType().equals(THREAD)) {
      return true;
    }

    EntityInterface entity = getEntity(changeEvent);
    if (matchesFqnOrDescendant(entity.getFullyQualifiedName(), entityFqns)) {
      return true;
    }

    if (changeEvent.getEntityType().equals(TEST_CASE)) {
      // If we did not match on the entity FQN and are dealing with a test case,
      // check if the match happens on the test suite FQN
      TestCase testCase = ((TestCase) entity);
      Optional<List<TestSuite>> testSuites = Optional.ofNullable(testCase.getTestSuites());
      return testSuites.filter(suites -> testSuiteMatcher(suites, entityFqns)).isPresent();
    }

    return false;
  }

  // Matches the entity FQN exactly or as a descendant (segment-anchored via isParent, no regex).
  private boolean matchesFqnOrDescendant(String entityFqn, List<String> entityFqns) {
    boolean matched = false;
    if (entityFqn != null) {
      for (String listedFqn : entityFqns) {
        if (entityFqn.equals(listedFqn) || FullyQualifiedName.isParent(entityFqn, listedFqn)) {
          matched = true;
          break;
        }
      }
    }
    return matched;
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
    if (!changeEvent.getEntityType().equals(TEST_CASE)
        && !changeEvent.getEntityType().equals(TEST_SUITE)) {
      // Trigger requires a test case result; non-test-case events (incl. THREAD) cannot fire it.
      return false;
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

      if (fieldChange.getName().equals("testCaseResultSummary")
          && fieldChange.getNewValue() != null) {
        List<ResultSummary> resultSummaries =
            JsonUtils.readOrConvertValues(fieldChange.getNewValue(), ResultSummary.class);

        for (ResultSummary resultSummary : resultSummaries) {
          if (!nullOrEmpty(resultSummary.getStatus())
              && testResults.contains(resultSummary.getStatus().value())) {
            return true;
          }
        }
      }
    }
    return false;
  }

  @Function(
      name = "filterByTableNameTestCaseBelongsTo",
      input = "List of comma separated fully qualified table names",
      description =
          "Returns true if the change event entity is a test case whose parent table FQN equals any of the listed FQNs.",
      examples = {
        "filterByTableNameTestCaseBelongsTo({'service.database.schema.table1', 'service.database.schema.table2'})"
      },
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public boolean filterByTableNameTestCaseBelongsTo(List<String> tableFqns) {
    if (changeEvent == null) {
      return false;
    }
    if (!changeEvent.getEntityType().equals(TEST_CASE)) {
      return true;
    }
    TestCase testCase = (TestCase) getEntity(changeEvent);
    String parentFqn = resolveParentTableFqn(testCase);
    return parentFqn != null && tableFqns.contains(parentFqn);
  }

  private String resolveParentTableFqn(TestCase testCase) {
    if (testCase.getEntityFQN() != null) {
      return testCase.getEntityFQN();
    }
    if (testCase.getEntityLink() != null) {
      return MessageParser.EntityLink.parse(testCase.getEntityLink()).getEntityFQN();
    }
    return null;
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
      // Trigger requires a test case result; non-test-case events (incl. THREAD) cannot fire it.
      return false;
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
    try {
      User user = Entity.getEntityByName(Entity.USER, entityUpdatedBy, "id", Include.NON_DELETED);
      return Boolean.TRUE.equals(user.getIsBot());
    } catch (EntityNotFoundException e) {
      return false;
    }
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
      // Trigger requires a pipeline status; non-pipeline events (incl. THREAD) cannot fire it.
      return false;
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
      // Trigger requires a pipeline status; non-pipeline events (incl. THREAD) cannot fire it.
      return false;
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
            changeEvent.getEntityType(), entity.getId(), "domains", Include.NON_DELETED);
    if (!nullOrEmpty(entityWithDomainData.getDomains())) {
      for (String name : fieldChangeUpdate) {
        for (EntityReference domain : entityWithDomainData.getDomains()) {
          if (domain.getFullyQualifiedName().equals(name)) {
            return true;
          }
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

    boolean isTask = TASK.equals(changeEvent.getEntityType());
    // Filter applies to conversation (Thread) and incident/task (Task) change events
    if (!THREAD.equals(changeEvent.getEntityType()) && !isTask) {
      return false;
    }

    if (usersOrTeamName.size() == 1 && usersOrTeamName.get(0).equals("all")) {
      return true;
    }

    List<MessageParser.EntityLink> mentions =
        isTask ? getTaskMentions(getTask(changeEvent)) : getThreadMentions(getThread(changeEvent));
    return matchesMentionedUserOrTeam(mentions, usersOrTeamName);
  }

  private List<MessageParser.EntityLink> getThreadMentions(Thread thread) {
    List<MessageParser.EntityLink> mentions;
    if (thread.getPostsCount() == 0) {
      mentions = MessageParser.getEntityLinks(thread.getMessage());
    } else {
      Post latestPost = thread.getPosts().get(thread.getPostsCount() - 1);
      mentions = MessageParser.getEntityLinks(latestPost.getMessage());
    }
    return mentions;
  }

  // A mention notification must fire only for the comment that triggered this event. addComment
  // records the newly-added comment in the change delta, so we parse exactly that text — never
  // earlier comments (which would re-notify their mentionees on every reply). Non-comment task
  // updates (assignees/status) carry no comment delta, so nobody is newly mentioned.
  public static List<MessageParser.EntityLink> getTaskMentions(Task task) {
    String addedComment = addedCommentMessage(task.getChangeDescription());
    if (addedComment != null) {
      return MessageParser.getEntityLinks(addedComment);
    }
    if (task.getChangeDescription() != null) {
      return List.of();
    }
    // No change delta (legacy/unknown event): fall back to the latest comment, else the
    // description.
    List<TaskComment> comments = task.getComments();
    if (!nullOrEmpty(comments) && comments.get(comments.size() - 1).getMessage() != null) {
      return MessageParser.getEntityLinks(comments.get(comments.size() - 1).getMessage());
    }
    return task.getDescription() == null
        ? List.of()
        : MessageParser.getEntityLinks(task.getDescription());
  }

  private static String addedCommentMessage(ChangeDescription change) {
    if (change == null) {
      return null;
    }
    for (FieldChange field : listOrEmpty(change.getFieldsAdded())) {
      if (TaskRepository.FIELD_COMMENTS.equals(field.getName())
          && !nullOrEmpty(field.getNewValue())) {
        return field.getNewValue().toString();
      }
    }
    return null;
  }

  private boolean matchesMentionedUserOrTeam(
      List<MessageParser.EntityLink> mentions, List<String> usersOrTeamName) {
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

  public static Task getTask(ChangeEvent event) {
    try {
      Task task;
      if (event.getEntity() instanceof String str) {
        task = JsonUtils.readValue(str, Task.class);
      } else {
        task = JsonUtils.convertValue(event.getEntity(), Task.class);
      }
      return task;
    } catch (Exception ex) {
      throw new IllegalArgumentException(
          String.format(
              "Change Event Data Asset is not a Task %s", JsonUtils.pojoToJson(event.getEntity())));
    }
  }

  private boolean testSuiteMatcher(List<TestSuite> testSuites, List<String> entityFqns) {
    for (TestSuite testSuite : testSuites) {
      if (entityFqns.contains(testSuite.getFullyQualifiedName())) {
        return true;
      }
      if (!nullOrEmpty(testSuite.getDomains())) {
        for (EntityReference domain : testSuite.getDomains()) {
          if (entityFqns.contains(domain.getFullyQualifiedName())) {
            return true;
          }
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

  @Function(
      name = "matchDataContractStatus",
      input = "List of data contract statuses",
      description =
          "Returns true if the change event is for a data contract with status in the given list.",
      examples = {"matchDataContractStatus({'Failed', 'Aborted'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public Boolean matchDataContractStatus(List<String> statuses) {
    if (changeEvent.getEntityType().equals(DATA_CONTRACT)) {
      try {
        DataContract dataContract =
            JsonUtils.readValue(changeEvent.getEntity().toString(), DataContract.class);
        if (dataContract.getLatestResult() != null) {
          String currentStatus = dataContract.getLatestResult().getStatus().value();
          return statuses.contains(currentStatus);
        }
      } catch (Exception e) {
        LOG.warn("Failed to parse DataContract from change event", e);
      }
    }
    return false;
  }

  @Function(
      name = "filterByEntityNameDataContractBelongsTo",
      input = "List of comma separated fully qualified entity names",
      description =
          "Returns true if the change event is for a data contract whose target entity FQN equals any of the listed FQNs.",
      examples = {"filterByEntityNameDataContractBelongsTo({'service.database.schema.table1'})"},
      paramInputType = READ_FROM_PARAM_CONTEXT)
  public Boolean filterByEntityNameDataContractBelongsTo(List<String> entityFqns) {
    if (changeEvent == null || !changeEvent.getEntityType().equals(DATA_CONTRACT)) {
      return false;
    }
    try {
      DataContract dataContract =
          JsonUtils.readValue(changeEvent.getEntity().toString(), DataContract.class);
      if (dataContract.getEntity() == null) {
        return false;
      }
      return entityFqns.contains(dataContract.getEntity().getFullyQualifiedName());
    } catch (Exception e) {
      LOG.warn("Failed to parse DataContract from change event", e);
      return false;
    }
  }
}

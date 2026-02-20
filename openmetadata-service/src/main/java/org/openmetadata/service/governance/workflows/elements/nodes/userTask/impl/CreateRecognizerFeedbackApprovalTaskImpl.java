package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RECOGNIZER_FEEDBACK;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.apache.commons.lang3.math.NumberUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.task.service.delegate.DelegateTask;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelRecognizerMetadata;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.resources.feeds.FeedMapper;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public class CreateRecognizerFeedbackApprovalTaskImpl implements TaskListener {
  private Expression inputNamespaceMapExpr;
  private Expression approvalThresholdExpr;
  private Expression rejectionThresholdExpr;

  @Override
  public void notify(DelegateTask delegateTask) {
    LOG.debug(
        "[Process: {}] Creating RecognizerFeedback approval task, task ID: {}",
        delegateTask.getProcessInstanceId(),
        delegateTask.getId());
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(delegateTask);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(delegateTask), Map.class);
      List<EntityReference> assignees = getAssignees(delegateTask);

      String feedbackJson =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(RECOGNIZER_FEEDBACK), RECOGNIZER_FEEDBACK);
      RecognizerFeedback feedback = JsonUtils.readValue(feedbackJson, RecognizerFeedback.class);

      String tagEntityLink =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);
      MessageParser.EntityLink tagLink = MessageParser.EntityLink.parse(tagEntityLink);
      Tag tag =
          Entity.getEntityByName(
              Entity.TAG, tagLink.getEntityFQN(), "reviewers,owners", Include.ALL);

      int approvalThreshold = 1;
      if (approvalThresholdExpr != null) {
        String thresholdStr = (String) approvalThresholdExpr.getValue(delegateTask);
        if (thresholdStr != null && !thresholdStr.isEmpty()) {

          approvalThreshold = NumberUtils.toInt(thresholdStr, approvalThreshold);
        }
      }

      int rejectionThreshold = 1;
      if (rejectionThresholdExpr != null) {
        String thresholdStr = (String) rejectionThresholdExpr.getValue(delegateTask);
        if (thresholdStr != null && !thresholdStr.isEmpty()) {
          rejectionThreshold = NumberUtils.toInt(thresholdStr, rejectionThreshold);
        }
      }

      Thread task =
          createRecognizerFeedbackApprovalTask(
              tag, feedback, assignees, approvalThreshold, rejectionThreshold);
      WorkflowHandler.getInstance().setCustomTaskId(delegateTask.getId(), task.getId());
      LOG.debug(
          "[Process: {}] ✓ Created approval task thread ID: {}, flowable task ID: {}",
          delegateTask.getProcessInstanceId(),
          task.getId(),
          delegateTask.getId());

      delegateTask.setVariable("approvalThreshold", approvalThreshold);
      delegateTask.setVariable("rejectionThreshold", rejectionThreshold);
      delegateTask.setVariable("approversList", new ArrayList<String>());
      delegateTask.setVariable("rejectersList", new ArrayList<String>());
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ",
              getProcessDefinitionKeyFromId(delegateTask.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private List<EntityReference> getAssignees(DelegateTask delegateTask) {
    List<EntityReference> assignees = new ArrayList<>();

    Set<IdentityLink> candidates = delegateTask.getCandidates();
    if (!candidates.isEmpty()) {
      for (IdentityLink candidate : candidates) {
        assignees.add(getEntityReferenceFromLinkString(candidate.getUserId()));
      }
    } else if (delegateTask.getAssignee() != null) {
      assignees.add(getEntityReferenceFromLinkString(delegateTask.getAssignee()));
    }
    return assignees;
  }

  private EntityReference getEntityReferenceFromLinkString(String entityLinkString) {
    MessageParser.EntityLink assigneeEntityLink = MessageParser.EntityLink.parse(entityLinkString);
    return Entity.getEntityReferenceByName(
        assigneeEntityLink.getEntityType(), assigneeEntityLink.getEntityFQN(), Include.NON_DELETED);
  }

  private Thread createRecognizerFeedbackApprovalTask(
      Tag tag,
      RecognizerFeedback feedback,
      List<EntityReference> assignees,
      Integer approvalThreshold,
      Integer rejectionThreshold) {
    FeedRepository feedRepository = Entity.getFeedRepository();
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(Entity.TAG, tag.getFullyQualifiedName());

    String createdByFqn =
        feedback.getCreatedBy() != null
            ? feedback.getCreatedBy().getFullyQualifiedName()
            : "unknown";

    Thread thread;

    try {
      thread = feedRepository.getTask(about, TaskType.RecognizerFeedbackApproval, TaskStatus.Open);
      WorkflowHandler.getInstance()
          .terminateTaskProcessInstance(thread.getId(), "A Newer Process Instance is Running.");
      LOG.debug(
          "Open task with type [{}] for [{}] terminated to create a newer instance.",
          TaskType.RecognizerFeedbackApproval,
          about.getLinkString());
      thread = null;
    } catch (EntityNotFoundException ex) {
      LOG.debug(
          "Creating a new task with type [{}] for [{}]",
          TaskType.RecognizerFeedbackApproval,
          about.getLinkString());
      thread = null;
    }

    TagLabelRecognizerMetadata recognizer = null;
    if (feedback.getEntityLink() != null && feedback.getTagFQN() != null) {
      try {
        MessageParser.EntityLink entityLink =
            MessageParser.EntityLink.parse(feedback.getEntityLink());
        String targetFQN = entityLink.getFullyQualifiedFieldValue();
        CollectionDAO.TagUsageDAO tagUsageDAO = Entity.getCollectionDAO().tagUsageDAO();
        List<TagLabel> tags = tagUsageDAO.getTags(targetFQN);
        recognizer =
            tags.stream()
                .filter(tagLabel -> feedback.getTagFQN().equals(tagLabel.getTagFQN()))
                .findFirst()
                .filter(tagLabel -> tagLabel.getMetadata() != null)
                .map(tagLabel -> tagLabel.getMetadata().getRecognizer())
                .orElse(null);
      } catch (Exception ex) {
        LOG.warn(
            "Failed to retrieve recognizer metadata for feedback {}: {}",
            feedback.getId(),
            ex.getMessage());
      }
    }

    TaskDetails taskDetails =
        new TaskDetails()
            .withAssignees(FeedMapper.formatAssignees(assignees))
            .withType(TaskType.RecognizerFeedbackApproval)
            .withStatus(TaskStatus.Open)
            .withFeedback(feedback)
            .withRecognizer(recognizer);

    thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withThreadTs(System.currentTimeMillis())
            .withMessage(
                String.format("Approval required for recognizer feedback on tag %s", tag.getName()))
            .withCreatedBy(createdByFqn)
            .withAbout(about.getLinkString())
            .withType(ThreadType.Task)
            .withTask(taskDetails)
            .withUpdatedBy(createdByFqn)
            .withUpdatedAt(System.currentTimeMillis());
    feedRepository.create(thread);

    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.THREAD_CREATED)
            .withEntityId(thread.getId())
            .withEntityType(Entity.THREAD)
            .withUserName(createdByFqn)
            .withTimestamp(thread.getUpdatedAt())
            .withEntity(thread);

    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToMaskedJson(changeEvent));

    WebsocketNotificationHandler.handleTaskNotification(thread);

    return thread;
  }
}

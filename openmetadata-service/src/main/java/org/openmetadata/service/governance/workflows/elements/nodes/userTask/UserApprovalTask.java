package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.APPROVE_CONDITION;
import static org.openmetadata.service.governance.workflows.Workflow.LEGACY_APPROVE_CONDITION;
import static org.openmetadata.service.governance.workflows.Workflow.LEGACY_REJECT_CONDITION;
import static org.openmetadata.service.governance.workflows.Workflow.REJECT_CONDITION;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ResolveHeldChangeImpl.DISCARD;
import static org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ResolveHeldChangeImpl.HELD_CHANGE_RESULT;
import static org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ResolveHeldChangeImpl.NOT_APPLIED;
import static org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ResolveHeldChangeImpl.PUBLISH;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ExclusiveGateway;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowNode;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Message;
import org.flowable.bpmn.model.MessageEventDefinition;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.TerminateEventDefinition;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.flowable.bpmn.model.UserTask;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.ExpiryTimer;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.approval.ApprovalDecisionService.ReviewOutcome;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ApprovalTaskCompletionValidator;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.AutoApproveServiceTaskImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ExpireOnTimerImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ResolveHeldChangeImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.SetApprovalAssigneesImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.SetCandidateUsersImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ExclusiveGatewayBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.UserTaskBuilder;

public class UserApprovalTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;
  private final List<Message> messages = new ArrayList<>();

  public UserApprovalTask(UserApprovalTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    this(nodeDefinition, config, TaskEntityType.GlossaryApproval, TaskCategory.Approval);
  }

  public UserApprovalTask(
      UserApprovalTaskDefinition nodeDefinition,
      WorkflowConfiguration config,
      TaskEntityType taskType,
      TaskCategory taskCategory) {
    this(nodeDefinition, config, taskType, taskCategory, false);
  }

  /**
   * An approval task. In a workflow that holds edits ({@code holdsChanges}) it also settles the
   * change request it reviews: see {@link #addHeldChangeResolution}.
   */
  public UserApprovalTask(
      UserApprovalTaskDefinition nodeDefinition,
      WorkflowConfiguration config,
      TaskEntityType taskType,
      TaskCategory taskCategory,
      boolean holdsChanges) {
    String subProcessId = nodeDefinition.getName();
    String assigneesVarName = getFlowableElementId(subProcessId, "assignees");

    FieldExtension assigneesExpr =
        new FieldExtensionBuilder()
            .fieldName("assigneesExpr")
            .fieldValue(
                JsonUtils.pojoToJson(
                    transformAssigneesForFlowable(nodeDefinition.getConfig().getAssignees())))
            .build();

    FieldExtension assigneesVarNameExpr =
        new FieldExtensionBuilder()
            .fieldName("assigneesVarNameExpr")
            .fieldValue(assigneesVarName)
            .build();

    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(
                JsonUtils.pojoToJson(
                    nodeDefinition.getInputNamespaceMap() != null
                        ? nodeDefinition.getInputNamespaceMap()
                        : new HashMap<>()))
            .build();

    FieldExtension approvalThresholdExpr =
        new FieldExtensionBuilder()
            .fieldName("approvalThresholdExpr")
            .fieldValue(String.valueOf(nodeDefinition.getConfig().getApprovalThreshold()))
            .build();

    FieldExtension rejectionThresholdExpr =
        new FieldExtensionBuilder()
            .fieldName("rejectionThresholdExpr")
            .fieldValue(String.valueOf(nodeDefinition.getConfig().getRejectionThreshold()))
            .build();

    FieldExtension taskTypeExpr =
        new FieldExtensionBuilder().fieldName("taskTypeExpr").fieldValue(taskType.value()).build();

    FieldExtension taskCategoryExpr =
        new FieldExtensionBuilder()
            .fieldName("taskCategoryExpr")
            .fieldValue(taskCategory.value())
            .build();

    FieldExtension stageIdExpr =
        new FieldExtensionBuilder(false)
            .fieldName("stageIdExpr")
            .fieldValue(nodeDefinition.getConfig().getStageId())
            .build();

    FieldExtension stageDisplayNameExpr =
        new FieldExtensionBuilder(false)
            .fieldName("stageDisplayNameExpr")
            .fieldValue(nodeDefinition.getConfig().getStageDisplayName())
            .build();

    FieldExtension taskStatusExpr =
        new FieldExtensionBuilder()
            .fieldName("taskStatusExpr")
            .fieldValue(
                nodeDefinition.getConfig().getTaskStatus() != null
                    ? nodeDefinition.getConfig().getTaskStatus().value()
                    : TaskEntityStatus.Open.value())
            .build();

    FieldExtension transitionMetadataExpr =
        new FieldExtensionBuilder(false)
            .fieldName("transitionMetadataExpr")
            .fieldValue(JsonUtils.pojoToJson(nodeDefinition.getConfig().getTransitionMetadata()))
            .build();

    FieldExtension partialDecisionsExpr =
        new FieldExtensionBuilder()
            .fieldName("partialDecisionsExpr")
            .fieldValue(
                String.valueOf(
                    Boolean.TRUE.equals(nodeDefinition.getConfig().getAllowPartialDecisions())))
            .build();

    // Force sync execution on the approval subprocess so the entry path
    // (SetApprovalAssigneesImpl → user task creation → CreateTask listener)
    // runs on the caller's thread inside the current transaction. Without this
    // the async job executor picks up the continuation after POST /resolve
    // returns, which races with client reads and subsequent writes.
    SubProcess subProcess =
        new SubProcessBuilder().id(subProcessId).setAsync(false).exclusive(true).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask setAssigneesVariable =
        getSetAssigneesVariableServiceTask(
            subProcessId, assigneesExpr, assigneesVarNameExpr, inputNamespaceMapExpr);

    // ExclusiveGatewayBuilder defaults to async=true, which pushes the rest of
    // the user task subprocess (including the CreateTask task listener)
    // onto Flowable's async executor. For the incident workflow we want the
    // whole entry path to run on the caller's thread so the POST /resolve
    // response reflects the new stage and assignees. Explicitly turn async off.
    ExclusiveGateway hasAssigneesGateway =
        new ExclusiveGatewayBuilder()
            .id(getFlowableElementId(subProcessId, "hasAssigneesGateway"))
            .name("Check if has assignees")
            .setAsync(false)
            .build();

    UserTask userTask =
        getUserTask(
            subProcessId,
            assigneesVarNameExpr,
            inputNamespaceMapExpr,
            approvalThresholdExpr,
            rejectionThresholdExpr,
            taskTypeExpr,
            taskCategoryExpr,
            stageIdExpr,
            stageDisplayNameExpr,
            taskStatusExpr,
            transitionMetadataExpr,
            partialDecisionsExpr);

    ServiceTask autoApproveTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "autoApproveUserTask"))
            .implementation(AutoApproveServiceTaskImpl.class.getName())
            .addFieldExtension(inputNamespaceMapExpr)
            .build();

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    BoundaryEvent terminationEvent = getTerminationEvent(subProcessId);
    terminationEvent.setAttachedToRef(userTask);

    TerminateEventDefinition terminateEventDefinition = new TerminateEventDefinition();
    terminateEventDefinition.setTerminateAll(true);

    EndEvent terminatedEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "terminatedEvent")).build();
    terminatedEvent.addEventDefinition(terminateEventDefinition);
    attachMainWorkflowTerminationListener(terminatedEvent);

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(setAssigneesVariable);
    subProcess.addFlowElement(hasAssigneesGateway);
    subProcess.addFlowElement(userTask);
    subProcess.addFlowElement(autoApproveTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(terminationEvent);
    subProcess.addFlowElement(terminatedEvent);

    FlowNode decided =
        holdsChanges
            ? addHeldChangeResolution(subProcess, subProcessId, setAssigneesVariable, endEvent)
            : endEvent;

    attachExpiryTimerIfConfigured(nodeDefinition, subProcess, subProcessId, userTask, decided);

    // Start -> SetAssignees
    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), setAssigneesVariable.getId()));

    // SetAssignees -> Gateway
    subProcess.addFlowElement(
        new SequenceFlow(setAssigneesVariable.getId(), hasAssigneesGateway.getId()));

    // Gateway -> UserTask (when hasAssignees = true)
    SequenceFlow toUserTask = new SequenceFlow(hasAssigneesGateway.getId(), userTask.getId());
    toUserTask.setConditionExpression("${hasAssignees}");
    toUserTask.setName("Has assignees");
    subProcess.addFlowElement(toUserTask);

    // Gateway -> AutoApprove (when hasAssignees = false)
    SequenceFlow toAutoApprove =
        new SequenceFlow(hasAssigneesGateway.getId(), autoApproveTask.getId());
    toAutoApprove.setConditionExpression("${!hasAssignees}");
    toAutoApprove.setName("No assignees");
    subProcess.addFlowElement(toAutoApprove);

    hasAssigneesGateway.setDefaultFlow(toAutoApprove.getId());

    // UserTask -> EndEvent, or the held change's resolution
    subProcess.addFlowElement(new SequenceFlow(userTask.getId(), decided.getId()));

    // AutoApprove -> EndEvent, or the held change's resolution
    subProcess.addFlowElement(new SequenceFlow(autoApproveTask.getId(), decided.getId()));

    // Termination boundary event flow
    subProcess.addFlowElement(new SequenceFlow(terminationEvent.getId(), terminatedEvent.getId()));

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.runtimeExceptionBoundaryEvent =
        getRuntimeExceptionBoundaryEvent(subProcess, config.getStoreStageStatus());
    this.subProcess = subProcess;
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getSetAssigneesVariableServiceTask(
      String subProcessId,
      FieldExtension assigneesExpr,
      FieldExtension assigneesVarNameExpr,
      FieldExtension inputNamespaceMapExpr) {
    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "setAssigneesVariable"))
        .implementation(SetApprovalAssigneesImpl.class.getName())
        .addFieldExtension(assigneesExpr)
        .addFieldExtension(assigneesVarNameExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .setAsync(false)
        .build();
  }

  private UserTask getUserTask(
      String subProcessId,
      FieldExtension assigneesVarNameExpr,
      FieldExtension inputNamespaceMapExpr,
      FieldExtension approvalThresholdExpr,
      FieldExtension rejectionThresholdExpr,
      FieldExtension taskTypeExpr,
      FieldExtension taskCategoryExpr,
      FieldExtension stageIdExpr,
      FieldExtension stageDisplayNameExpr,
      FieldExtension taskStatusExpr,
      FieldExtension transitionMetadataExpr,
      FieldExtension partialDecisionsExpr) {
    FlowableListener setCandidateUsersListener =
        new FlowableListenerBuilder()
            .event("create")
            .implementation(SetCandidateUsersImpl.class.getName())
            .addFieldExtension(assigneesVarNameExpr)
            .build();

    FlowableListener createTaskListener =
        new FlowableListenerBuilder()
            .event("create")
            .implementation(CreateTask.class.getName())
            .addFieldExtension(inputNamespaceMapExpr)
            .addFieldExtension(assigneesVarNameExpr)
            .addFieldExtension(approvalThresholdExpr)
            .addFieldExtension(rejectionThresholdExpr)
            .addFieldExtension(taskTypeExpr)
            .addFieldExtension(taskCategoryExpr)
            .addFieldExtension(stageIdExpr)
            .addFieldExtension(stageDisplayNameExpr)
            .addFieldExtension(taskStatusExpr)
            .addFieldExtension(transitionMetadataExpr)
            .addFieldExtension(partialDecisionsExpr)
            .build();

    FlowableListener completionValidatorListener =
        new FlowableListenerBuilder()
            .event("complete")
            .implementation(ApprovalTaskCompletionValidator.class.getName())
            .build();

    return new UserTaskBuilder()
        .id(getFlowableElementId(subProcessId, "approvalTask"))
        .addListener(setCandidateUsersListener)
        .addListener(createTaskListener)
        .addListener(completionValidatorListener)
        .build();
  }

  /**
   * Attach an interrupting timer boundary event to the user task when {@code config.expiryTimer}
   * is set. On fire, a ServiceTask writes {@code result = transitionId} (the node variable that
   * outgoing edges condition on); when the workflow author also set
   * {@code expiryTimer.closeAsResolution}, the OM Task entity is closed with that resolutionType
   * (status derived by TaskRepository — e.g. Expired → Expired). Skip the close when a
   * downstream node owns the task lifecycle (e.g. GrantedAccess routes to RevokeAccess which
   * closes as Revoked).
   */
  private void attachExpiryTimerIfConfigured(
      UserApprovalTaskDefinition nodeDefinition,
      SubProcess subProcess,
      String subProcessId,
      UserTask userTask,
      FlowNode endEvent) {
    ExpiryTimer expiryTimer = nodeDefinition.getConfig().getExpiryTimer();
    if (expiryTimer == null) {
      return;
    }
    String durationVariable = expiryTimer.getDurationVariable();
    String dateVariable = expiryTimer.getDateVariable();
    String transitionId = expiryTimer.getTransitionId();
    // Fail fast on a broken workflow definition: silently skipping the timer would strand
    // instances in the parent user task forever with no visible cause. Force the workflow author
    // to fix the JSON at deploy time instead of debugging a stuck task at runtime.
    boolean hasDurationVariable = hasTimerVariable(durationVariable);
    boolean hasDateVariable = hasTimerVariable(dateVariable);
    if (hasDurationVariable == hasDateVariable) {
      throw new IllegalArgumentException(
          "expiryTimer requires exactly one of durationVariable or dateVariable on node '"
              + nodeDefinition.getName()
              + "'");
    }
    if (!hasTimerVariable(transitionId)) {
      throw new IllegalArgumentException(
          "expiryTimer.transitionId is required on node '" + nodeDefinition.getName() + "'");
    }

    TimerEventDefinition timerDef = new TimerEventDefinition();
    if (hasDateVariable) {
      timerDef.setTimeDate("${" + dateVariable + "}");
    } else {
      timerDef.setTimeDuration("${" + durationVariable + "}");
    }

    BoundaryEvent expiryBoundary = new BoundaryEvent();
    expiryBoundary.setId(getFlowableElementId(subProcessId, "expiryTimerBoundary"));
    expiryBoundary.setCancelActivity(true);
    expiryBoundary.setAttachedToRef(userTask);
    expiryBoundary.addEventDefinition(timerDef);

    FieldExtension transitionIdExpr =
        new FieldExtensionBuilder().fieldName("transitionIdExpr").fieldValue(transitionId).build();

    ServiceTaskBuilder expireOnTimerBuilder =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "expireOnTimer"))
            .implementation(ExpireOnTimerImpl.class.getName())
            .addFieldExtension(transitionIdExpr)
            .setAsync(false);

    if (expiryTimer.getCloseAsResolution() != null) {
      expireOnTimerBuilder.addFieldExtension(
          new FieldExtensionBuilder()
              .fieldName("resolutionTypeExpr")
              .fieldValue(expiryTimer.getCloseAsResolution().value())
              .build());
    }

    ServiceTask expireOnTimer = expireOnTimerBuilder.build();

    subProcess.addFlowElement(expiryBoundary);
    subProcess.addFlowElement(expireOnTimer);
    subProcess.addFlowElement(new SequenceFlow(expiryBoundary.getId(), expireOnTimer.getId()));
    subProcess.addFlowElement(new SequenceFlow(expireOnTimer.getId(), endEvent.getId()));
  }

  /**
   * In a workflow that holds edits the approval task settles the change request it reviews. A
   * partial approval publishes the changes reviewers agreed on, and a partial rejection drops the
   * ones they rejected; both return to the review with the rest still pending, on the same task. An
   * approval publishes and a rejection drops before the workflow leaves through its approve or
   * reject flow. A publication that cannot apply leaves the request open with its conflicts and
   * ends the run, as the steps after an approval only follow a published change.
   */
  private ExclusiveGateway addHeldChangeResolution(
      SubProcess subProcess, String subProcessId, FlowNode review, EndEvent endEvent) {
    String result = getNamespacedVariableName(subProcessId, RESULT_VARIABLE);
    ExclusiveGateway decision =
        new ExclusiveGatewayBuilder()
            .id(getFlowableElementId(subProcessId, "decisionGateway"))
            .name("Settle the decided changes")
            .setAsync(false)
            .build();
    ServiceTask publishAgreed = heldChangeStep(subProcessId, "publishAgreedChanges", PUBLISH);
    ServiceTask discardRejected = heldChangeStep(subProcessId, "discardRejectedChanges", DISCARD);
    ServiceTask publish = heldChangeStep(subProcessId, "publishChange", PUBLISH);
    ServiceTask discard = heldChangeStep(subProcessId, "discardChange", DISCARD);
    List.of(decision, publishAgreed, discardRejected, publish, discard)
        .forEach(subProcess::addFlowElement);

    decisionFlow(
        subProcess, decision, publishAgreed, result, ReviewOutcome.PARTIAL_APPROVE.transition());
    decisionFlow(
        subProcess, decision, discardRejected, result, ReviewOutcome.PARTIAL_REJECT.transition());
    decisionFlow(
        subProcess, decision, publish, result, APPROVE_CONDITION, LEGACY_APPROVE_CONDITION);
    decisionFlow(subProcess, decision, discard, result, REJECT_CONDITION, LEGACY_REJECT_CONDITION);
    addNotAppliedTermination(subProcess, subProcessId, "agreed", publishAgreed, review);
    subProcess.addFlowElement(new SequenceFlow(discardRejected.getId(), review.getId()));
    addNotAppliedTermination(subProcess, subProcessId, "", publish, endEvent);
    subProcess.addFlowElement(new SequenceFlow(discard.getId(), endEvent.getId()));

    SequenceFlow undecided = new SequenceFlow(decision.getId(), endEvent.getId());
    undecided.setId(getFlowableElementId(subProcessId, "undecidedFlow"));
    subProcess.addFlowElement(undecided);
    decision.setDefaultFlow(undecided.getId());
    return decision;
  }

  private static ServiceTask heldChangeStep(String subProcessId, String name, String action) {
    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, name))
        .implementation(ResolveHeldChangeImpl.class.getName())
        .addFieldExtension(
            new FieldExtensionBuilder().fieldName("actionExpr").fieldValue(action).build())
        .build();
  }

  private static void decisionFlow(
      SubProcess subProcess,
      ExclusiveGateway decision,
      FlowNode target,
      String result,
      String... outcomes) {
    String condition =
        Arrays.stream(outcomes)
            .map(outcome -> "%s == '%s'".formatted(result, outcome))
            .collect(Collectors.joining(" || "));
    SequenceFlow flow = new SequenceFlow(decision.getId(), target.getId());
    flow.setId("%s_flow".formatted(target.getId()));
    flow.setConditionExpression("${%s}".formatted(condition));
    subProcess.addFlowElement(flow);
  }

  // A publication that applied continues to {@code next}; one that could not ends the run.
  private void addNotAppliedTermination(
      SubProcess subProcess,
      String subProcessId,
      String prefix,
      ServiceTask publish,
      FlowNode next) {
    ExclusiveGateway appliedGateway =
        new ExclusiveGatewayBuilder()
            .id(getFlowableElementId(subProcessId, elementName(prefix, "appliedGateway")))
            .name("Check if the change was applied")
            .setAsync(false)
            .build();

    TerminateEventDefinition terminateAll = new TerminateEventDefinition();
    terminateAll.setTerminateAll(true);
    EndEvent notAppliedEvent =
        new EndEventBuilder()
            .id(getFlowableElementId(subProcessId, elementName(prefix, "notAppliedEvent")))
            .build();
    notAppliedEvent.addEventDefinition(terminateAll);
    attachMainWorkflowTerminationListener(notAppliedEvent);

    SequenceFlow toNotApplied = new SequenceFlow(appliedGateway.getId(), notAppliedEvent.getId());
    toNotApplied.setConditionExpression(
        "${%s == '%s'}"
            .formatted(getNamespacedVariableName(subProcessId, HELD_CHANGE_RESULT), NOT_APPLIED));
    toNotApplied.setId(getFlowableElementId(subProcessId, elementName(prefix, "notAppliedFlow")));
    SequenceFlow toNext = new SequenceFlow(appliedGateway.getId(), next.getId());
    toNext.setId(getFlowableElementId(subProcessId, elementName(prefix, "appliedFlow")));

    subProcess.addFlowElement(appliedGateway);
    subProcess.addFlowElement(notAppliedEvent);
    subProcess.addFlowElement(new SequenceFlow(publish.getId(), appliedGateway.getId()));
    subProcess.addFlowElement(toNotApplied);
    subProcess.addFlowElement(toNext);
    appliedGateway.setDefaultFlow(toNext.getId());
  }

  // "appliedGateway" for the whole publication, "agreedAppliedGateway" for a partial one.
  private static String elementName(String prefix, String name) {
    return prefix.isEmpty()
        ? name
        : "%s%s%s".formatted(prefix, Character.toUpperCase(name.charAt(0)), name.substring(1));
  }

  private boolean hasTimerVariable(String value) {
    return !nullOrEmpty(value) && !value.isBlank();
  }

  private BoundaryEvent getTerminationEvent(String subProcessId) {
    String uniqueMessageName = getFlowableElementId(subProcessId, "terminateProcess");

    Message terminationMessage = new Message();
    terminationMessage.setId(uniqueMessageName);
    terminationMessage.setName(uniqueMessageName);
    messages.add(terminationMessage);

    MessageEventDefinition terminationMessageDefinition = new MessageEventDefinition();
    terminationMessageDefinition.setMessageRef(uniqueMessageName);

    BoundaryEvent terminationEvent = new BoundaryEvent();
    terminationEvent.setId(getFlowableElementId(subProcessId, "terminationEvent"));
    terminationEvent.addEventDefinition(terminationMessageDefinition);
    return terminationEvent;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
    for (Message message : messages) {
      model.addMessage(message);
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> transformAssigneesForFlowable(Object assigneesConfig) {
    Map<String, Object> result = new HashMap<>();
    Map<String, Object> config = JsonUtils.readOrConvertValue(assigneesConfig, Map.class);
    if (config != null) {
      result.put("addReviewers", config.getOrDefault("addReviewers", true));
      result.put("addOwners", config.getOrDefault("addOwners", false));
      result.put("emptyAssigneeStrategy", config.getOrDefault("emptyAssigneeStrategy", "none"));

      Set<String> users = new HashSet<>();
      Set<String> teams = new HashSet<>();

      Object candidatesObj = config.get("candidates");
      if (candidatesObj instanceof List<?> candidates) {
        for (Object candidate : candidates) {
          if (candidate instanceof Map) {
            Map<String, Object> candidateMap = (Map<String, Object>) candidate;
            Object typeObj = candidateMap.get("type");
            Object fqnObj = candidateMap.get("fullyQualifiedName");
            String type = typeObj instanceof String value ? value : null;
            String fqn = fqnObj instanceof String value ? value : null;
            if (fqn != null && type != null) {
              if ("user".equals(type)) {
                users.add(fqn);
              } else if ("team".equals(type)) {
                teams.add(fqn);
              }
            }
          }
        }
      }

      result.put("users", new ArrayList<>(users));
      result.put("teams", new ArrayList<>(teams));
    }
    return result;
  }
}

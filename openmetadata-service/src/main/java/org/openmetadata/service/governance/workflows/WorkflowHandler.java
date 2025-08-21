package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.governance.workflows.elements.TriggerFactory.getTriggerWorkflowId;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.flowable.common.engine.api.FlowableObjectNotFoundException;
import org.flowable.common.engine.impl.el.DefaultExpressionManager;
import org.flowable.engine.HistoryService;
import org.flowable.engine.ManagementService;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.impl.cfg.StandaloneProcessEngineConfiguration;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.job.api.Job;
import org.flowable.task.api.Task;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.governance.workflows.flowable.sql.SqlMapper;
import org.openmetadata.service.governance.workflows.flowable.sql.UnlockExecutionSql;
import org.openmetadata.service.governance.workflows.flowable.sql.UnlockJobSql;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class WorkflowHandler {
  private ProcessEngine processEngine;
  private final Map<Object, Object> expressionMap = new HashMap<>();
  private static WorkflowHandler instance;
  @Getter private static volatile boolean initialized = false;

  private WorkflowHandler(OpenMetadataApplicationConfig config) {
    ProcessEngineConfiguration processEngineConfiguration =
        new StandaloneProcessEngineConfiguration()
            .setJdbcUrl(config.getDataSourceFactory().getUrl())
            .setJdbcUsername(config.getDataSourceFactory().getUser())
            .setJdbcPassword(config.getDataSourceFactory().getPassword())
            .setJdbcDriver(config.getDataSourceFactory().getDriverClass())
            .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_FALSE);

    if (ConnectionType.MYSQL.label.equals(config.getDataSourceFactory().getDriverClass())) {
      processEngineConfiguration.setDatabaseType(ProcessEngineConfiguration.DATABASE_TYPE_MYSQL);
    } else {
      processEngineConfiguration.setDatabaseType(ProcessEngineConfiguration.DATABASE_TYPE_POSTGRES);
    }

    initializeExpressionMap(config);
    initializeNewProcessEngine(processEngineConfiguration);
  }

  public void initializeExpressionMap(OpenMetadataApplicationConfig config) {
    expressionMap.put("IngestionPipelineMapper", new IngestionPipelineMapper(config));
    expressionMap.put(
        "PipelineServiceClient",
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration()));
  }

  public void initializeNewProcessEngine(
      ProcessEngineConfiguration currentProcessEngineConfiguration) {
    ProcessEngines.destroy();
    SystemRepository systemRepository = Entity.getSystemRepository();
    WorkflowSettings workflowSettings = systemRepository.getWorkflowSettingsOrDefault();

    StandaloneProcessEngineConfiguration processEngineConfiguration =
        new StandaloneProcessEngineConfiguration();

    // Setting Database Configuration
    processEngineConfiguration
        .setJdbcUrl(currentProcessEngineConfiguration.getJdbcUrl())
        .setJdbcUsername(currentProcessEngineConfiguration.getJdbcUsername())
        .setJdbcPassword(currentProcessEngineConfiguration.getJdbcPassword())
        .setJdbcDriver(currentProcessEngineConfiguration.getJdbcDriver())
        .setDatabaseType(currentProcessEngineConfiguration.getDatabaseType())
        .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_FALSE);

    // Setting Async Executor Configuration
    processEngineConfiguration
        .setAsyncExecutorActivate(true)
        .setAsyncExecutorCorePoolSize(workflowSettings.getExecutorConfiguration().getCorePoolSize())
        .setAsyncExecutorMaxPoolSize(workflowSettings.getExecutorConfiguration().getMaxPoolSize())
        .setAsyncExecutorThreadPoolQueueSize(
            workflowSettings.getExecutorConfiguration().getQueueSize())
        .setAsyncExecutorAsyncJobLockTimeInMillis(
            workflowSettings.getExecutorConfiguration().getJobLockTimeInMillis())
        .setAsyncExecutorMaxAsyncJobsDuePerAcquisition(
            workflowSettings.getExecutorConfiguration().getTasksDuePerAcquisition());

    // Setting History CleanUp
    processEngineConfiguration
        .setEnableHistoryCleaning(true)
        .setCleanInstancesEndedAfter(
            Duration.ofDays(
                workflowSettings.getHistoryCleanUpConfiguration().getCleanAfterNumberOfDays()));

    // Add Expression Manager
    processEngineConfiguration.setExpressionManager(new DefaultExpressionManager(expressionMap));

    // Add Global Failure Listener
    processEngineConfiguration.setEventListeners(List.of(new WorkflowFailureListener()));

    this.processEngine = processEngineConfiguration.buildProcessEngine();

    // Add SqlMapper
    processEngine
        .getProcessEngineConfiguration()
        .getDbSqlSessionFactory()
        .getSqlSessionFactory()
        .getConfiguration()
        .addMapper(SqlMapper.class);
  }

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!initialized) {
      instance = new WorkflowHandler(config);
      initialized = true;
    } else {
      LOG.info("WorkflowHandler already initialized.");
    }
  }

  public static WorkflowHandler getInstance() {
    if (initialized) {
      return instance;
    }
    throw new UnhandledServerException("WorkflowHandler is not initialized.");
  }

  public ProcessEngineConfiguration getProcessEngineConfiguration() {
    if (processEngine != null) {
      return processEngine.getProcessEngineConfiguration();
    } else {
      return null;
    }
  }

  public void deploy(Workflow workflow) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    BpmnXMLConverter bpmnXMLConverter = new BpmnXMLConverter();

    // Deploy Main Workflow
    byte[] bpmnMainWorkflowBytes =
        bpmnXMLConverter.convertToXML(workflow.getMainWorkflow().getModel());
    repositoryService
        .createDeployment()
        .addBytes(
            String.format("%s-workflow.bpmn20.xml", workflow.getMainWorkflow().getWorkflowName()),
            bpmnMainWorkflowBytes)
        .name(workflow.getMainWorkflow().getWorkflowName())
        .deploy();

    // Deploy Trigger Workflow
    byte[] bpmnTriggerWorkflowBytes =
        bpmnXMLConverter.convertToXML(workflow.getTriggerWorkflow().getModel());
    repositoryService
        .createDeployment()
        .addBytes(
            String.format(
                "%s-workflow.bpmn20.xml", workflow.getTriggerWorkflow().getWorkflowName()),
            bpmnTriggerWorkflowBytes)
        .name(workflow.getTriggerWorkflow().getWorkflowName())
        .deploy();
  }

  public boolean isDeployed(WorkflowDefinition wf) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    List<ProcessDefinition> processDefinitions =
        repositoryService.createProcessDefinitionQuery().processDefinitionKey(wf.getName()).list();
    return !processDefinitions.isEmpty();
  }

  public void deleteWorkflowDefinition(WorkflowDefinition wf) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    List<ProcessDefinition> processDefinitions =
        repositoryService.createProcessDefinitionQuery().processDefinitionKey(wf.getName()).list();

    for (ProcessDefinition processDefinition : processDefinitions) {
      String deploymentId = processDefinition.getDeploymentId();
      repositoryService.deleteDeployment(deploymentId, true);
    }

    // Also Delete the Trigger
    List<ProcessDefinition> triggerProcessDefinition =
        repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKey(getTriggerWorkflowId(wf.getName()))
            .list();

    for (ProcessDefinition processDefinition : triggerProcessDefinition) {
      String deploymentId = processDefinition.getDeploymentId();
      repositoryService.deleteDeployment(deploymentId, true);
    }
  }

  public ProcessInstance triggerByKey(
      String processDefinitionKey, String businessKey, Map<String, Object> variables) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    LOG.info(
        "[WorkflowTrigger] START: processKey='{}' businessKey='{}' variables={}",
        processDefinitionKey,
        businessKey,
        variables);
    try {
      ProcessInstance instance =
          runtimeService.startProcessInstanceByKey(processDefinitionKey, businessKey, variables);
      LOG.info(
          "[WorkflowTrigger] SUCCESS: processKey='{}' instanceId='{}' businessKey='{}'",
          processDefinitionKey,
          instance.getId(),
          businessKey);
      return instance;
    } catch (Exception e) {
      LOG.error(
          "[WorkflowTrigger] FAILED: processKey='{}' businessKey='{}' error='{}'",
          processDefinitionKey,
          businessKey,
          e.getMessage(),
          e);
      throw e;
    }
  }

  public void triggerWithSignal(String signal, Map<String, Object> variables) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    runtimeService.signalEventReceived(signal, variables);
  }

  private void unlockJobsOnStartup() {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    ManagementService managementService = processEngine.getManagementService();

    List<Execution> executions = runtimeService.createExecutionQuery().list();
    for (Execution execution : executions) {
      processEngine
          .getManagementService()
          .executeCustomSql(new UnlockExecutionSql(execution.getId()));
    }
    List<Job> jobs = managementService.createJobQuery().locked().list();
    for (Job job : jobs) {
      processEngine.getManagementService().executeCustomSql(new UnlockJobSql(job.getId()));
    }
  }

  public void setCustomTaskId(String taskId, UUID customTaskId) {
    TaskService taskService = processEngine.getTaskService();
    taskService.setVariable(taskId, "customTaskId", customTaskId.toString());
  }

  public String getParentActivityId(String executionId) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    String activityId = null;

    Execution execution =
        runtimeService.createExecutionQuery().executionId(executionId).singleResult();

    if (execution != null && execution.getParentId() != null) {
      Execution parentExecution =
          runtimeService.createExecutionQuery().executionId(execution.getParentId()).singleResult();

      if (parentExecution != null) {
        activityId = parentExecution.getActivityId();
      }
    }

    return activityId;
  }

  private Task getTaskFromCustomTaskId(UUID customTaskId) {
    TaskService taskService = processEngine.getTaskService();
    return taskService
        .createTaskQuery()
        .processVariableValueEquals("customTaskId", customTaskId.toString())
        .singleResult();
  }

  public boolean validateWorkflowDefinition(String workflowDefinition) {
    try {
      RepositoryService repositoryService = processEngine.getRepositoryService();

      Deployment deployment =
          repositoryService
              .createDeployment()
              .addString("test-workflow.bpmn20.xml", workflowDefinition)
              .name("validation-test-" + System.currentTimeMillis())
              .deploy();

      repositoryService.deleteDeployment(deployment.getId(), true);
      return true;
    } catch (Exception e) {
      LOG.error("Workflow definition validation failed: {}", e.getMessage());
      return false;
    }
  }

  public Map<String, Object> transformToNodeVariables(
      UUID customTaskId, Map<String, Object> variables) {
    LOG.debug(
        "[WorkflowVariable] transformToNodeVariables: customTaskId='{}' inputVars={}",
        customTaskId,
        variables);
    Map<String, Object> namespacedVariables = null;
    Optional<Task> oTask = Optional.ofNullable(getTaskFromCustomTaskId(customTaskId));

    if (oTask.isPresent()) {
      Task task = oTask.get();
      String namespace = getParentActivityId(task.getExecutionId());
      LOG.debug(
          "[WorkflowVariable] Found task namespace: taskId='{}' executionId='{}' namespace='{}'",
          task.getId(),
          task.getExecutionId(),
          namespace);
      namespacedVariables = new HashMap<>();
      for (Map.Entry<String, Object> entry : variables.entrySet()) {
        String namespacedVar = getNamespacedVariableName(namespace, entry.getKey());
        namespacedVariables.put(namespacedVar, entry.getValue());
        LOG.debug(
            "[WorkflowVariable] Transformed: '{}' -> '{}' = '{}'",
            entry.getKey(),
            namespacedVar,
            entry.getValue());
      }
      LOG.debug(
          "[WorkflowVariable] transformToNodeVariables complete: outputVars={}",
          namespacedVariables);
    } else {
      LOG.warn("[WorkflowVariable] Task not found for customTaskId='{}'", customTaskId);
    }
    return namespacedVariables;
  }

  public void resolveTask(UUID taskId) {
    resolveTask(taskId, null);
  }

  public void resolveTask(UUID customTaskId, Map<String, Object> variables) {
    TaskService taskService = processEngine.getTaskService();
    LOG.info("[WorkflowTask] RESOLVE: customTaskId='{}' variables={}", customTaskId, variables);
    try {
      Optional<Task> oTask = Optional.ofNullable(getTaskFromCustomTaskId(customTaskId));
      if (oTask.isPresent()) {
        Task task = oTask.get();
        LOG.info(
            "[WorkflowTask] Found task: flowableTaskId='{}' processInstanceId='{}' name='{}'",
            task.getId(),
            task.getProcessInstanceId(),
            task.getName());

        // Check if this is a multi-approval task
        Integer approvalThreshold =
            (Integer) taskService.getVariable(task.getId(), "approvalThreshold");
        Integer rejectionThreshold =
            (Integer) taskService.getVariable(task.getId(), "rejectionThreshold");
        if ((approvalThreshold != null && approvalThreshold > 1)
            || (rejectionThreshold != null && rejectionThreshold > 1)) {
          // This is a multi-reviewer approval task
          boolean taskCompleted =
              handleMultiApproval(task, variables, approvalThreshold, rejectionThreshold);
          if (taskCompleted) {
            LOG.info(
                "[WorkflowTask] SUCCESS: Multi-approval task '{}' completed with threshold met",
                customTaskId);
          } else {
            LOG.info(
                "[WorkflowTask] SUCCESS: Multi-approval task '{}' recorded vote, waiting for more votes",
                customTaskId);
          }
        } else {
          // Single approval - original behavior
          Optional.ofNullable(variables)
              .ifPresentOrElse(
                  variablesValue -> {
                    LOG.info(
                        "[WorkflowTask] Completing with variables: taskId='{}' vars={}",
                        task.getId(),
                        variablesValue);
                    taskService.complete(task.getId(), variablesValue);
                  },
                  () -> {
                    LOG.info(
                        "[WorkflowTask] Completing without variables: taskId='{}'", task.getId());
                    taskService.complete(task.getId());
                  });
          LOG.info("[WorkflowTask] SUCCESS: Task '{}' resolved", customTaskId);
        }
      } else {
        LOG.warn("[WorkflowTask] NOT_FOUND: No Flowable task for customTaskId='{}'", customTaskId);
      }
    } catch (FlowableObjectNotFoundException ex) {
      LOG.error(
          "[WorkflowTask] ERROR: Flowable task not found for customTaskId='{}': {}",
          customTaskId,
          ex.getMessage());
    } catch (Exception e) {
      LOG.error(
          "[WorkflowTask] ERROR: Failed to resolve task '{}': {}", customTaskId, e.getMessage(), e);
      throw e;
    }
  }

  private boolean handleMultiApproval(
      Task task,
      Map<String, Object> variables,
      Integer approvalThreshold,
      Integer rejectionThreshold) {
    TaskService taskService = processEngine.getTaskService();

    // Default thresholds to 1 if not set
    if (approvalThreshold == null) {
      approvalThreshold = 1;
    }
    if (rejectionThreshold == null) {
      rejectionThreshold = 1;
    }

    // Get current approval tracking variables
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> approvals =
        (List<Map<String, Object>>) taskService.getVariable(task.getId(), "approvals");
    if (approvals == null) {
      approvals = new ArrayList<>();
    }

    Integer approvalCount = (Integer) taskService.getVariable(task.getId(), "approvalCount");
    if (approvalCount == null) {
      approvalCount = 0;
    }

    Integer rejectionCount = (Integer) taskService.getVariable(task.getId(), "rejectionCount");
    if (rejectionCount == null) {
      rejectionCount = 0;
    }

    // Get the current user and approval decision
    // Variables might be namespaced, so check both namespaced and global versions
    String currentUser = (String) variables.get("updatedBy");
    if (currentUser == null) {
      // Try to find namespaced updatedBy (e.g., "ApproveGlossaryTerm_updatedBy")
      for (String key : variables.keySet()) {
        if (key.endsWith("_updatedBy")) {
          currentUser = (String) variables.get(key);
          break;
        }
      }
    }

    Boolean approved = (Boolean) variables.get("result");
    if (approved == null) {
      // Try to find namespaced result (e.g., "ApproveGlossaryTerm_result")
      for (String key : variables.keySet()) {
        if (key.endsWith("_result")) {
          approved = (Boolean) variables.get(key);
          break;
        }
      }
    }

    // Make variables final for lambda expression
    final String finalCurrentUser = currentUser;
    final Boolean finalApproved = approved;

    // Check if this user has already voted
    boolean alreadyVoted =
        approvals.stream()
            .anyMatch(a -> finalCurrentUser != null && finalCurrentUser.equals(a.get("user")));

    if (alreadyVoted) {
      LOG.warn("[MultiApproval] User '{}' has already voted on this task", finalCurrentUser);
      return false;
    }

    // Record the approval/rejection
    Map<String, Object> approval = new HashMap<>();
    approval.put("user", finalCurrentUser);
    approval.put("approved", finalApproved);
    approval.put("timestamp", System.currentTimeMillis());
    approvals.add(approval);

    if (Boolean.TRUE.equals(finalApproved)) {
      approvalCount++;
    } else {
      rejectionCount++;
    }

    // Update task variables
    taskService.setVariable(task.getId(), "approvals", approvals);
    taskService.setVariable(task.getId(), "approvalCount", approvalCount);
    taskService.setVariable(task.getId(), "rejectionCount", rejectionCount);

    LOG.debug(
        "[MultiApproval] Task '{}' - Approvals: {}/{}, Rejections: {}/{}",
        task.getId(),
        approvalCount,
        approvalThreshold,
        rejectionCount,
        rejectionThreshold);

    // Check if rejection threshold is met (rejection takes precedence)
    if (rejectionCount >= rejectionThreshold) {
      LOG.debug(
          "[MultiApproval] Rejection threshold met ({}/{}), rejecting task",
          rejectionCount,
          rejectionThreshold);
      // Set the final result as rejected and complete the task
      variables.put("result", false);
      taskService.complete(task.getId(), variables);
      return true;
    }

    // Check if approval threshold is met
    if (approvalCount >= approvalThreshold) {
      LOG.debug(
          "[MultiApproval] Approval threshold met ({}/{}), approving task",
          approvalCount,
          approvalThreshold);
      // Set the final result as approved and complete the task
      variables.put("result", true);
      taskService.complete(task.getId(), variables);
      return true;
    }

    // Task remains open for more votes
    LOG.debug(
        "[MultiApproval] Task '{}' remains open. Need {} more approvals or {} more rejections",
        task.getId(),
        approvalThreshold - approvalCount,
        rejectionThreshold - rejectionCount);
    return false;
  }

  public boolean isTaskStillOpen(UUID customTaskId) {
    try {
      Task task = getTaskFromCustomTaskId(customTaskId);
      return task != null && !task.isSuspended();
    } catch (Exception e) {
      LOG.debug("Task {} not found or already completed", customTaskId);
      return false;
    }
  }

  /**
   * Check if a task has multi-approval support by checking for approval threshold variables.
   * Tasks deployed with the new multi-approval feature will have these variables.
   * Legacy tasks won't have them.
   */
  public boolean hasMultiApprovalSupport(UUID customTaskId) {
    try {
      Task task = getTaskFromCustomTaskId(customTaskId);
      if (task == null) {
        return false;
      }

      TaskService taskService = processEngine.getTaskService();
      // Check if the task has approval threshold variable
      // This variable is only present in workflows deployed with multi-approval support
      Object approvalThreshold = taskService.getVariable(task.getId(), "approvalThreshold");
      return approvalThreshold != null;
    } catch (Exception e) {
      LOG.debug(
          "Error checking multi-approval support for task {}: {}", customTaskId, e.getMessage());
      return false;
    }
  }

  public void terminateTaskProcessInstance(UUID customTaskId, String reason) {
    TaskService taskService = processEngine.getTaskService();
    RuntimeService runtimeService = processEngine.getRuntimeService();
    try {
      List<Task> tasks =
          taskService
              .createTaskQuery()
              .processVariableValueEquals("customTaskId", customTaskId.toString())
              .list();
      for (Task task : tasks) {
        Execution execution =
            runtimeService
                .createExecutionQuery()
                .processInstanceId(task.getProcessInstanceId())
                .messageEventSubscriptionName("terminateProcess")
                .singleResult();
        runtimeService.messageEventReceived("terminateProcess", execution.getId());
      }
    } catch (FlowableObjectNotFoundException ex) {
      LOG.debug(String.format("Flowable Task for Task ID %s not found.", customTaskId));
    }
  }

  public static String getProcessDefinitionKeyFromId(String processDefinitionId) {
    return Arrays.stream(processDefinitionId.split(":")).toList().get(0);
  }

  public void updateBusinessKey(String processInstanceId, UUID workflowInstanceBusinessKey) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    runtimeService.updateBusinessKey(processInstanceId, workflowInstanceBusinessKey.toString());
  }

  public boolean hasProcessInstanceFinished(String processInstanceId) {
    HistoryService historyService = processEngine.getHistoryService();
    boolean hasFinished = false;

    HistoricProcessInstance historicProcessInstance =
        historyService
            .createHistoricProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult();

    if (historicProcessInstance != null && historicProcessInstance.getEndTime() != null) {
      hasFinished = true;
    }

    return hasFinished;
  }

  public boolean isActivityWithVariableExecuting(
      String activityName, String variableName, Object expectedValue) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    List<Execution> executions =
        runtimeService.createExecutionQuery().activityId(activityName).list();

    for (Execution execution : executions) {
      Object variableValue = runtimeService.getVariable(execution.getId(), variableName);
      if (expectedValue.equals(variableValue)) {
        return true;
      }
    }
    return false;
  }

  public boolean triggerWorkflow(String workflowName) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    try {
      runtimeService.startProcessInstanceByKey(getTriggerWorkflowId(workflowName));
      return true;
    } catch (FlowableObjectNotFoundException ex) {
      return false;
    }
  }

  public boolean isWorkflowSuspended(String workflowName) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    ProcessDefinition processDefinition =
        repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKey(getTriggerWorkflowId(workflowName))
            .latestVersion()
            .singleResult();

    if (processDefinition == null) {
      throw new IllegalArgumentException(
          "Process Definition not found for workflow: " + workflowName);
    }

    return processDefinition.isSuspended();
  }

  public void suspendWorkflow(String workflowName) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    if (isWorkflowSuspended(workflowName)) {
      LOG.debug(String.format("Workflow '%s' is already suspended.", workflowName));
    } else {
      repositoryService.suspendProcessDefinitionByKey(
          getTriggerWorkflowId(workflowName), true, null);
    }
  }

  public void resumeWorkflow(String workflowName) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    if (!isWorkflowSuspended(workflowName)) {
      LOG.debug(String.format("Workflow '%s' is already active.", workflowName));
    } else {
      repositoryService.activateProcessDefinitionByKey(
          getTriggerWorkflowId(workflowName), true, null);
    }
  }

  public void terminateWorkflow(String workflowName) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    runtimeService
        .createProcessInstanceQuery()
        .processDefinitionKey(getTriggerWorkflowId(workflowName))
        .list()
        .forEach(
            instance ->
                runtimeService.deleteProcessInstance(
                    instance.getId(), "Terminating all instances due to user request."));
  }

  public void terminateDuplicateInstances(
      String mainWorkflowDefinitionName, String entityLink, String currentProcessInstanceId) {
    try {
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
      WorkflowInstanceStateRepository workflowInstanceStateRepository =
          (WorkflowInstanceStateRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

      ListFilter filter = new ListFilter(null);
      filter.addQueryParam("entityLink", entityLink);

      long endTs = System.currentTimeMillis();
      long startTs = endTs - (7L * 24 * 60 * 60 * 1000);

      ResultList<WorkflowInstance> allInstances =
          workflowInstanceRepository.list(null, startTs, endTs, 100, filter, false);

      List<WorkflowInstance> candidateInstances =
          allInstances.getData().stream()
              .filter(
                  instance -> WorkflowInstance.WorkflowStatus.RUNNING.equals(instance.getStatus()))
              .filter(
                  instance -> {
                    try {
                      WorkflowDefinitionRepository repo =
                          (WorkflowDefinitionRepository)
                              Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
                      var def =
                          repo.get(
                              null,
                              instance.getWorkflowDefinitionId(),
                              EntityUtil.Fields.EMPTY_FIELDS);
                      return mainWorkflowDefinitionName.equals(def.getName());
                    } catch (Exception e) {
                      return false;
                    }
                  })
              .toList();

      RuntimeService runtimeService = getInstance().getRuntimeService();
      List<ProcessInstance> runningProcessInstances =
          runtimeService
              .createProcessInstanceQuery()
              .processDefinitionKey(mainWorkflowDefinitionName)
              .list();

      List<WorkflowInstance> conflictingInstances =
          candidateInstances.stream()
              .filter(
                  instance -> {
                    return runningProcessInstances.stream()
                        .filter(pi -> !pi.getId().equals(currentProcessInstanceId))
                        .anyMatch(pi -> pi.getBusinessKey().equals(instance.getId().toString()));
                  })
              .toList();

      if (conflictingInstances.isEmpty()) {
        LOG.debug("No conflicting instances found to terminate for {}", mainWorkflowDefinitionName);
        return;
      }

      Entity.getJdbi()
          .inTransaction(
              TransactionIsolationLevel.READ_COMMITTED,
              handle -> {
                try {
                  getInstance().terminateWorkflow(mainWorkflowDefinitionName);

                  for (WorkflowInstance instance : conflictingInstances) {
                    workflowInstanceStateRepository.markInstanceStatesAsFailed(
                        instance.getId(), "Terminated due to conflicting workflow instance");
                    workflowInstanceRepository.markInstanceAsFailed(
                        instance.getId(), "Terminated due to conflicting workflow instance");
                  }

                  return null;
                } catch (Exception e) {
                  LOG.error(
                      "Failed to terminate conflicting instances in transaction: {}",
                      e.getMessage());
                  throw e;
                }
              });

      LOG.info(
          "Terminated {} conflicting instances of {} for entity {}",
          conflictingInstances.size(),
          mainWorkflowDefinitionName,
          entityLink);

    } catch (Exception e) {
      LOG.warn("Failed to terminate conflicting instances: {}", e.getMessage());
    }
  }

  public RuntimeService getRuntimeService() {
    return processEngine.getRuntimeService();
  }
}

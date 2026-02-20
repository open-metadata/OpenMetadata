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
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Message;
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
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.job.api.Job;
import org.flowable.task.api.Task;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.governance.workflows.flowable.sql.SqlMapper;
import org.openmetadata.service.governance.workflows.flowable.sql.UnlockExecutionSql;
import org.openmetadata.service.governance.workflows.flowable.sql.UnlockJobSql;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.util.EntityUtil;

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
            .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE);

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
        .setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE);

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
            workflowSettings.getExecutorConfiguration().getTasksDuePerAcquisition())
        .setAsyncExecutorDefaultAsyncJobAcquireWaitTime(
            workflowSettings.getExecutorConfiguration().getAsyncJobAcquisitionInterval())
        .setAsyncExecutorDefaultTimerJobAcquireWaitTime(
            workflowSettings.getExecutorConfiguration().getTimerJobAcquisitionInterval());

    // Setting History CleanUp
    processEngineConfiguration
        .setAsyncHistoryEnabled(true)
        .setEnableHistoryCleaning(true)
        .setCleanInstancesEndedAfter(
            Duration.ofDays(
                workflowSettings.getHistoryCleanUpConfiguration().getCleanAfterNumberOfDays()))
        .setHistoryCleaningTimeCycleConfig(
            workflowSettings.getHistoryCleanUpConfiguration().getTimeCycleConfig());

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
    ManagementService managementService = processEngine.getManagementService();
    BpmnXMLConverter bpmnXMLConverter = new BpmnXMLConverter();

    // Before deploying, check if this is an update and handle timer jobs
    String triggerWorkflowKey = workflow.getTriggerWorkflow().getWorkflowName();
    String workflowName = workflow.getWorkflowDefinition().getName();

    // For scheduled workflows (periodicBatchEntity), terminate old instances and cancel timer jobs
    // This prevents both duplicate executions and errors from schema changes
    if (workflow.getWorkflowDefinition().getTrigger() != null
        && "periodicBatchEntity".equals(workflow.getWorkflowDefinition().getTrigger().getType())) {

      RuntimeService runtimeService = processEngine.getRuntimeService();

      // Step 1: Terminate all old running instances
      // Necessary when workflow task definitions change (e.g., setEntityCertificationTask ->
      // setEntityAttributeTask)
      try {
        // Terminate main workflow instances
        List<ProcessInstance> runningInstances =
            runtimeService.createProcessInstanceQuery().processDefinitionKey(workflowName).list();

        if (!runningInstances.isEmpty()) {
          LOG.info(
              "Terminating {} old running instances of {} before redeployment",
              runningInstances.size(),
              workflowName);
          for (ProcessInstance instance : runningInstances) {
            runtimeService.deleteProcessInstance(
                instance.getId(), "Terminated for redeployment of periodicBatchEntity workflow");
          }
        }

        // Terminate trigger workflow instances
        List<ProcessInstance> triggerInstances =
            runtimeService
                .createProcessInstanceQuery()
                .processDefinitionKey(triggerWorkflowKey)
                .list();

        if (!triggerInstances.isEmpty()) {
          LOG.info(
              "Terminating {} old trigger instances of {} before redeployment",
              triggerInstances.size(),
              triggerWorkflowKey);
          for (ProcessInstance instance : triggerInstances) {
            runtimeService.deleteProcessInstance(
                instance.getId(), "Terminated for redeployment of periodicBatchEntity workflow");
          }
        }
      } catch (Exception e) {
        LOG.warn(
            "Error terminating old workflow instances for {}: {}", workflowName, e.getMessage());
      }

      // Step 2: Cancel old timer jobs to prevent duplicate scheduled executions
      try {
        // Find and delete timer jobs for the old deployment
        List<Job> timerJobs =
            managementService.createTimerJobQuery().processDefinitionKey(triggerWorkflowKey).list();

        for (Job timerJob : timerJobs) {
          LOG.info(
              "Cancelling old timer job {} for workflow {}", timerJob.getId(), triggerWorkflowKey);
          managementService.deleteJob(timerJob.getId());
        }

        // Also check for entity-specific timer jobs (e.g.,
        // TableEntityCertificationWorkflowTrigger-table)
        // These are created when workflows target specific entity types
        List<Job> allTimerJobs = managementService.createTimerJobQuery().list();
        for (Job timerJob : allTimerJobs) {
          // Get the process definition ID and extract the key
          String processDefId = timerJob.getProcessDefinitionId();
          if (processDefId != null) {
            // Process definition ID format: key:version:id
            String jobKey = processDefId.split(":")[0];
            if (jobKey.startsWith(triggerWorkflowKey + "-")) {
              LOG.info(
                  "Cancelling old entity-specific timer job {} for workflow {}",
                  timerJob.getId(),
                  jobKey);
              managementService.deleteJob(timerJob.getId());
            }
          }
        }
      } catch (Exception e) {
        LOG.warn(
            "Error cancelling old timer jobs for workflow {}: {}",
            triggerWorkflowKey,
            e.getMessage());
      }
    }

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
    RepositoryService repositoryService = processEngine.getRepositoryService();
    LOG.debug(
        "[WorkflowTrigger] START: processKey='{}' businessKey='{}' variables={}",
        processDefinitionKey,
        businessKey,
        variables);
    try {
      // Always use the latest version of the process definition
      ProcessDefinition latestDefinition =
          repositoryService
              .createProcessDefinitionQuery()
              .processDefinitionKey(processDefinitionKey)
              .latestVersion()
              .singleResult();

      if (latestDefinition == null) {
        throw new IllegalStateException(
            String.format("No process definition found for key: %s", processDefinitionKey));
      }

      LOG.debug(
          "[WorkflowTrigger] Using latest version {} of process '{}'",
          latestDefinition.getVersion(),
          processDefinitionKey);

      // Start process instance using the specific process definition ID (ensures latest version)
      ProcessInstance instance =
          runtimeService.startProcessInstanceById(latestDefinition.getId(), businessKey, variables);
      LOG.debug(
          "[WorkflowTrigger] SUCCESS: processKey='{}' version='{}' instanceId='{}' businessKey='{}'",
          processDefinitionKey,
          latestDefinition.getVersion(),
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
    List<Task> tasks =
        taskService
            .createTaskQuery()
            .processVariableValueEquals("customTaskId", customTaskId.toString())
            .list();

    if (tasks.isEmpty()) {
      return null;
    }

    if (tasks.size() == 1) {
      return tasks.get(0);
    }

    // Multiple tasks found with same customTaskId - this shouldn't happen but provide fallback
    LOG.warn(
        "[WorkflowTask] Found {} tasks with customTaskId '{}'. This indicates duplicate workflow instances. Returning most recent active task.",
        tasks.size(),
        customTaskId);

    // Sort by create time descending and return the most recent active task
    return tasks.stream()
        .filter(task -> !task.isSuspended())
        .sorted(
            (t1, t2) -> {
              // Sort by creation time in descending order (most recent first)
              if (t2.getCreateTime() != null && t1.getCreateTime() != null) {
                return t2.getCreateTime().compareTo(t1.getCreateTime());
              }
              return 0;
            })
        .findFirst()
        .orElse(tasks.get(0)); // Fallback to first task if all are suspended
  }

  public boolean validateWorkflowDefinition(String workflowDefinition) {
    try {
      // Parse and validate the BPMN XML without deploying
      // This avoids creating and deleting deployments just for validation
      BpmnXMLConverter bpmnXMLConverter = new BpmnXMLConverter();
      byte[] bpmnBytes = workflowDefinition.getBytes();
      javax.xml.stream.XMLInputFactory xif = javax.xml.stream.XMLInputFactory.newInstance();
      xif.setProperty(javax.xml.stream.XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
      xif.setProperty(javax.xml.stream.XMLInputFactory.SUPPORT_DTD, false);

      try (java.io.ByteArrayInputStream inputStream = new java.io.ByteArrayInputStream(bpmnBytes)) {
        javax.xml.stream.XMLStreamReader xtr = xif.createXMLStreamReader(inputStream);
        org.flowable.bpmn.model.BpmnModel bpmnModel = bpmnXMLConverter.convertToBpmnModel(xtr);

        // Basic validation checks
        if (bpmnModel == null || bpmnModel.getProcesses().isEmpty()) {
          LOG.error("Invalid BPMN: No processes found in the model");
          return false;
        }

        // Check for at least one start event
        for (org.flowable.bpmn.model.Process process : bpmnModel.getProcesses()) {
          if (process.findFlowElementsOfType(org.flowable.bpmn.model.StartEvent.class).isEmpty()) {
            LOG.error("Invalid BPMN: Process '{}' has no start event", process.getId());
            return false;
          }
        }

        return true;
      }
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

  public boolean resolveTask(UUID taskId) {
    return resolveTask(taskId, null);
  }

  public boolean resolveTask(UUID customTaskId, Map<String, Object> variables) {
    TaskService taskService = processEngine.getTaskService();
    LOG.debug("[WorkflowTask] RESOLVE: customTaskId='{}' variables={}", customTaskId, variables);
    try {
      Optional<Task> oTask = Optional.ofNullable(getTaskFromCustomTaskId(customTaskId));
      if (oTask.isPresent()) {
        Task task = oTask.get();
        LOG.debug(
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
            LOG.debug(
                "[WorkflowTask] SUCCESS: Multi-approval task '{}' completed with threshold met",
                customTaskId);
          } else {
            LOG.debug(
                "[WorkflowTask] SUCCESS: Multi-approval task '{}' recorded vote, waiting for more votes",
                customTaskId);
            // Update the Thread entity to remove the task from the current voter's feed
            removeTaskFromVoterFeed(task, customTaskId, variables);
          }
        } else {
          // Single approval - original behavior
          Optional.ofNullable(variables)
              .ifPresentOrElse(
                  variablesValue -> {
                    LOG.debug(
                        "[WorkflowTask] Completing with variables: taskId='{}' vars={}",
                        task.getId(),
                        variablesValue);
                    taskService.complete(task.getId(), variablesValue);
                  },
                  () -> {
                    LOG.debug(
                        "[WorkflowTask] Completing without variables: taskId='{}'", task.getId());
                    taskService.complete(task.getId());
                  });
          LOG.debug("[WorkflowTask] SUCCESS: Task '{}' resolved", customTaskId);
        }
        return true;
      } else {
        LOG.warn("[WorkflowTask] NOT_FOUND: No Flowable task for customTaskId='{}'", customTaskId);
        return false;
      }
    } catch (FlowableObjectNotFoundException ex) {
      LOG.error(
          "[WorkflowTask] ERROR: Flowable task not found for customTaskId='{}': {}",
          customTaskId,
          ex.getMessage());
      return false;
    } catch (Exception e) {
      LOG.error(
          "[WorkflowTask] ERROR: Failed to resolve task '{}': {}", customTaskId, e.getMessage(), e);
      return false;
    }
  }

  private void removeTaskFromVoterFeed(
      Task flowableTask, UUID customTaskId, Map<String, Object> variables) {
    try {
      // Extract the current user from variables
      String currentUser = extractCurrentUser(variables);
      if (currentUser == null) {
        LOG.warn("[WorkflowTask] Could not determine current user to remove from task feed");
        return;
      }

      LOG.info(
          "[WorkflowTask] Removing task '{}' from feed for user '{}'", customTaskId, currentUser);

      // Get the FeedRepository to work with Thread entities
      FeedRepository feedRepository = Entity.getFeedRepository();

      // Find the Thread entity by the customTaskId
      Thread taskThread = null;
      try {
        taskThread = feedRepository.get(customTaskId);
      } catch (Exception e) {
        LOG.debug(
            "[WorkflowTask] Could not find thread with ID '{}', trying alternative lookup",
            customTaskId);
      }

      if (taskThread != null && taskThread.getTask() != null) {
        // Update the Thread entity to remove the current user from assignees
        List<EntityReference> currentAssignees =
            new ArrayList<>(taskThread.getTask().getAssignees());

        // Find and remove the user from assignees
        boolean removed =
            currentAssignees.removeIf(
                assignee -> {
                  // Check by name (username)
                  if (assignee.getName() != null && assignee.getName().equals(currentUser)) {
                    return true;
                  }
                  // Also check if it's a user entity reference with matching name
                  if (Entity.USER.equals(assignee.getType())) {
                    try {
                      // Try to get the actual user entity to compare
                      User user =
                          Entity.getEntity(Entity.USER, assignee.getId(), "", Include.NON_DELETED);
                      return user.getName().equals(currentUser);
                    } catch (Exception ex) {
                      LOG.debug("Could not fetch user entity for assignee: {}", ex.getMessage());
                    }
                  }
                  return false;
                });

        if (removed) {
          // Update the thread with new assignees list
          taskThread.getTask().setAssignees(currentAssignees);
          taskThread.withUpdatedBy(currentUser).withUpdatedAt(System.currentTimeMillis());

          // Persist the changes
          Thread finalTaskThread = taskThread;
          Entity.getJdbi()
              .useHandle(
                  handle -> {
                    CollectionDAO dao = handle.attach(CollectionDAO.class);
                    dao.feedDAO()
                        .update(finalTaskThread.getId(), JsonUtils.pojoToJson(finalTaskThread));
                  });

          LOG.info(
              "[WorkflowTask] Successfully removed user '{}' from Thread '{}' assignees. Remaining assignees: {}",
              currentUser,
              taskThread.getId(),
              currentAssignees.size());
        } else {
          LOG.debug(
              "[WorkflowTask] User '{}' was not in the assignees list for Thread '{}'",
              currentUser,
              taskThread.getId());
        }
      }

      // Also update Flowable task to remove the user from candidates
      TaskService taskService = processEngine.getTaskService();
      if (flowableTask != null) {
        // Store voted users in Flowable variables
        @SuppressWarnings("unchecked")
        List<String> votedUsers =
            (List<String>) taskService.getVariable(flowableTask.getId(), "votedUsers");
        if (votedUsers == null) {
          votedUsers = new ArrayList<>();
        }

        if (!votedUsers.contains(currentUser)) {
          votedUsers.add(currentUser);
          taskService.setVariable(flowableTask.getId(), "votedUsers", votedUsers);
          LOG.debug(
              "[WorkflowTask] Added user '{}' to voted users list for Flowable task", currentUser);
        }

        // Remove the user from Flowable task assignees if they're directly assigned
        try {
          // If current user is the assignee, unassign them
          String currentAssignee = flowableTask.getAssignee();
          if (currentUser.equals(currentAssignee)) {
            taskService.unclaim(flowableTask.getId());
            LOG.debug(
                "[WorkflowTask] Unclaimed Flowable task '{}' from user '{}'",
                flowableTask.getId(),
                currentUser);
          }

          // Remove from candidate users if present
          taskService.deleteCandidateUser(flowableTask.getId(), currentUser);
          LOG.debug(
              "[WorkflowTask] Removed user '{}' from candidate users for Flowable task '{}'",
              currentUser,
              flowableTask.getId());

        } catch (Exception e) {
          LOG.debug("[WorkflowTask] Could not update Flowable task assignees: {}", e.getMessage());
        }
      }
    } catch (Exception e) {
      LOG.error(
          "[WorkflowTask] Failed to update task voter information for task '{}': {}",
          customTaskId,
          e.getMessage(),
          e);
      // Don't throw - this is a non-critical operation
    }
  }

  private String extractCurrentUser(Map<String, Object> variables) {
    // Try direct key first
    String currentUser = (String) variables.get("updatedBy");
    if (currentUser != null) {
      return currentUser;
    }

    // Try namespaced versions
    for (String key : variables.keySet()) {
      if (key.endsWith("_updatedBy")) {
        currentUser = (String) variables.get(key);
        if (currentUser != null) {
          return currentUser;
        }
      }
    }

    return null;
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

    @SuppressWarnings("unchecked")
    List<String> approversList =
        (List<String>) taskService.getVariable(task.getId(), "approversList");
    if (approversList == null) {
      approversList = new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    List<String> rejectersList =
        (List<String>) taskService.getVariable(task.getId(), "rejectersList");
    if (rejectersList == null) {
      rejectersList = new ArrayList<>();
    }

    // Get the current user and approval decision
    String nodeName = getParentActivityId(task.getExecutionId());
    String updatedByVariable = getNamespacedVariableName(nodeName, "updatedBy");
    String resultVariable = getNamespacedVariableName(nodeName, "result");
    String currentUser = (String) variables.get(updatedByVariable);
    Boolean approved = (Boolean) variables.get(resultVariable);

    if (currentUser == null || approved == null) {
      LOG.warn(
          "[MultiApproval] Cannot process approval - missing required variables. "
              + "updatedBy: {}, result: {}. Task remains open.",
          currentUser,
          approved);
      // DON'T complete the task, DON'T increment counts
      return false;
    }

    if (approversList.contains(currentUser) || rejectersList.contains(currentUser)) {
      LOG.warn("[MultiApproval] User '{}' has already voted on this task", currentUser);
      return false;
    }

    if (approved) {
      approversList.add(currentUser);
    } else {
      rejectersList.add(currentUser);
    }

    taskService.setVariable(task.getId(), "approversList", approversList);
    taskService.setVariable(task.getId(), "rejectersList", rejectersList);

    int approvalCount = approversList.size();
    int rejectionCount = rejectersList.size();

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
      // Set the final result - need to check if result is namespaced
      variables.put(resultVariable, false);
      taskService.complete(task.getId(), variables);
      return true;
    }

    // Check if approval threshold is met
    if (approvalCount >= approvalThreshold) {
      LOG.debug(
          "[MultiApproval] Approval threshold met ({}/{}), approving task",
          approvalCount,
          approvalThreshold);
      // Set the final result - need to check if result is namespaced
      variables.put(resultVariable, true);
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
        // Find the correct termination message for this task
        String terminationMessageName = findTerminationMessageName(runtimeService, task);
        if (terminationMessageName != null) {
          Execution execution =
              runtimeService
                  .createExecutionQuery()
                  .processInstanceId(task.getProcessInstanceId())
                  .messageEventSubscriptionName(terminationMessageName)
                  .singleResult();
          if (execution != null) {
            runtimeService.messageEventReceived(terminationMessageName, execution.getId());
            LOG.debug(
                "Terminated task {} using message '{}'", customTaskId, terminationMessageName);
          } else {
            LOG.warn(
                "No execution found for termination message '{}' for task {}",
                terminationMessageName,
                customTaskId);
          }
        } else {
          LOG.warn("No termination message found for task {}", customTaskId);
        }
      }
    } catch (FlowableObjectNotFoundException ex) {
      LOG.debug(String.format("Flowable Task for Task ID %s not found.", customTaskId));
    }
  }

  /**
   * Find the termination message name for a task.
   * Uses deterministic message names based on the subprocess ID.
   */
  private String findTerminationMessageName(RuntimeService runtimeService, Task task) {
    try {
      String taskDefinitionKey = task.getTaskDefinitionKey();
      LOG.debug(
          "Finding termination message for task {} with definition key '{}'",
          task.getId(),
          taskDefinitionKey);

      // List all message event subscriptions for this process instance
      List<Execution> allMessageExecutions =
          runtimeService
              .createExecutionQuery()
              .processInstanceId(task.getProcessInstanceId())
              .list();

      LOG.debug(
          "Found {} executions for process {}",
          allMessageExecutions.size(),
          task.getProcessInstanceId());

      for (Execution exec : allMessageExecutions) {
        if (exec.getActivityId() != null) {
          LOG.debug("Execution {} has activity ID: {}", exec.getId(), exec.getActivityId());
        }
      }

      // Get the BpmnModel to see what messages are available
      BpmnModel model =
          processEngine.getRepositoryService().getBpmnModel(task.getProcessDefinitionId());

      LOG.debug("Available messages in model:");
      for (Message msg : model.getMessages()) {
        LOG.debug("  - Message ID: {}, Name: {}", msg.getId(), msg.getName());
      }

      // Extract the subprocess ID from the task definition key
      // E.g., "ApproveGlossaryTerm_approvalTask" -> "ApproveGlossaryTerm"
      String subProcessId =
          taskDefinitionKey.contains("_")
              ? taskDefinitionKey.substring(0, taskDefinitionKey.lastIndexOf("_"))
              : taskDefinitionKey;

      LOG.debug(
          "Extracted subprocess ID: '{}' from task key '{}'", subProcessId, taskDefinitionKey);

      // Try both possible termination message patterns
      // UserApprovalTask uses: subProcessId_terminateProcess
      // ChangeReviewTask uses: subProcessId_terminateChangeReviewProcess
      String[] messagePatterns = {
        subProcessId + "_terminateProcess", subProcessId + "_terminateChangeReviewProcess"
      };

      for (String messageName : messagePatterns) {
        LOG.debug("Checking for message subscription: {}", messageName);
        List<Execution> executions =
            runtimeService
                .createExecutionQuery()
                .processInstanceId(task.getProcessInstanceId())
                .messageEventSubscriptionName(messageName)
                .list();
        if (!executions.isEmpty()) {
          LOG.debug(
              "Found {} executions with message subscription '{}'", executions.size(), messageName);
          return messageName;
        } else {
          LOG.debug("No executions found for message: {}", messageName);
        }
      }

      LOG.warn(
          "No termination message found for task {} with definition key '{}'",
          task.getId(),
          task.getTaskDefinitionKey());
      return null;
    } catch (Exception e) {
      LOG.error("Error finding termination message for task {}", task.getId(), e);
      return null;
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
    RepositoryService repositoryService = processEngine.getRepositoryService();

    String baseProcessKey = getTriggerWorkflowId(workflowName);

    // For PeriodicBatchEntityTrigger, find all processes that start with the base key
    List<ProcessDefinition> processDefinitions =
        repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKeyLike(baseProcessKey + "-%")
            .latestVersion()
            .list();

    if (!processDefinitions.isEmpty()) {
      boolean anyStarted = false;
      for (ProcessDefinition pd : processDefinitions) {
        try {
          LOG.info("Triggering process with key: {}", pd.getKey());
          runtimeService.startProcessInstanceByKey(pd.getKey());
          anyStarted = true;
        } catch (Exception e) {
          LOG.error("Failed to start process: {}", pd.getKey(), e);
        }
      }
      return anyStarted;
    } else {
      // Fallback to original behavior for other trigger types
      try {
        runtimeService.startProcessInstanceByKey(baseProcessKey);
        return true;
      } catch (FlowableObjectNotFoundException ex) {
        LOG.error("No process definition found for key: {}", baseProcessKey);
        return false;
      }
    }
  }

  public boolean isWorkflowSuspended(String workflowName) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    String triggerWorkflowId = getTriggerWorkflowId(workflowName);

    // Get ALL latest versions of matching process definitions
    List<ProcessDefinition> processDefinitions =
        repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKeyLike(triggerWorkflowId + "%")
            .latestVersion()
            .list(); // Use list() to handle both single and multiple

    if (processDefinitions.isEmpty()) {
      throw new IllegalArgumentException(
          "Process Definition not found for workflow: " + workflowName);
    }

    // Check if all are suspended
    boolean allSuspended = processDefinitions.stream().allMatch(ProcessDefinition::isSuspended);
    boolean allActive = processDefinitions.stream().noneMatch(ProcessDefinition::isSuspended);

    if (!allSuspended && !allActive) {
      LOG.warn(
          "Workflow '{}' has inconsistent suspension state across {} process definitions",
          workflowName,
          processDefinitions.size());
    }

    return allSuspended;
  }

  public void suspendWorkflow(String workflowName) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    String triggerWorkflowId = getTriggerWorkflowId(workflowName);

    // Get ALL latest versions of matching process definitions
    List<ProcessDefinition> processDefinitions =
        repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKeyLike(triggerWorkflowId + "%")
            .latestVersion()
            .list();

    if (processDefinitions.isEmpty()) {
      throw new IllegalArgumentException(
          "Process Definition not found for workflow: " + workflowName);
    }

    // Check if all are already suspended
    if (processDefinitions.stream().allMatch(ProcessDefinition::isSuspended)) {
      LOG.debug("Workflow '{}' is already suspended.", workflowName);
      return;
    }

    // Suspend each process definition that isn't already suspended
    for (ProcessDefinition pd : processDefinitions) {
      if (!pd.isSuspended()) {
        // Use suspendProcessDefinitionById to suspend only this specific version
        repositoryService.suspendProcessDefinitionById(pd.getId(), true, null);
        LOG.debug("Suspended process definition: {} (version {})", pd.getKey(), pd.getVersion());
      }
    }

    LOG.info("Successfully suspended workflow '{}'", workflowName);
  }

  public void resumeWorkflow(String workflowName) {
    RepositoryService repositoryService = processEngine.getRepositoryService();
    String triggerWorkflowId = getTriggerWorkflowId(workflowName);

    // Get ALL latest versions of matching process definitions
    List<ProcessDefinition> processDefinitions =
        repositoryService
            .createProcessDefinitionQuery()
            .processDefinitionKeyLike(triggerWorkflowId + "%")
            .latestVersion()
            .list();

    if (processDefinitions.isEmpty()) {
      throw new IllegalArgumentException(
          "Process Definition not found for workflow: " + workflowName);
    }

    // Check if all are already active
    if (processDefinitions.stream().noneMatch(ProcessDefinition::isSuspended)) {
      LOG.debug("Workflow '{}' is already active.", workflowName);
      return;
    }

    // Resume each process definition that is suspended
    for (ProcessDefinition pd : processDefinitions) {
      if (pd.isSuspended()) {
        // Use activateProcessDefinitionById to activate only this specific version
        repositoryService.activateProcessDefinitionById(pd.getId(), true, null);
        LOG.debug("Activated process definition: {} (version {})", pd.getKey(), pd.getVersion());
      }
    }

    LOG.info("Successfully resumed workflow '{}'", workflowName);
  }

  public void terminateWorkflow(String workflowName) {
    RuntimeService runtimeService = processEngine.getRuntimeService();
    String triggerWorkflowId = getTriggerWorkflowId(workflowName);
    runtimeService
        .createProcessInstanceQuery()
        .processDefinitionKeyLike(triggerWorkflowId + "%")
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
                  // Terminate both trigger and main workflow instances

                  // Now terminate the main workflow instances that contain the user tasks
                  for (WorkflowInstance instance : conflictingInstances) {
                    ProcessInstance mainInstance =
                        runningProcessInstances.stream()
                            .filter(
                                pi ->
                                    pi.getBusinessKey() != null
                                        && pi.getBusinessKey().equals(instance.getId().toString()))
                            .findFirst()
                            .orElse(null);

                    if (mainInstance != null) {
                      LOG.info(
                          "Terminating main workflow instance {} for conflicting instance {}",
                          mainInstance.getId(),
                          instance.getId());
                      runtimeService.deleteProcessInstance(
                          mainInstance.getId(), "Terminated due to conflicting workflow instance");
                    }

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

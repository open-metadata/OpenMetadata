package org.openmetadata.service.governance.workflows.elements.nodes.userTasks.impl;

import org.flowable.engine.delegate.TaskListener;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.task.service.delegate.DelegateTask;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.resources.feeds.FeedResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.WebsocketNotificationHandler;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class CreateApprovalTaskImpl implements TaskListener {
    @Override
    public void notify(DelegateTask delegateTask) {
        List<EntityReference> assignees = getAssignees(delegateTask);
        GlossaryTerm entity = Entity.getEntity(
                JsonUtils.readOrConvertValue(delegateTask.getVariable("relatedEntity"), EntityReference.class),
                "*",
                Include.ALL
        );
        Thread task = createApprovalTask(entity, assignees);

        String processInstanceId = delegateTask.getProcessInstanceId();
        String processDefinitionKey = Arrays.stream(delegateTask.getProcessDefinitionId().split(":")).toList().get(0);
        String taskId = delegateTask.getId();

        WorkflowInstanceStateRepository workflowInstanceStateRepository = (WorkflowInstanceStateRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);
        WorkflowInstanceState latestWorkflowInstanceState = workflowInstanceStateRepository.getLastWorkflowInstanceStateForWorkflowInstanceId(processInstanceId);
        workflowInstanceStateRepository.createNewRecord(
                latestWorkflowInstanceState
                        .withState(WorkflowInstanceState.State.WAITING_USER)
                        .withWorkflowInstanceId(processInstanceId)
                        .withTimestamp(System.currentTimeMillis())
                        .withTaskId(task.getId())
                        .withFlowableTaskId(taskId),
                String.format("%s.%s", processDefinitionKey, processInstanceId));
    }

    private List<EntityReference> getAssignees(DelegateTask delegateTask) {
        List<EntityReference> assignees = new ArrayList<>();
        UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);

        Set<IdentityLink> candidates = delegateTask.getCandidates();
        // TODO: What if we define a team?
        if (!candidates.isEmpty()) {
            for (IdentityLink candidate : candidates) {
                String userName = candidate.getUserId();
                User user = userRepository.getByName(null, userName, new EntityUtil.Fields(Set.of()));
                assignees.add(user.getEntityReference());
            }
        } else {
            String userName = delegateTask.getAssignee();
            User user = userRepository.getByName(null, userName, new EntityUtil.Fields(Set.of()));
            assignees.add(user.getEntityReference());
        }
        return assignees;
    }

    private Thread createApprovalTask(GlossaryTerm entity, List<EntityReference> assignees) {
        TaskDetails taskDetails =
                new TaskDetails()
                        .withAssignees(FeedResource.formatAssignees(assignees))
                        .withType(TaskType.RequestApproval)
                        .withStatus(TaskStatus.Open);

        MessageParser.EntityLink about = new MessageParser.EntityLink(Entity.getEntityTypeFromObject(entity), entity.getFullyQualifiedName());
        Thread thread =
                new Thread()
                        .withId(UUID.randomUUID())
                        .withThreadTs(System.currentTimeMillis())
                        .withMessage("Approval required for ")
                        .withCreatedBy(entity.getUpdatedBy())
                        .withAbout(about.getLinkString())
                        .withType(ThreadType.Task)
                        .withTask(taskDetails)
                        .withUpdatedBy(entity.getUpdatedBy())
                        .withUpdatedAt(System.currentTimeMillis());
        FeedRepository feedRepository = Entity.getFeedRepository();
        feedRepository.create(thread);

        // Send WebSocket Notification
        WebsocketNotificationHandler.handleTaskNotification(thread);

        return thread;
    }
}

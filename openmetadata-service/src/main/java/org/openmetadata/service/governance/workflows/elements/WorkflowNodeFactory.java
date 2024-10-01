package org.openmetadata.service.governance.workflows.elements;

import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTasks.CheckEntityHasReviewersTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTasks.SetGlossaryTermStatusTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvents.EndEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.triggers.EntityEventTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTasks.UserApprovalTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks.CheckEntityHasReviewersTask;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks.SetGlossaryTermStatusTask;
import org.openmetadata.service.governance.workflows.elements.nodes.endEvents.EndEvent;
import org.openmetadata.service.governance.workflows.elements.nodes.triggers.EntityEventTrigger;
import org.openmetadata.service.governance.workflows.elements.nodes.userTasks.UserApprovalTask;
import org.openmetadata.service.util.JsonUtils;

import java.util.Map;


public class WorkflowNodeFactory {

    public static WorkflowNodeInterface createNode(WorkflowNodeDefinitionInterface nodeDefinition) {
        return switch (nodeDefinition.getNodeSubType()) {
            case ENTITY_EVENT_TRIGGER -> new EntityEventTrigger(nodeDefinition);
            case END_EVENT -> new EndEvent(nodeDefinition);
            case CHECK_ENTITY_HAS_REVIEWERS_TASK ->  new CheckEntityHasReviewersTask(nodeDefinition);
            case SET_GLOSSARY_TERM_STATUS_TASK -> new SetGlossaryTermStatusTask(nodeDefinition);
            case USER_APPROVAL_TASK -> new UserApprovalTask(nodeDefinition);
        };
    }
    public static WorkflowNodeInterface createNode(Map<String, Object> nodeDefinition) {
        return switch (NodeSubType.fromValue((String) nodeDefinition.get("subType"))) {
            case ENTITY_EVENT_TRIGGER -> new EntityEventTrigger(JsonUtils.readOrConvertValue(nodeDefinition, EntityEventTriggerDefinition.class));
            case END_EVENT -> new EndEvent(JsonUtils.readOrConvertValue(nodeDefinition, EndEventDefinition.class));
            case CHECK_ENTITY_HAS_REVIEWERS_TASK ->  new CheckEntityHasReviewersTask(JsonUtils.readOrConvertValue(nodeDefinition, CheckEntityHasReviewersTaskDefinition.class));
            case SET_GLOSSARY_TERM_STATUS_TASK -> new SetGlossaryTermStatusTask(JsonUtils.readOrConvertValue(nodeDefinition, SetGlossaryTermStatusTaskDefinition.class));
            case USER_APPROVAL_TASK -> new UserApprovalTask(JsonUtils.readOrConvertValue(nodeDefinition, UserApprovalTaskDefinition.class));
        };
    }
}

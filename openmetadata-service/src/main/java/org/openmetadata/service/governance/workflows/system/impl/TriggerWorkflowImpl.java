package org.openmetadata.service.governance.workflows.system.impl;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.util.JsonUtils;

import java.util.Map;

public class TriggerWorkflowImpl implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        String workflowToTrigger = (String) execution.getVariable("workflowToTrigger");
        Map<String, Object> workflowVariables = JsonUtils.readOrConvertValue(execution.getVariable("workflowToTriggerVariables"), Map.class);

        WorkflowHandler.getInstance().triggerByKey(workflowToTrigger, workflowVariables);
    }
}

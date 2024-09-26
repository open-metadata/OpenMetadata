package org.openmetadata.service.governance.workflows;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.util.JsonUtils;

import java.util.Map;

public class WorkflowVariableSetter implements JavaDelegate {
    private Expression variablesExpr;

    @Override
    public void execute(DelegateExecution execution) {
        Map<String, Object> variables = JsonUtils.readOrConvertValue(variablesExpr.getValue(execution), Map.class);

        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            execution.setVariableLocal(entry.getKey(), entry.getValue());
        }
    }
}

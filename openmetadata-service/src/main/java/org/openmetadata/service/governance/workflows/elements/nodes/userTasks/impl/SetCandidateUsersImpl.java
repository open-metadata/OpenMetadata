package org.openmetadata.service.governance.workflows.elements.nodes.userTasks.impl;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.task.service.delegate.DelegateTask;
import org.openmetadata.service.util.JsonUtils;

import java.util.List;

public class SetCandidateUsersImpl implements TaskListener {
    private Expression assigneesVarNameExpr;
    @Override
    public void notify(DelegateTask delegateTask) {
        List<String> assignees = JsonUtils.readOrConvertValue(delegateTask.getVariable(assigneesVarNameExpr.getValue(delegateTask).toString()), List.class);
        delegateTask.addCandidateUsers(assignees);
    }
}

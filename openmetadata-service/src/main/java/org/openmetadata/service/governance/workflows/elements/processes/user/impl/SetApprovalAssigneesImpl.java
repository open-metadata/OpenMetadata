package org.openmetadata.service.governance.workflows.elements.processes.user.impl;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class SetApprovalAssigneesImpl implements JavaDelegate {
    private Expression assigneesExpr;
    private Expression assigneesVarNameExpr;
    @Override
    public void execute(DelegateExecution execution) {
        Map<String, Object> assigneesConfig = JsonUtils.readOrConvertValue(assigneesExpr.getValue(execution), Map.class);
        Boolean addReviewers = (Boolean) assigneesConfig.get("addReviewers");
        Optional<List<EntityReference>> oExtraAssignees = Optional.ofNullable(JsonUtils.readOrConvertValue(assigneesConfig.get("extraAssignees"), List.class));

        List<String> assignees = new ArrayList<>();

        if (addReviewers) {
            EntityReference entityReference = JsonUtils.readOrConvertValue(execution.getVariable("relatedEntity"), EntityReference.class);
            EntityInterface entity = Entity.getEntity(entityReference, "*", Include.ALL);
            assignees.addAll(entity.getReviewers().stream().map(EntityReference::getName).toList());
        }

        oExtraAssignees.ifPresent(extraAssignees -> assignees.addAll(extraAssignees.stream().map(EntityReference::getName).toList()));

        execution.setVariableLocal(assigneesVarNameExpr.getValue(execution).toString(), JsonUtils.pojoToJson(assignees));
    }
}

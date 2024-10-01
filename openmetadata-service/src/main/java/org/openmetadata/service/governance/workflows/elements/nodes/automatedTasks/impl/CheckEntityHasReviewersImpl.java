package org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks.impl;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;


public class CheckEntityHasReviewersImpl implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        EntityReference entityReference = JsonUtils.readOrConvertValue(execution.getVariable("relatedEntity"), EntityReference.class);
        execution.setVariable("checkPassed", hasReviewers(entityReference));
    }

    private Boolean hasReviewers(EntityReference entityReference) {
        EntityInterface entity = Entity.getEntity(entityReference, "*", Include.ALL);
        return !CommonUtil.nullOrEmpty(entity.getReviewers());
    }
}

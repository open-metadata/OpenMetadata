package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.JsonUtils;


public class CheckEntityHasReviewersImpl implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse((String) execution.getVariable("relatedEntity"));
        execution.setVariable("checkPassed", hasReviewers(entityLink));
    }

    private Boolean hasReviewers(MessageParser.EntityLink entityLink) {
        EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
        return !CommonUtil.nullOrEmpty(entity.getReviewers());
    }
}

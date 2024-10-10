package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.JsonUtils;

import java.util.Map;


public class CheckEntityAttributesImpl implements JavaDelegate {
    private Expression rulesExpr;
    @Override
    public void execute(DelegateExecution execution) {
        String rules = (String) rulesExpr.getValue(execution);
        MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse((String) execution.getVariable("relatedEntity"));
        execution.setVariable("checkPassed", checkAttributes(entityLink, rules));
    }

    private Boolean checkAttributes(MessageParser.EntityLink entityLink, String rules) {
        EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

        JsonLogic jsonLogic = new JsonLogic();
        boolean result = false;

        try {
            result = (boolean) jsonLogic.apply(rules, JsonUtils.getMap(entity));
        } catch (JsonLogicException e) {
            throw new RuntimeException(e);
        }

        return result;
    }
}

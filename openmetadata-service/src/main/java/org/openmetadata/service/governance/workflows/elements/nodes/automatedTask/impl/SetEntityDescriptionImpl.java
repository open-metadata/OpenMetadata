package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.JsonUtils;

import javax.json.JsonPatch;
import java.util.Optional;

public class SetEntityDescriptionImpl implements JavaDelegate {
    private Expression descriptionExpr;
    @Override
    public void execute(DelegateExecution execution) {
        MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse((String) execution.getVariable("relatedEntity"));
        EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

        String description = (String) descriptionExpr.getValue(execution);
        String user = Optional.ofNullable((String) execution.getVariable("resolvedBy"))
                .orElse(entity.getUpdatedBy());

        setDescription(entityLink.getEntityType(), entity, user, description);
    }

    private void setDescription(String entityType, EntityInterface entity, String user, String description) {
        String originalJson = JsonUtils.pojoToJson(entity);

        entity.setDescription(description);
        String updatedJson = JsonUtils.pojoToJson(entity);

        JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

        EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
        entityRepository.patch(null, entity.getId(), user, patch);
    }
}

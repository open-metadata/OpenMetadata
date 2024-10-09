package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.JsonUtils;

import javax.json.JsonPatch;
import java.util.Map;
import java.util.Optional;


public class SetGlossaryTermStatusImpl implements JavaDelegate {
    private Expression statusExpr;
    @Override
    public void execute(DelegateExecution execution) {
        MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse((String) execution.getVariable("relatedEntity"));
        GlossaryTerm glossaryTerm = Entity.getEntity(entityLink, "*", Include.ALL);

        String status = (String) statusExpr.getValue(execution);
        String user = Optional.ofNullable((String) execution.getVariable("resolvedBy"))
                .orElse(glossaryTerm.getUpdatedBy());

        setStatus(glossaryTerm, user, status);
    }

    private void setStatus(GlossaryTerm glossaryTerm, String user, String status) {
        String originalJson = JsonUtils.pojoToJson(glossaryTerm);

        glossaryTerm.setStatus(GlossaryTerm.Status.fromValue(status));
        String updatedJson = JsonUtils.pojoToJson(glossaryTerm);

        JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

        GlossaryTermRepository entityRepository = (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
        entityRepository.patch(null, glossaryTerm.getId(), user, patch);
    }
}
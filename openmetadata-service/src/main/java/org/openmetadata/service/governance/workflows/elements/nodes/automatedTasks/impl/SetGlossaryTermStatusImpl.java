package org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks.impl;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.util.JsonUtils;

import javax.json.JsonPatch;
import java.util.Map;


public class SetGlossaryTermStatusImpl implements JavaDelegate {
    private Expression statusExpr;
    @Override
    public void execute(DelegateExecution execution) {
        String status = (String) statusExpr.getValue(execution);
        String user = (String) execution.getVariable("user");

        EntityReference entityReference = JsonUtils.readOrConvertValue(execution.getVariable("relatedEntity"), EntityReference.class);
        setStatus(entityReference, user, status);
    }

    private void setStatus(EntityReference entityReference, String user, String status) {
        GlossaryTerm glossaryTerm = Entity.getEntity(entityReference, "*", Include.ALL);

        String originalJson = JsonUtils.pojoToJson(glossaryTerm);

        glossaryTerm.setStatus(GlossaryTerm.Status.fromValue(status));

        String updatedJson = JsonUtils.pojoToJson(glossaryTerm);
        JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

        GlossaryTermRepository entityRepository = (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
        entityRepository.patch(null, glossaryTerm.getId(), user, patch);
    }
}
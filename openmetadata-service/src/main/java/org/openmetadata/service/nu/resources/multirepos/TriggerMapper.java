package org.openmetadata.service.nu.resources.multirepos;

import org.openmetadata.schema.nu.multirepos.api.CreateTrigger;
import org.openmetadata.schema.nu.multirepos.entity.Trigger;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class TriggerMapper implements EntityMapper<Trigger, CreateTrigger> {
    @Override
    public Trigger createToEntity(CreateTrigger create, String user) {
        return copy(new Trigger(), create, user)
                .withFullyQualifiedName(create.getName())
                .withDagNurn(create.getDagNurn())
                .withDagVersion(create.getDagVersion())
                .withExecutionConfiguration(create.getExecutionConfiguration())
                .withMode(create.getMode())
                .withScheduleInterval(create.getScheduleInterval());
//                .withName(create.getName());
    }
}

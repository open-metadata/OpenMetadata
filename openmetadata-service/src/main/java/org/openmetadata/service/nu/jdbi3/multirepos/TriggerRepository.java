package org.openmetadata.service.nu.jdbi3.multirepos;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.List;
import javax.ws.rs.core.Response;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.nu.multirepos.entity.Trigger;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.nu.resources.multirepos.TriggerResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class TriggerRepository extends EntityRepository<Trigger> {
    private static final String TRIGGER_UPDATE_FIELDS = "";

    public TriggerRepository() {
        super(
                TriggerResource.COLLECTION_PATH,
                Entity.TRIGGER,
                Trigger.class,
                Entity.getCollectionDAO().triggerDAO(),
                TRIGGER_UPDATE_FIELDS,
                TRIGGER_UPDATE_FIELDS);
        supportsSearch = true;
    }

//    @Override
//    public void setFullyQualifiedName(Trigger trigger, EntityUtil.Fields fields) {
////        trigger.setFullyQualifiedName(
////                FullyQualifiedName.add(trigger.getService().getFullyQualifiedName(), trigger.getName()));
//    }

    @Override
    public void setFields(Trigger trigger, Fields fields) {
//        trigger.setService(getContainer(trigger.getId()));
    }

    @Override
    public void restorePatchAttributes(Trigger original, Trigger updated) {
//        super.restorePatchAttributes(original, updated);
//        updated.withService(original.getService());
    }

    @Override
    public void prepare(Trigger trigger, boolean update) {
//        populateService(trigger);
    }

    @Override
    public void storeEntity(Trigger trigger, boolean update) {
//        EntityReference service = trigger.getService();
//        trigger.withService(service);
        store(trigger, update);
//        trigger.withService(service);
    }

    @Override
    public void storeRelationships(Trigger trigger) {
        addServiceRelationship(trigger, trigger.getService());
    }

    @Override
    public void applyTags(Trigger trigger) {
        super.applyTags(trigger);
    }

//    @Override
//    public EntityInterface getParentEntity(Trigger entity, String fields) {
//        return Entity.getEntity(entity.getService(), fields, Include.ALL);
//    }

    @Override
    public void validateTags(Trigger entity) {
        super.validateTags(entity);
    }

    @Override
    public EntityUpdater getUpdater(Trigger original, Trigger updated, Operation operation) {
        return new TriggerUpdater(original, updated, operation);
    }

    @Override
    public List<TagLabel> getAllTags(EntityInterface entity) {
        List<TagLabel> allTags = new ArrayList<>();
        Trigger trigger = (Trigger) entity;
        EntityUtil.mergeTags(allTags, trigger.getTags());
        return allTags;
    }

//    private void populateService(Trigger trigger) {
//        PipelineService service = Entity.getEntity(trigger.getService(), "", NON_DELETED);
//        trigger.setService(service.getEntityReference());
//        trigger.setServiceType(service.getServiceType());
//    }

    @Override
    public void clearFields(Trigger entity, Fields fields) {
        // Implement logic to clear specific fields if necessary
    }

    public class TriggerUpdater extends EntityUpdater {
        public TriggerUpdater(Trigger original, Trigger updated, Operation operation) {
            super(original, updated, operation);
        }
    }
}

package org.openmetadata.service.security.policyevaluator;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Conversation threads require special handling */
public record ThreadResourceContext(String createdBy) implements ResourceContextInterface {
  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public EntityReference getOwner() {
    return Entity.getEntityReferenceByName(Entity.USER, createdBy, Include.NON_DELETED);
  }

  @Override
  public List<TagLabel> getTags() {
    return null;
  }

  @Override
  public EntityInterface getEntity() {
    return null;
  }
}

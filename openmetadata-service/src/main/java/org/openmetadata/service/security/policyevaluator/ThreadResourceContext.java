package org.openmetadata.service.security.policyevaluator;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Conversation threads require special handling */
public class ThreadResourceContext implements ResourceContextInterface {

  // User who created the thread is the owner of thread entity
  private final String createdBy;

  public ThreadResourceContext(String createdBy) {
    this.createdBy = createdBy;
  }

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

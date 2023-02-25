package org.openmetadata.service.security.policyevaluator;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Posts that are part of conversation threads require special handling */
public class PostResourceContext implements ResourceContextInterface {
  private final EntityReference owner;

  public PostResourceContext(EntityReference owner) {
    this.owner = owner;
  }

  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public EntityReference getOwner() {
    return owner;
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

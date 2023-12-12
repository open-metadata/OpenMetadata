package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Posts that are part of conversation threads require special handling */
public class PostResourceContext implements ResourceContextInterface {

  // The user who posted to thread is the owner of that post
  private final String postedBy;

  public PostResourceContext(String postedBy) {
    this.postedBy = postedBy;
  }

  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public EntityReference getOwner() {
    return Entity.getEntityReferenceByName(Entity.USER, postedBy, NON_DELETED);
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

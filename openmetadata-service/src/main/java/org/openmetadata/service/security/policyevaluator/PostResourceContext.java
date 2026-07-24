package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Posts that are part of conversation threads require special handling */
public record PostResourceContext(String postedBy, ThreadResourceContext threadContext)
    implements ResourceContextInterface {
  public PostResourceContext(String postedBy) {
    this(postedBy, (ThreadResourceContext) null);
  }

  public PostResourceContext(String postedBy, Thread thread) {
    this(postedBy, thread == null ? null : new ThreadResourceContext(thread));
  }

  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public List<EntityReference> getOwners() {
    if (postedBy == null) {
      return null;
    }
    List<EntityReference> owners = new ArrayList<>();
    owners.add(Entity.getEntityReferenceByName(Entity.USER, postedBy, Include.NON_DELETED));
    return owners;
  }

  @Override
  public List<TagLabel> getTags() {
    return null;
  }

  @Override
  public EntityInterface getEntity() {
    return threadContext == null ? null : threadContext.getEntity();
  }

  @Override
  public List<EntityReference> getDomains() {
    return threadContext == null ? null : threadContext.getDomains();
  }
}

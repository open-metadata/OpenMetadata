package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Posts that are part of conversation threads require special handling */
public record PostResourceContext(String postedBy) implements ResourceContextInterface {
  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public List<EntityReference> getOwners() {
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
    return null;
  }

  @Override
  public List<EntityReference> getDomains() {
    return null;
  }
}

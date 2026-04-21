package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/** Conversation threads require special handling */
public record ThreadResourceContext(String createdBy, List<UUID> domainIds)
    implements ResourceContextInterface {
  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public List<EntityReference> getOwners() {
    List<EntityReference> owners = new ArrayList<>();
    owners.add(Entity.getEntityReferenceByName(Entity.USER, createdBy, Include.NON_DELETED));
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
    if (domainIds == null || domainIds.isEmpty()) {
      return null;
    }
    List<EntityReference> domains = new ArrayList<>();
    for (UUID domainId : domainIds) {
      try {
        domains.add(
            Entity.getEntityReferenceById(Entity.DOMAIN, domainId, Include.NON_DELETED));
      } catch (Exception ignored) {
        // Domain may have been deleted; skip it rather than blocking thread access
      }
    }
    return domains.isEmpty() ? null : domains;
  }
}

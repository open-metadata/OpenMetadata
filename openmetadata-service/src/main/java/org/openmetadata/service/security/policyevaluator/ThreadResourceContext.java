package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;

/** Conversation threads require special handling */
public record ThreadResourceContext(Thread thread) implements ResourceContextInterface {
  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public List<EntityReference> getOwners() {
    if (thread == null || thread.getCreatedBy() == null) {
      return null;
    }
    List<EntityReference> owners = new ArrayList<>();
    owners.add(
        Entity.getEntityReferenceByName(Entity.USER, thread.getCreatedBy(), Include.NON_DELETED));
    return owners;
  }

  @Override
  public List<TagLabel> getTags() {
    return null;
  }

  @Override
  public EntityInterface getEntity() {
    return resolveAboutEntity(thread);
  }

  @Override
  public List<EntityReference> getDomains() {
    return resolveDomains(thread);
  }

  static List<EntityReference> resolveDomains(Thread thread) {
    if (thread == null) {
      return null;
    }

    EntityInterface aboutEntity = resolveAboutEntity(thread);
    if (aboutEntity != null && !nullOrEmpty(aboutEntity.getDomains())) {
      return aboutEntity.getDomains();
    }

    List<UUID> domainIds = thread.getDomains();
    if (!nullOrEmpty(domainIds)) {
      return EntityUtil.getEntityReferencesById(Entity.DOMAIN, domainIds);
    }

    return null;
  }

  static EntityInterface resolveAboutEntity(Thread thread) {
    if (thread == null || thread.getAbout() == null) {
      return null;
    }
    try {
      EntityLink about = EntityLink.parse(thread.getAbout());
      return Entity.getEntity(about, Entity.FIELD_DOMAINS, Include.ALL);
    } catch (Exception ignored) {
      return null;
    }
  }
}

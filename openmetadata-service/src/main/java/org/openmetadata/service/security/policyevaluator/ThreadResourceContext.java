package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;

/** Conversation threads require special handling */
@Slf4j
public class ThreadResourceContext implements ResourceContextInterface {
  private final Thread thread;
  private final List<EntityReference> owners;
  private final EntityInterface aboutEntity;
  private final List<EntityReference> domains;

  public ThreadResourceContext(Thread thread) {
    this.thread = thread;
    this.owners = resolveOwners(thread);
    this.aboutEntity = resolveAboutEntity(thread);
    this.domains = resolveDomains(thread, aboutEntity);
  }

  @Override
  public String getResource() {
    return Entity.THREAD;
  }

  @Override
  public List<EntityReference> getOwners() {
    return owners;
  }

  @Override
  public List<TagLabel> getTags() {
    return null;
  }

  @Override
  public EntityInterface getEntity() {
    return aboutEntity;
  }

  @Override
  public List<EntityReference> getDomains() {
    return domains;
  }

  private static List<EntityReference> resolveOwners(Thread thread) {
    if (thread == null || thread.getCreatedBy() == null) {
      return null;
    }
    List<EntityReference> owners = new ArrayList<>();
    owners.add(
        Entity.getEntityReferenceByName(Entity.USER, thread.getCreatedBy(), Include.NON_DELETED));
    return owners;
  }

  static List<EntityReference> resolveDomains(Thread thread, EntityInterface aboutEntity) {
    if (thread == null) {
      return null;
    }

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
    } catch (IllegalArgumentException | EntityNotFoundException e) {
      return null;
    } catch (RuntimeException e) {
      LOG.debug("Failed to resolve about entity for thread {}", thread.getId(), e);
      return null;
    }
  }
}

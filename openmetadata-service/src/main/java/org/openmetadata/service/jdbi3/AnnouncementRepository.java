/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.ANNOUNCEMENT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.type.AnnouncementStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class AnnouncementRepository implements EntityPolicy<Announcement> {

  public static final String COLLECTION_PATH = "/v1/announcements";

  public AnnouncementRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                COLLECTION_PATH,
                ANNOUNCEMENT,
                Announcement.class,
                Entity.getCollectionDAO().announcementDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(false);
    context().options().setQuoteFqn(false);
  }

  public AnnouncementRepository(Jdbi jdbi) {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                COLLECTION_PATH, ANNOUNCEMENT, Announcement.class, initializeAnnouncementDao(jdbi)),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(false);
    context().options().setQuoteFqn(false);
  }

  @Override
  public void setFullyQualifiedName(Announcement announcement) {
    announcement.setFullyQualifiedName(FullyQualifiedName.quoteName(announcement.getName()));
  }

  @Override
  public void prepare(Announcement announcement, boolean update) {
    if (announcement.getName() == null) {
      announcement.setName("announcement-" + announcement.getId());
    }
    inheritOwnersAndDomainsFromTargetEntity(announcement);
    if (announcement.getStatus() == null) {
      long now = System.currentTimeMillis();
      if (announcement.getEndTime() < now) {
        announcement.setStatus(AnnouncementStatus.Expired);
      } else if (announcement.getStartTime() > now) {
        announcement.setStatus(AnnouncementStatus.Scheduled);
      } else {
        announcement.setStatus(AnnouncementStatus.Active);
      }
    }
  }

  @Override
  public void storeEntity(Announcement announcement, boolean update) {
    List<EntityReference> owners = announcement.getOwners();
    List<EntityReference> domains = announcement.getDomains();
    announcement.withOwners(null).withDomains(null);
    if (update) {
      persistence().store(announcement, true);
    } else {
      ((CollectionDAO.AnnouncementDAO) context().schema().dao())
          .insertAnnouncement(
              announcement.getId().toString(),
              JsonUtils.pojoToJson(announcement),
              announcement.getFullyQualifiedName());
    }
    announcement.withOwners(owners).withDomains(domains);
  }

  @Override
  public void setFields(Announcement announcement, Fields fields, RelationIncludes includes) {
    announcement.setOwners(
        fields.contains(FIELD_OWNERS)
            ? relationshipFields().owners(announcement, Include.NON_DELETED)
            : announcement.getOwners());
    announcement.setDomains(
        fields.contains(FIELD_DOMAINS) ? getDomains(announcement) : announcement.getDomains());
  }

  @Override
  public void clearFields(Announcement announcement, Fields fields) {
    announcement.setOwners(fields.contains(FIELD_OWNERS) ? announcement.getOwners() : null);
    announcement.setDomains(fields.contains(FIELD_DOMAINS) ? announcement.getDomains() : null);
  }

  @Override
  public void storeRelationships(Announcement announcement) {
    storeOwners(announcement, announcement.getOwners());
    storeDomains(announcement, announcement.getDomains());
    EntityReference about = getAboutEntity(announcement);
    if (about != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  about.getId(),
                  announcement.getId(),
                  about.getType(),
                  ANNOUNCEMENT,
                  Relationship.MENTIONED_IN),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public List<EntityReference> getDomains(Announcement announcement) {
    return relationships()
        .from(
            new EntityRelationshipReader.Selection(
                announcement.getId(), ANNOUNCEMENT, Relationship.HAS, DOMAIN),
            Include.NON_DELETED);
  }

  public void addDomainFilter(ListFilter filter, String domainFilter) {
    if (nullOrEmpty(domainFilter)) {
      return;
    }
    List<EntityReference> domains =
        Arrays.stream(domainFilter.split(","))
            .map(String::trim)
            .filter(domain -> !domain.isEmpty())
            .map(domain -> Entity.getEntityReferenceByName(DOMAIN, domain, NON_DELETED))
            .toList();
    if (!nullOrEmpty(domains)) {
      filter.addQueryParam("domainId", EntityUtil.getCommaSeparatedIdsFromRefs(domains));
    }
  }

  public void syncAnnouncementDomainsForEntity(
      UUID entityId, String entityType, List<EntityReference> newDomains) {
    List<CollectionDAO.EntityRelationshipRecord> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findTo(entityId, entityType, Relationship.MENTIONED_IN.ordinal(), ANNOUNCEMENT);
    if (records.isEmpty()) {
      return;
    }
    List<UUID> announcementIds =
        records.stream().map(CollectionDAO.EntityRelationshipRecord::getId).toList();
    List<String> announcementIdStrings = announcementIds.stream().map(UUID::toString).toList();
    context()
        .dependencies()
        .daos()
        .relationshipDAO()
        .deleteToMany(announcementIdStrings, ANNOUNCEMENT, Relationship.HAS.ordinal(), DOMAIN);
    if (!nullOrEmpty(newDomains)) {
      for (EntityReference domain : newDomains) {
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .bulkInsertToRelationship(
                domain.getId(), announcementIds, DOMAIN, ANNOUNCEMENT, Relationship.HAS.ordinal());
      }
    }
  }

  @Override
  public EntityUpdater<Announcement> getUpdater(
      Announcement original,
      Announcement updated,
      EntityOperation operation,
      org.openmetadata.schema.type.change.ChangeSource changeSource) {
    return new AnnouncementUpdater(original, updated, operation, changeSource).mutation();
  }

  public class AnnouncementUpdater implements EntitySpecificMutation<Announcement> {

    public AnnouncementUpdater(
        Announcement original,
        Announcement updated,
        EntityOperation operation,
        org.openmetadata.schema.type.change.ChangeSource changeSource) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, changeSource, false),
              this);
    }

    @Override
    public void update(EntityUpdater<Announcement> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.recordChange(
          "startTime",
          entityUpdate.getOriginal().getStartTime(),
          entityUpdate.getUpdated().getStartTime());
      entityUpdate.recordChange(
          "endTime",
          entityUpdate.getOriginal().getEndTime(),
          entityUpdate.getUpdated().getEndTime());
      entityUpdate.recordChange(
          "status", entityUpdate.getOriginal().getStatus(), entityUpdate.getUpdated().getStatus());
    }

    private final EntityUpdater<Announcement> entityUpdate;

    public EntityUpdater<Announcement> mutation() {
      return entityUpdate;
    }
  }

  private void inheritOwnersAndDomainsFromTargetEntity(Announcement announcement) {
    EntityReference about = getAboutEntity(announcement);
    if (about == null) {
      return;
    }
    if (nullOrEmpty(announcement.getOwners())) {
      try {
        announcement.setOwners(Entity.getOwners(about));
      } catch (Exception e) {
        LOG.debug(
            "Could not inherit owners for announcement {} from {}: {}",
            announcement.getId(),
            about.getFullyQualifiedName(),
            e.getMessage());
      }
    }
    if (nullOrEmpty(announcement.getDomains())) {
      try {
        EntityPolicy<?> targetRepo = Entity.getEntityRepository(about.getType());
        Object targetEntity =
            targetRepo
                .reads()
                .byId(
                    about.getId(),
                    new EntityReadService.Query(
                        null,
                        targetRepo.fieldPolicy().parse(FIELD_DOMAINS),
                        RelationIncludes.fromInclude(Include.NON_DELETED),
                        false));
        announcement.setDomains(extractDomainsFromEntity(targetEntity));
      } catch (Exception e) {
        LOG.debug(
            "Could not inherit domains for announcement {} from {}: {}",
            announcement.getId(),
            about.getFullyQualifiedName(),
            e.getMessage());
      }
    }
  }

  @SuppressWarnings("unchecked")
  private List<EntityReference> extractDomainsFromEntity(Object entity) {
    if (entity == null) {
      return null;
    }
    try {
      Object domains = entity.getClass().getMethod("getDomains").invoke(entity);
      if (domains instanceof List<?>) {
        return (List<EntityReference>) domains;
      }
    } catch (NoSuchMethodException e) {
      LOG.debug("Entity {} does not expose domains", entity.getClass().getSimpleName());
    } catch (Exception e) {
      LOG.debug("Failed to extract announcement domains: {}", e.getMessage());
    }
    return null;
  }

  private EntityReference getAboutEntity(Announcement announcement) {
    if (nullOrEmpty(announcement.getEntityLink())) {
      return null;
    }
    try {
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(announcement.getEntityLink());
      return EntityUtil.validateEntityLink(entityLink);
    } catch (Exception e) {
      LOG.warn(
          "Failed to resolve announcement target for {} from entityLink {}: {}",
          announcement.getId(),
          announcement.getEntityLink(),
          e.getMessage());
      return null;
    }
  }

  private static CollectionDAO.AnnouncementDAO initializeAnnouncementDao(Jdbi jdbi) {
    if (Entity.getJdbi() == null) {
      Entity.setJdbi(jdbi);
    }
    if (Entity.getCollectionDAO() == null) {
      Entity.setCollectionDAO(jdbi.onDemand(CollectionDAO.class));
    }
    return Entity.getCollectionDAO().announcementDAO();
  }

  private final EntityPolicyContext<Announcement> entityContext;

  @Override
  public final EntityPolicyContext<Announcement> context() {
    return entityContext;
  }
}

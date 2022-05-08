/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.jdbi3;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.Bot;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.resources.bots.BotResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class BotRepository extends EntityRepository<Bot> {
  public BotRepository(CollectionDAO dao) {
    super(BotResource.COLLECTION_PATH, Entity.BOT, Bot.class, dao.botDAO(), dao, "", "");
  }

  @Override
  public Bot setFields(Bot entity, Fields fields) throws IOException {
    return entity.withBotUser(getBotUser(entity));
  }

  @Override
  public EntityInterface<Bot> getEntityInterface(Bot entity) {
    return new BotEntityInterface(entity);
  }

  @Override
  public void prepare(Bot entity) throws IOException {
    User user = daoCollection.userDAO().findEntityById(entity.getBotUser().getId(), Include.ALL);
    entity.getBotUser().withName(user.getName()).withDisplayName(user.getDisplayName());
  }

  @Override
  public void storeEntity(Bot entity, boolean update) throws IOException {
    EntityReference botUser = entity.getBotUser();
    entity.withBotUser(null);
    store(entity.getId(), entity, update);
    entity.withBotUser(botUser);
  }

  @Override
  public void storeRelationships(Bot entity) {
    addRelationship(entity.getId(), entity.getBotUser().getId(), Entity.BOT, Entity.USER, Relationship.CONTAINS);
  }

  @Override
  public EntityRepository<Bot>.EntityUpdater getUpdater(Bot original, Bot updated, Operation operation) {
    return new BotUpdater(original, updated, operation);
  }

  @Override
  public void restorePatchAttributes(Bot original, Bot updated) {
    // Bot user can't be changed by patch
    updated.withBotUser(original.getBotUser());
  }

  public EntityReference getBotUser(Bot bot) throws IOException {
    List<String> refs = findTo(bot.getId(), Entity.BOT, Relationship.CONTAINS, Entity.USER);
    ensureSingleRelationship(Entity.BOT, bot.getId(), refs, "botUser", true);
    return refs.isEmpty()
        ? null
        : daoCollection.userDAO().findEntityReferenceById(UUID.fromString(refs.get(0)), Include.ALL);
  }

  public static class BotEntityInterface extends EntityInterface<Bot> {
    public BotEntityInterface(Bot entity) {
      super(Entity.BOT, entity);
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public Bot getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return null;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Bot withHref(URI href) {
      return entity.withHref(href);
    }
  }

  public class BotUpdater extends EntityUpdater {
    public BotUpdater(Bot original, Bot updated, Operation operation) {
      super(original, updated, operation);
    }
  }
}

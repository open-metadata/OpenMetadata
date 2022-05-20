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
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.Bot;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.resources.bots.BotResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
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
  public void prepare(Bot entity) throws IOException {
    setFullyQualifiedName(entity);
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
  public EntityUpdater getUpdater(Bot original, Bot updated, Operation operation) {
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

  public class BotUpdater extends EntityUpdater {
    public BotUpdater(Bot original, Bot updated, Operation operation) {
      super(original, updated, operation);
    }
  }
}

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

package org.openmetadata.service.jdbi3;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.bots.BotResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class BotRepository extends EntityRepository<Bot> {
  static final String BOT_UPDATE_FIELDS = "botUser";

  public BotRepository() {
    super(
        BotResource.COLLECTION_PATH,
        Entity.BOT,
        Bot.class,
        Entity.getCollectionDAO().botDAO(),
        "",
        BOT_UPDATE_FIELDS);
    quoteFqn = true;
  }

  @Override
  public void setFields(Bot entity, Fields fields) {
    entity.withBotUser(getBotUser(entity));
  }

  @Override
  public void clearFields(Bot entity, Fields fields) {
    /* Do nothing */
  }

  @Override
  public void prepare(Bot entity, boolean update) {
    User user = Entity.getEntity(entity.getBotUser(), "", Include.ALL);
    entity.withBotUser(user.getEntityReference());
  }

  @Override
  public void storeEntity(Bot entity, boolean update) {
    EntityReference botUser = entity.getBotUser();
    entity.withBotUser(null);
    store(entity, update);
    entity.withBotUser(botUser);
  }

  @Override
  public void storeRelationships(Bot entity) {
    addRelationship(
        entity.getId(),
        entity.getBotUser().getId(),
        Entity.BOT,
        Entity.USER,
        Relationship.CONTAINS);
  }

  @Override
  public EntityRepository<Bot>.EntityUpdater getUpdater(
      Bot original, Bot updated, Operation operation, ChangeSource changeSource) {
    return new BotUpdater(original, updated, operation);
  }

  @Override
  public void restorePatchAttributes(Bot original, Bot updated) {
    // Bot user can't be changed by patch
    updated.withBotUser(original.getBotUser());
  }

  public EntityReference getBotUser(Bot bot) {
    return bot.getBotUser() != null
        ? bot.getBotUser()
        : getToEntityRef(bot.getId(), Relationship.CONTAINS, Entity.USER, false);
  }

  public class BotUpdater extends EntityUpdater {
    public BotUpdater(Bot original, Bot updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateUser(original, updated);
    }

    private void updateUser(Bot original, Bot updated) {
      deleteTo(original.getBotUser().getId(), Entity.USER, Relationship.CONTAINS, Entity.BOT);
      addRelationship(
          updated.getId(),
          updated.getBotUser().getId(),
          Entity.BOT,
          Entity.USER,
          Relationship.CONTAINS);
      if (original.getBotUser() == null
          || updated.getBotUser() == null
          || !updated.getBotUser().getId().equals(original.getBotUser().getId())) {
        recordChange(BOT_UPDATE_FIELDS, original.getBotUser(), updated.getBotUser());
      }
    }
  }
}

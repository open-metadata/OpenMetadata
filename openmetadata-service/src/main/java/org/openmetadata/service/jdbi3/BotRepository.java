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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.bots.BotResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository()
public class BotRepository implements EntityPolicy<Bot> {

  static final String BOT_UPDATE_FIELDS = "botUser";

  public BotRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                BotResource.COLLECTION_PATH,
                Entity.BOT,
                Bot.class,
                Entity.getCollectionDAO().botDAO()),
            new EntityPolicyContext.WriteFields("", BOT_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setQuoteFqn(true);
  }

  @Override
  public void setFields(Bot entity, Fields fields, RelationIncludes relationIncludes) {
    entity.withBotUser(getBotUser(entity));
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Bot> entities) {
    if (nullOrEmpty(entities)) {
      return;
    }
    Map<UUID, List<EntityReference>> botUsers =
        batchReferences().outgoing(entities, Relationship.CONTAINS, Entity.USER);
    for (Bot bot : entities) {
      List<EntityReference> userReferences = botUsers.get(bot.getId());
      bot.withBotUser(nullOrEmpty(userReferences) ? null : userReferences.getFirst());
    }
    EntityPolicy.super.setFieldsInBulk(fields, entities);
  }

  @Override
  public void clearFields(Bot entity, Fields fields) {
    /* Do nothing */
  }

  @Override
  public void prepare(Bot entity, boolean update) {
    EntityReference botUserRef = entity.getBotUser();
    if (botUserRef == null) {
      // Race condition detected: Retry by fetching the relationship directly from the database
      botUserRef = getBotUser(entity);
    }
    if (botUserRef == null) {
      // This should never happen
      throw new IllegalStateException(
          String.format("Bot entity [%s] is missing required botUser reference", entity.getId()));
    }
    User user = Entity.getEntity(botUserRef, "", Include.ALL);
    entity.withBotUser(user.getEntityReference());
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("botUser");
  }

  @Override
  public void storeEntity(Bot entity, boolean update) {
    persistence().store(entity, update);
  }

  @Override
  public void storeEntities(List<Bot> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Bot> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Bot::getId).toList();
    deleteFromMany(ids, Entity.BOT, Relationship.CONTAINS, Entity.USER);
  }

  @Override
  public void storeRelationships(Bot entity) {
    relationshipWrites()
        .add(
            new EntityRelationshipWriter.Edge(
                entity.getId(),
                entity.getBotUser().getId(),
                Entity.BOT,
                Entity.USER,
                Relationship.CONTAINS),
            EntityRelationshipWriter.Value.EMPTY,
            false);
  }

  @Override
  public EntityUpdater<Bot> getUpdater(
      Bot original, Bot updated, EntityOperation operation, ChangeSource changeSource) {
    return new BotUpdater(original, updated, operation).mutation();
  }

  @Override
  public void restorePatchAttributes(Bot original, Bot updated) {
    // Bot user can't be changed by patch
    updated.withBotUser(original.getBotUser());
  }

  public EntityReference getBotUser(Bot bot) {
    return bot.getBotUser() != null
        ? bot.getBotUser()
        : relationships().singleTo(bot.getId(), Relationship.CONTAINS, Entity.USER, false);
  }

  public class BotUpdater implements EntitySpecificMutation<Bot> {

    public BotUpdater(Bot original, Bot updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Bot> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          BOT_UPDATE_FIELDS,
          () -> updateUser(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
    }

    private void updateUser(Bot original, Bot updated) {
      relationshipWrites()
          .deleteIncoming(
              new EntityRelationshipWriter.Selection(
                  original.getBotUser().getId(), Entity.USER, Relationship.CONTAINS, Entity.BOT));
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  updated.getId(),
                  updated.getBotUser().getId(),
                  Entity.BOT,
                  Entity.USER,
                  Relationship.CONTAINS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
      if (original.getBotUser() == null
          || updated.getBotUser() == null
          || !updated.getBotUser().getId().equals(original.getBotUser().getId())) {
        entityUpdate.recordChange(BOT_UPDATE_FIELDS, original.getBotUser(), updated.getBotUser());
      }
    }

    private final EntityUpdater<Bot> entityUpdate;

    public EntityUpdater<Bot> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Bot> entityContext;

  @Override
  public final EntityPolicyContext<Bot> context() {
    return entityContext;
  }
}

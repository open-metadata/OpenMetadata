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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.PERSONA;
import static org.openmetadata.service.Entity.USER;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.PersonaContextBuilder;
import org.openmetadata.service.aicontext.PersonaContextCache;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.teams.PersonaResource;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository()
public class PersonaRepository implements EntityPolicy<Persona> {

  static final String PERSONA_UPDATE_FIELDS = "users,default,contextDefinition";

  static final String PERSONA_PATCH_FIELDS = "users,default,contextDefinition";

  static final String FIELD_CONTEXT_DEFINITION = "contextDefinition";

  static final String FIELD_USERS = "users";

  private static final int DEFAULT_MAX_ASSETS = 200;

  private static final int MAX_RULES = 25;

  private static final int MIN_CHARACTER_BUDGET = 10_000;

  private static final int MAX_CHARACTER_BUDGET = 2_000_000;

  private static final int MIN_CACHE_TTL_MINUTES = 1;

  private static final int MAX_CACHE_TTL_MINUTES = 1_440;

  private static final Set<ContextSection> ASSET_SECTIONS =
      Set.of(
          ContextSection.DESCRIPTION,
          ContextSection.SCHEMA,
          ContextSection.CONSTRAINTS,
          ContextSection.JOINS,
          ContextSection.TAGS,
          ContextSection.GLOSSARY_TERMS,
          ContextSection.ARTICLES,
          ContextSection.METRICS,
          ContextSection.LINEAGE,
          ContextSection.PROFILE,
          ContextSection.DATA_QUALITY);

  private static final Set<ContextSection> ARTICLE_SECTIONS =
      Set.of(
          ContextSection.TITLE_SUMMARY,
          ContextSection.FULL_BODY,
          ContextSection.TAGS,
          ContextSection.GLOSSARY_TERMS,
          ContextSection.RELATED_ASSETS);

  private static final Set<ContextSection> METRIC_SECTIONS =
      Set.of(
          ContextSection.DEFINITION,
          ContextSection.FORMULA_EXPRESSION,
          ContextSection.UNIT_GRAIN,
          ContextSection.OWNER,
          ContextSection.TAGS,
          ContextSection.RELATED_ASSETS);

  private static final Set<ContextSection> GLOSSARY_TERM_SECTIONS =
      Set.of(
          ContextSection.DEFINITION,
          ContextSection.SYNONYMS,
          ContextSection.RELATED_TERMS,
          ContextSection.TAGS,
          ContextSection.RELATED_ASSETS);

  public PersonaRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                PersonaResource.COLLECTION_PATH,
                PERSONA,
                Persona.class,
                Entity.getCollectionDAO().personaDAO()),
            new EntityPolicyContext.WriteFields(
                PERSONA_PATCH_FIELDS, PERSONA_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(false);
  }

  @Override
  public void setFields(Persona persona, Fields fields, RelationIncludes relationIncludes) {
    persona.setUsers(fields.contains(FIELD_USERS) ? getUsers(persona) : persona.getUsers());
  }

  @Override
  public void clearFields(Persona persona, Fields fields) {
    persona.setContextDefinition(
        fields.contains(FIELD_CONTEXT_DEFINITION) ? persona.getContextDefinition() : null);
    persona.setUsers(fields.contains(FIELD_USERS) ? persona.getUsers() : null);
  }

  @Override
  public void prepare(Persona persona, boolean update) {
    referenceValidation().users(persona.getUsers());
    validateContextDefinition(persona.getContextDefinition());
    if (Boolean.TRUE.equals(persona.getDefault())) {
      unsetExistingDefaultPersona(persona.getId().toString());
    }
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("users");
  }

  @Override
  public void storeEntity(Persona persona, boolean update) {
    persistence().store(persona, update);
  }

  @Override
  public void storeEntities(List<Persona> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Persona> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Persona::getId).toList();
    deleteFromMany(ids, Entity.PERSONA, Relationship.APPLIED_TO, Entity.USER);
  }

  @Override
  public void storeRelationships(Persona persona) {
    for (EntityReference user : listOrEmpty(persona.getUsers())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  persona.getId(), user.getId(), PERSONA, Entity.USER, Relationship.APPLIED_TO),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public EntityUpdater<Persona> getUpdater(
      Persona original, Persona updated, EntityOperation operation, ChangeSource changeSource) {
    return new PersonaUpdater(original, updated, operation).mutation();
  }

  private List<EntityReference> getUsers(Persona persona) {
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(
                persona.getId(), PERSONA, Relationship.APPLIED_TO, Entity.USER),
            Include.NON_DELETED);
  }

  @Transaction
  private void unsetExistingDefaultPersona(String newDefaultPersonaId) {
    // Capture both id and FQN *before* the bulk update. The bulk update rewrites JSON directly —
    // bypassing invalidateCachesAfterStore — so every affected persona would keep stale
    // "default=true" in both EntityCaches.byId() and EntityCaches.byName()
    // variants.
    // Passing fqn lets
    // invalidateCacheForEntity drop the by-name cache alongside the by-id one.
    List<EntityDAO.EntityIdFqnPair> affected =
        context()
            .dependencies()
            .daos()
            .personaDAO()
            .findOtherDefaultPersonaIdsWithFqn(newDefaultPersonaId);
    context().dependencies().daos().personaDAO().unsetOtherDefaultPersonas(newDefaultPersonaId);
    for (EntityDAO.EntityIdFqnPair persona : affected) {
      EntityCaches.invalidations().referencesChanged(Entity.PERSONA, persona.id, persona.fqn);
    }
  }

  public Persona getSystemDefaultPersona() {
    String json = context().dependencies().daos().personaDAO().findDefaultPersona();
    if (json != null) {
      return JsonUtils.readValue(json, Persona.class);
    }
    return null;
  }

  static void validateContextDefinition(PersonaContextDefinition definition) {
    if (definition == null) {
      return;
    }
    definition.setLastGeneratedAt(null);
    definition.setCacheState(null);
    definition.setLastError(null);
    if (definition.getCharacterBudget() == null
        || definition.getCharacterBudget() < MIN_CHARACTER_BUDGET
        || definition.getCharacterBudget() > MAX_CHARACTER_BUDGET) {
      throw new IllegalArgumentException(
          "Persona context characterBudget must be between 10000 and 2000000");
    }
    if (definition.getCacheTtlMinutes() == null
        || definition.getCacheTtlMinutes() < MIN_CACHE_TTL_MINUTES
        || definition.getCacheTtlMinutes() > MAX_CACHE_TTL_MINUTES) {
      throw new IllegalArgumentException(
          "Persona context cacheTtlMinutes must be between 1 and 1440");
    }
    if (listOrEmpty(definition.getRules()).size() > MAX_RULES) {
      throw new IllegalArgumentException("Persona context supports at most 25 rules");
    }
    Set<UUID> ruleIds = new HashSet<>();
    Set<String> ruleNames = new HashSet<>();
    for (ContextRule rule : listOrEmpty(definition.getRules())) {
      if (rule.getId() == null) {
        rule.setId(UUID.randomUUID());
      }
      if (!ruleIds.add(rule.getId())) {
        throw new IllegalArgumentException(
            "Persona context rule IDs must be unique: " + rule.getId());
      }
      rule.setMatchedCount(null);
      String ruleName = rule.getName() == null ? "" : rule.getName().trim();
      if (nullOrEmpty(ruleName)) {
        throw new IllegalArgumentException("Persona context rule name must not be empty");
      }
      rule.setName(ruleName);
      if (!ruleNames.add(ruleName.toLowerCase(Locale.ROOT))) {
        throw new IllegalArgumentException(
            "Persona context rule names must be unique: " + ruleName);
      }
      String ruleEntityType = rule.getEntityType();
      if (!PersonaContextBuilder.supportsEntityType(ruleEntityType)) {
        throw new IllegalArgumentException(
            "Unsupported persona context entity type: " + ruleEntityType);
      }
      if (PersonaContextBuilder.isKnowledgeEntityType(ruleEntityType)) {
        rule.setFullyRendered(true);
      }
      if (nullOrEmpty(rule.getSections())) {
        rule.setSections(defaultSections(ruleEntityType));
      }
      if (rule.getMaxAssets() == null) {
        rule.setMaxAssets(DEFAULT_MAX_ASSETS);
      } else if (rule.getMaxAssets() < 1 || rule.getMaxAssets() > 1000) {
        throw new IllegalArgumentException(
            "Persona context rule maxAssets must be between 1 and 1000: " + ruleName);
      }
      Set<ContextSection> allowedSections = allowedSections(ruleEntityType);
      if (!allowedSections.containsAll(rule.getSections())) {
        throw new IllegalArgumentException(
            "Persona context rule contains sections that do not apply to " + ruleEntityType);
      }
      if (!nullOrEmpty(rule.getQueryFilter())) {
        JsonNode queryFilter = JsonUtils.readTree(rule.getQueryFilter());
        if (queryFilter == null || !queryFilter.isObject()) {
          throw new IllegalArgumentException(
              "Persona context queryFilter must be a JSON object for rule: " + rule.getName());
        }
      }
    }
  }

  private static Set<ContextSection> allowedSections(String entityType) {
    return switch (entityType) {
      case Entity.PAGE -> ARTICLE_SECTIONS;
      case Entity.METRIC -> METRIC_SECTIONS;
      case Entity.GLOSSARY_TERM -> GLOSSARY_TERM_SECTIONS;
      default -> ASSET_SECTIONS;
    };
  }

  private static Set<ContextSection> defaultSections(String entityType) {
    return switch (entityType) {
      case Entity.PAGE -> Set.of(
          ContextSection.TITLE_SUMMARY, ContextSection.FULL_BODY, ContextSection.TAGS);
      case Entity.METRIC -> Set.of(
          ContextSection.DEFINITION, ContextSection.FORMULA_EXPRESSION, ContextSection.UNIT_GRAIN);
      case Entity.GLOSSARY_TERM -> Set.of(ContextSection.DEFINITION);
      default -> Set.of(
          ContextSection.DESCRIPTION,
          ContextSection.SCHEMA,
          ContextSection.CONSTRAINTS,
          ContextSection.JOINS,
          ContextSection.TAGS,
          ContextSection.GLOSSARY_TERMS,
          ContextSection.ARTICLES,
          ContextSection.METRICS);
    };
  }

  @Override
  public void postCreate(Persona persona) {
    EntityPolicy.super.postCreate(persona);
    if (Boolean.TRUE.equals(persona.getDefault())) {
      SubjectCache.invalidateAllUserContexts();
    } else {
      invalidateUserContexts(persona.getUsers(), List.of());
    }
    // Creates don't broadcast (only the update and delete paths publish), so peers would keep a
    // user context without the persona this create just assigned for the full 15-minute TTL —
    // long enough for the user's persona selection to be rejected as "not assigned".
    var pubsub = CacheBundle.getCacheInvalidationPubSub();
    if (pubsub != null) {
      pubsub.publish(PERSONA, persona.getId(), persona.getFullyQualifiedName(), "create");
    }
  }

  @Override
  @Transaction
  public void preDelete(Persona persona, String deletedBy) {
    // Remove all user-persona relationships (APPLIED_TO)
    List<EntityReference> users =
        relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    persona.getId(), PERSONA, Relationship.APPLIED_TO, USER),
                Include.NON_DELETED);
    for (EntityReference user : listOrEmpty(users)) {
      relationshipWrites()
          .delete(
              new EntityRelationshipWriter.Edge(
                  persona.getId(), user.getId(), PERSONA, USER, Relationship.APPLIED_TO));
    }
    // Remove all default persona relationships (DEFAULTS_TO)
    List<EntityReference> defaultUsers =
        relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    persona.getId(), PERSONA, Relationship.DEFAULTS_TO, USER),
                Include.NON_DELETED);
    for (EntityReference user : listOrEmpty(defaultUsers)) {
      relationshipWrites()
          .delete(
              new EntityRelationshipWriter.Edge(
                  user.getId(), persona.getId(), USER, PERSONA, Relationship.DEFAULTS_TO));
    }
    // Remove all team default persona relationships (HAS)
    List<EntityReference> teams =
        relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    persona.getId(), PERSONA, Relationship.HAS, Entity.TEAM),
                Include.NON_DELETED);
    for (EntityReference team : listOrEmpty(teams)) {
      relationshipWrites()
          .delete(
              new EntityRelationshipWriter.Edge(
                  team.getId(), persona.getId(), Entity.TEAM, PERSONA, Relationship.HAS));
    }
    // Users/teams that had this persona cached embed the persona reference in their serialized
    // JSON. Drop their cached entries so the next read rebuilds without the now-deleted persona.
    for (EntityReference user : listOrEmpty(users)) {
      EntityCaches.invalidations()
          .referencesChanged(USER, user.getId(), user.getFullyQualifiedName());
    }
    for (EntityReference user : listOrEmpty(defaultUsers)) {
      EntityCaches.invalidations()
          .referencesChanged(USER, user.getId(), user.getFullyQualifiedName());
    }
    for (EntityReference team : listOrEmpty(teams)) {
      EntityCaches.invalidations()
          .referencesChanged(Entity.TEAM, team.getId(), team.getFullyQualifiedName());
    }
    if (Boolean.TRUE.equals(persona.getDefault()) || !teams.isEmpty()) {
      SubjectCache.invalidateAllUserContexts();
    } else {
      invalidateUserContexts(users, defaultUsers);
    }
  }

  @Override
  public void postUpdate(Persona original, Persona updated) {
    EntityPolicy.super.postUpdate(original, updated);
    PersonaContextCache.getInstance().invalidate(original, updated);
  }

  @Override
  public void postDelete(Persona persona, boolean hardDelete) {
    PersonaContextCache.getInstance().invalidate(persona);
    EntityPolicy.super.postDelete(persona, hardDelete);
  }

  private boolean userAssignmentsMatch(
      List<EntityReference> originalUsers, List<EntityReference> updatedUsers) {
    Set<UUID> originalUserIds = new HashSet<>();
    Set<UUID> updatedUserIds = new HashSet<>();
    listOrEmpty(originalUsers).forEach(user -> originalUserIds.add(user.getId()));
    listOrEmpty(updatedUsers).forEach(user -> updatedUserIds.add(user.getId()));
    return originalUserIds.equals(updatedUserIds);
  }

  private void invalidateUserContexts(
      List<EntityReference> originalUsers, List<EntityReference> updatedUsers) {
    List<EntityReference> affectedUsers = new ArrayList<>(listOrEmpty(originalUsers));
    affectedUsers.addAll(listOrEmpty(updatedUsers));
    SubjectCache.invalidateUserContexts(affectedUsers);
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class PersonaUpdater implements EntitySpecificMutation<Persona> {

    public PersonaUpdater(Persona original, Persona updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<Persona> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "users", () -> updateUsers(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "default", () -> updateDefault(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "contextDefinition",
          () ->
              entityUpdate.recordChange(
                  "contextDefinition",
                  entityUpdate.getOriginal().getContextDefinition(),
                  entityUpdate.getUpdated().getContextDefinition(),
                  true));
    }

    @Transaction
    private void updateUsers(Persona origPersona, Persona updatedPersona) {
      List<EntityReference> origUsers = listOrEmpty(origPersona.getUsers());
      List<EntityReference> updatedUsers = listOrEmpty(updatedPersona.getUsers());
      boolean assignmentsChanged = !userAssignmentsMatch(origUsers, updatedUsers);
      entityUpdate.updateToRelationships(
          new EntityRelationshipUpdates.Target(
              "users", origPersona.getId(), PERSONA, Entity.USER, Relationship.APPLIED_TO),
          new EntityRelationshipUpdates.References(origUsers, updatedUsers),
          false);
      if (assignmentsChanged) {
        entityUpdate.deferReactOperation(() -> invalidateUserContexts(origUsers, updatedUsers));
      }
    }

    private void updateDefault(Persona origPersona, Persona updatedPersona) {
      Boolean origDefault = origPersona.getDefault();
      Boolean updatedDefault = updatedPersona.getDefault();
      if (!Objects.equals(origDefault, updatedDefault)) {
        entityUpdate.recordChange("default", origDefault, updatedDefault);
        entityUpdate.deferReactOperation(SubjectCache::invalidateAllUserContexts);
      }
    }

    private final EntityUpdater<Persona> entityUpdate;

    public EntityUpdater<Persona> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Persona> entityContext;

  @Override
  public final EntityPolicyContext<Persona> context() {
    return entityContext;
  }
}

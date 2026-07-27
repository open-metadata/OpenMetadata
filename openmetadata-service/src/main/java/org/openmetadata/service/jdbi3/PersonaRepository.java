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
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.PersonaContextBuilder;
import org.openmetadata.service.aicontext.PersonaContextCache;
import org.openmetadata.service.resources.teams.PersonaResource;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
public class PersonaRepository extends EntityRepository<Persona> {
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
    super(
        PersonaResource.COLLECTION_PATH,
        PERSONA,
        Persona.class,
        Entity.getCollectionDAO().personaDAO(),
        PERSONA_PATCH_FIELDS,
        PERSONA_UPDATE_FIELDS);
    this.quoteFqn = true;
    supportsSearch = false;
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
    validateUsers(persona.getUsers());
    validateContextDefinition(persona.getContextDefinition());
    if (Boolean.TRUE.equals(persona.getDefault())) {
      unsetExistingDefaultPersona(persona.getId().toString());
    }
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("users");
  }

  @Override
  public void storeEntity(Persona persona, boolean update) {
    store(persona, update);
  }

  @Override
  public void storeEntities(List<Persona> entities) {
    storeMany(entities);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<Persona> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Persona::getId).toList();
    deleteFromMany(ids, Entity.PERSONA, Relationship.APPLIED_TO, Entity.USER);
  }

  @Override
  public void storeRelationships(Persona persona) {
    for (EntityReference user : listOrEmpty(persona.getUsers())) {
      addRelationship(persona.getId(), user.getId(), PERSONA, Entity.USER, Relationship.APPLIED_TO);
    }
  }

  @Override
  public EntityRepository<Persona>.EntityUpdater getUpdater(
      Persona original, Persona updated, Operation operation, ChangeSource changeSource) {
    return new PersonaUpdater(original, updated, operation);
  }

  private List<EntityReference> getUsers(Persona persona) {
    return findTo(persona.getId(), PERSONA, Relationship.APPLIED_TO, Entity.USER);
  }

  @Transaction
  private void unsetExistingDefaultPersona(String newDefaultPersonaId) {
    // Capture both id and FQN *before* the bulk update. The bulk update rewrites JSON directly —
    // bypassing invalidateCachesAfterStore — so every affected persona would keep stale
    // "default=true" in both EntityRepository.CACHE_WITH_ID and EntityRepository.CACHE_WITH_NAME
    // variants.
    // Passing fqn lets
    // invalidateCacheForEntity drop the by-name cache alongside the by-id one.
    List<EntityDAO.EntityIdFqnPair> affected =
        daoCollection.personaDAO().findOtherDefaultPersonaIdsWithFqn(newDefaultPersonaId);
    daoCollection.personaDAO().unsetOtherDefaultPersonas(newDefaultPersonaId);
    for (EntityDAO.EntityIdFqnPair persona : affected) {
      EntityRepository.invalidateCacheForEntity(Entity.PERSONA, persona.id, persona.fqn);
    }
  }

  public Persona getSystemDefaultPersona() {
    String json = daoCollection.personaDAO().findDefaultPersona();
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
  protected void postCreate(Persona persona) {
    super.postCreate(persona);
    if (Boolean.TRUE.equals(persona.getDefault())) {
      SubjectCache.invalidateAllUserContexts();
    } else {
      invalidateUserContexts(persona.getUsers(), List.of());
    }
  }

  @Override
  @Transaction
  protected void preDelete(Persona persona, String deletedBy) {
    // Remove all user-persona relationships (APPLIED_TO)
    List<EntityReference> users = findTo(persona.getId(), PERSONA, Relationship.APPLIED_TO, USER);
    for (EntityReference user : listOrEmpty(users)) {
      deleteRelationship(persona.getId(), PERSONA, user.getId(), USER, Relationship.APPLIED_TO);
    }

    // Remove all default persona relationships (DEFAULTS_TO)
    List<EntityReference> defaultUsers =
        findTo(persona.getId(), PERSONA, Relationship.DEFAULTS_TO, USER);
    for (EntityReference user : listOrEmpty(defaultUsers)) {
      deleteRelationship(user.getId(), USER, persona.getId(), PERSONA, Relationship.DEFAULTS_TO);
    }

    // Remove all team default persona relationships (HAS)
    List<EntityReference> teams = findFrom(persona.getId(), PERSONA, Relationship.HAS, Entity.TEAM);
    for (EntityReference team : listOrEmpty(teams)) {
      deleteRelationship(team.getId(), Entity.TEAM, persona.getId(), PERSONA, Relationship.HAS);
    }

    // Users/teams that had this persona cached embed the persona reference in their serialized
    // JSON. Drop their cached entries so the next read rebuilds without the now-deleted persona.
    for (EntityReference user : listOrEmpty(users)) {
      EntityRepository.invalidateCacheForEntity(USER, user.getId(), user.getFullyQualifiedName());
    }
    for (EntityReference user : listOrEmpty(defaultUsers)) {
      EntityRepository.invalidateCacheForEntity(USER, user.getId(), user.getFullyQualifiedName());
    }
    for (EntityReference team : listOrEmpty(teams)) {
      EntityRepository.invalidateCacheForEntity(
          Entity.TEAM, team.getId(), team.getFullyQualifiedName());
    }
    if (Boolean.TRUE.equals(persona.getDefault()) || !teams.isEmpty()) {
      SubjectCache.invalidateAllUserContexts();
    } else {
      invalidateUserContexts(users, defaultUsers);
    }
  }

  @Override
  protected void postUpdate(Persona original, Persona updated) {
    super.postUpdate(original, updated);
    PersonaContextCache.getInstance().invalidate(original, updated);
  }

  @Override
  protected void postDelete(Persona persona, boolean hardDelete) {
    PersonaContextCache.getInstance().invalidate(persona);
    super.postDelete(persona, hardDelete);
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

  /** Handles entity updated from PUT and POST operation. */
  public class PersonaUpdater extends EntityUpdater {
    public PersonaUpdater(Persona original, Persona updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate("users", () -> updateUsers(original, updated));
      compareAndUpdate("default", () -> updateDefault(original, updated));
      compareAndUpdate(
          "contextDefinition",
          () ->
              recordChange(
                  "contextDefinition",
                  original.getContextDefinition(),
                  updated.getContextDefinition(),
                  true));
    }

    @Transaction
    private void updateUsers(Persona origPersona, Persona updatedPersona) {
      List<EntityReference> origUsers = listOrEmpty(origPersona.getUsers());
      List<EntityReference> updatedUsers = listOrEmpty(updatedPersona.getUsers());
      boolean assignmentsChanged = !userAssignmentsMatch(origUsers, updatedUsers);
      updateToRelationships(
          "users",
          PERSONA,
          origPersona.getId(),
          Relationship.APPLIED_TO,
          Entity.USER,
          origUsers,
          updatedUsers,
          false);
      if (assignmentsChanged) {
        deferReactOperation(() -> invalidateUserContexts(origUsers, updatedUsers));
      }
    }

    private void updateDefault(Persona origPersona, Persona updatedPersona) {
      Boolean origDefault = origPersona.getDefault();
      Boolean updatedDefault = updatedPersona.getDefault();
      if (!Objects.equals(origDefault, updatedDefault)) {
        recordChange("default", origDefault, updatedDefault);
        deferReactOperation(SubjectCache::invalidateAllUserContexts);
      }
    }
  }
}

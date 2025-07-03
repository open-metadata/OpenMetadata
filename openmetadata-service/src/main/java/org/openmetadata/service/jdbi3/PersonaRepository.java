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
import static org.openmetadata.service.Entity.PERSONA;

import java.util.List;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.teams.PersonaResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class PersonaRepository extends EntityRepository<Persona> {
  static final String PERSONA_UPDATE_FIELDS = "users,default";
  static final String PERSONA_PATCH_FIELDS = "users,default";
  static final String FIELD_USERS = "users";

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
  public void setFields(Persona persona, Fields fields) {
    persona.setUsers(fields.contains(FIELD_USERS) ? getUsers(persona) : persona.getUsers());
  }

  @Override
  public void clearFields(Persona persona, Fields fields) {
    persona.setUsers(fields.contains(FIELD_USERS) ? persona.getUsers() : null);
  }

  @Override
  public void prepare(Persona persona, boolean update) {
    validateUsers(persona.getUsers());
    if (Boolean.TRUE.equals(persona.getDefault())) {
      unsetExistingDefaultPersona(persona.getId().toString());
    }
  }

  @Override
  public void storeEntity(Persona persona, boolean update) {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> users = persona.getUsers();
    // Don't store users, defaultRoles, href as JSON. Build it on the fly based on relationships
    persona.withUsers(null);

    store(persona, update);

    // Restore the relationships
    persona.withUsers(users);
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
    daoCollection.personaDAO().unsetOtherDefaultPersonas(newDefaultPersonaId);
  }

  public Persona getSystemDefaultPersona() {
    String json = daoCollection.personaDAO().findDefaultPersona();
    if (json != null) {
      return JsonUtils.readValue(json, Persona.class);
    }
    return null;
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PersonaUpdater extends EntityUpdater {
    public PersonaUpdater(Persona original, Persona updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateUsers(original, updated);
      updateDefault(original, updated);
    }

    @Transaction
    private void updateUsers(Persona origPersona, Persona updatedPersona) {
      List<EntityReference> origUsers = listOrEmpty(origPersona.getUsers());
      List<EntityReference> updatedUsers = listOrEmpty(updatedPersona.getUsers());
      updateToRelationships(
          "users",
          PERSONA,
          origPersona.getId(),
          Relationship.APPLIED_TO,
          Entity.USER,
          origUsers,
          updatedUsers,
          false);
    }

    private void updateDefault(Persona origPersona, Persona updatedPersona) {
      Boolean origDefault = origPersona.getDefault();
      Boolean updatedDefault = updatedPersona.getDefault();
      if (!Objects.equals(origDefault, updatedDefault)) {
        recordChange("default", origDefault, updatedDefault);
      }
    }
  }
}

/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.aicontext;

import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Persona-membership authorization shared by the REST endpoint and MCP tool. */
public final class PersonaContextAccess {
  private PersonaContextAccess() {}

  public static void authorize(SecurityContext securityContext, Persona persona) {
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    if (subject.isAdmin() || subject.isBot()) {
      return;
    }
    UserRepository users = (UserRepository) Entity.getEntityRepository(Entity.USER);
    if (!users.hasPersona(subject.user(), persona.getId())) {
      throw new AuthorizationException(
          "User is not assigned to persona " + persona.getFullyQualifiedName());
    }
  }

  public static Persona activePersona(SecurityContext securityContext) {
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    UserRepository users = (UserRepository) Entity.getEntityRepository(Entity.USER);
    EntityReference personaReference = users.getDefaultPersona(subject.user());
    if (personaReference == null) {
      throw EntityNotFoundException.byMessage("No active persona is configured for this user");
    }
    return Entity.getEntity(
        Entity.PERSONA, personaReference.getId(), "contextDefinition", Include.NON_DELETED);
  }

  public static void authorizeRefresh(SecurityContext securityContext) {
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    if (!subject.isAdmin() && !subject.isBot()) {
      throw new AuthorizationException("Only admins and bots can refresh persona context");
    }
  }
}

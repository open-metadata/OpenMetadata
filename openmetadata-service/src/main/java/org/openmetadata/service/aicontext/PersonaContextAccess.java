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
import java.util.function.Supplier;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Active persona resolution and context authorization shared by REST and MCP. */
public final class PersonaContextAccess {
  private static final String CONTEXT_DEFINITION_FIELD = "contextDefinition";
  private static volatile Supplier<Persona> missingActivePersonaFallback;

  private PersonaContextAccess() {}

  /**
   * Registers shared context for authenticated callers without an active persona. Register at
   * server startup. The supplier must use a stable persona ID distinct from stored personas for
   * caching. Passing null clears the registration.
   */
  public static void setMissingActivePersonaFallback(Supplier<Persona> fallback) {
    missingActivePersonaFallback = fallback;
  }

  public static PersonaContextCache.CachedResult materialize(
      Authorizer authorizer, SecurityContext securityContext, Persona persona, boolean refresh) {
    authorize(securityContext, persona);
    if (refresh) {
      authorizeRefresh(securityContext);
    }
    return materializeVisibleContext(authorizer, securityContext, persona, refresh);
  }

  /** Materializes the caller's active persona or the registered shared context. */
  public static PersonaContextCache.CachedResult materializeActive(
      Authorizer authorizer, SecurityContext securityContext, boolean refresh) {
    Persona persona = findActivePersona(securityContext);
    if (persona != null) {
      return materialize(authorizer, securityContext, persona, refresh);
    }
    Persona shared = fallbackPersona(securityContext, refresh);
    return materializeVisibleContext(authorizer, securityContext, shared, refresh);
  }

  private static Persona fallbackPersona(SecurityContext securityContext, boolean refresh) {
    Supplier<Persona> fallback = missingActivePersonaFallback;
    if (fallback == null) {
      throw noActivePersona();
    }
    if (refresh) {
      authorizeRefresh(securityContext);
    }
    Persona shared = fallback.get();
    if (shared == null) {
      throw noActivePersona();
    }
    return shared;
  }

  private static PersonaContextCache.CachedResult materializeVisibleContext(
      Authorizer authorizer, SecurityContext securityContext, Persona persona, boolean refresh) {
    PersonaContextCache cache = PersonaContextCache.getInstance();
    PersonaContextCache.CachedResult result;
    if (isAdminOrBot(securityContext)) {
      result = refresh ? cache.refresh(persona) : cache.get(persona, false);
    } else {
      result = cache.getForCaller(persona, authorizer, securityContext);
    }
    return result;
  }

  /** Admins and bots operate the context: they materialize it and see its cache diagnostics. */
  public static boolean isAdminOrBot(SecurityContext securityContext) {
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    return subject.isAdmin() || subject.isBot();
  }

  public static void authorize(SecurityContext securityContext, Persona persona) {
    if (isAdminOrBot(securityContext)) {
      return;
    }
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    if (!subject.hasPersona(persona.getId())) {
      throw new AuthorizationException(
          "User is not assigned to persona " + persona.getFullyQualifiedName());
    }
  }

  /** Resolves the caller's persona or shared context for search scoping. */
  public static Persona activePersona(SecurityContext securityContext) {
    Persona persona = findActivePersona(securityContext);
    return persona != null ? persona : fallbackPersona(securityContext, false);
  }

  private static EntityNotFoundException noActivePersona() {
    return EntityNotFoundException.byMessage("No active persona is configured for this user");
  }

  private static Persona findActivePersona(SecurityContext securityContext) {
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    Persona persona = loadPersona(subject.getActivePersona());
    if (persona != null) {
      return persona;
    }
    UserRepository users = (UserRepository) Entity.getEntityRepository(Entity.USER);
    return loadPersona(users.getDefaultPersona(subject.user()));
  }

  private static Persona loadPersona(EntityReference personaReference) {
    if (personaReference == null) {
      return null;
    }
    try {
      return Entity.getEntity(
          Entity.PERSONA, personaReference.getId(), CONTEXT_DEFINITION_FIELD, Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      return null;
    }
  }

  public static void authorizeRefresh(SecurityContext securityContext) {
    if (!isAdminOrBot(securityContext)) {
      throw new AuthorizationException("Only admins and bots can refresh persona context");
    }
  }
}

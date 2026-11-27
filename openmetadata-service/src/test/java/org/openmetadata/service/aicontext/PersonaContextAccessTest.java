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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.PersonaRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.PersonaResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class PersonaContextAccessTest {
  @Test
  void myContextUsesTheRegisteredFallbackAndPreservesFormatRefreshAndCaching() {
    Persona shared = persona("company");
    Persona active = persona("personal");
    User member = new User().withName("member");
    User admin = new User().withName("admin").withIsAdmin(true);
    SecurityContext caller = mock(SecurityContext.class);
    PersonaContextCache cache =
        new PersonaContextCache(mock(CacheProvider.class), new CacheKeys("test"));
    PersonaRepository personas = mock(PersonaRepository.class);
    when(personas.getAllowedFields()).thenReturn(Set.of("users", "contextDefinition", "userCount"));
    try (var entities = mockStatic(Entity.class);
        var subjects = mockStatic(DefaultAuthorizer.class);
        var caches = mockStatic(PersonaContextCache.class, CALLS_REAL_METHODS)) {
      entities.when(() -> Entity.getEntityRepository(Entity.PERSONA)).thenReturn(personas);
      entities
          .when(() -> Entity.getEntityRepository(Entity.USER))
          .thenReturn(mock(UserRepository.class));
      entities.when(() -> Entity.getEntityClassFromType(Entity.PERSONA)).thenReturn(Persona.class);
      entities
          .when(
              () ->
                  Entity.getEntity(
                      Entity.PERSONA, active.getId(), "contextDefinition", Include.NON_DELETED))
          .thenReturn(active);
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(caller))
          .thenReturn(new SubjectContext(member, null));
      caches.when(PersonaContextCache::getInstance).thenReturn(cache);
      PersonaResource resource = new PersonaResource(mock(Authorizer.class), null);

      try {
        assertThrows(
            EntityNotFoundException.class,
            () -> resource.getMyPersonaContext(null, caller, "json", "false"));
        PersonaContextAccess.setMissingActivePersonaFallback(() -> shared);
        assertContext(
            resource.getMyPersonaContext(null, caller, "json", "false"), shared, "BYPASS");
        assertThrows(
            AuthorizationException.class,
            () -> resource.getMyPersonaContext(null, caller, "json", "true"));

        subjects
            .when(() -> DefaultAuthorizer.getSubjectContext(caller))
            .thenReturn(new SubjectContext(admin, null));
        assertContext(resource.getMyPersonaContext(null, caller, "json", "true"), shared, "BYPASS");
        Response markdown = resource.getMyPersonaContext(null, caller, "markdown", "false");
        assertEquals(MediaType.valueOf(AIContextMarkdown.TEXT_MARKDOWN), markdown.getMediaType());
        assertEquals("HIT", markdown.getHeaderString(PersonaContextCache.CACHE_HEADER));

        admin.setDefaultPersona(active.getEntityReference());
        assertContext(
            resource.getMyPersonaContext(null, caller, "json", "false"), active, "BYPASS");

        var missing = EntityNotFoundException.byMessage("Authenticated user was deleted");
        subjects.when(() -> DefaultAuthorizer.getSubjectContext(caller)).thenThrow(missing);
        assertSame(
            missing,
            assertThrows(
                EntityNotFoundException.class,
                () -> resource.getMyPersonaContext(null, caller, "json", "false")));
      } finally {
        PersonaContextAccess.setMissingActivePersonaFallback(null);
      }
    }
  }

  private static Persona persona(String name) {
    return new Persona()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withContextDefinition(new PersonaContextDefinition());
  }

  private static void assertContext(Response response, Persona expected, String cacheStatus) {
    assertEquals(MediaType.APPLICATION_JSON_TYPE, response.getMediaType());
    assertEquals(expected.getId(), ((PersonaContext) response.getEntity()).getPersona().getId());
    assertEquals(cacheStatus, response.getHeaderString(PersonaContextCache.CACHE_HEADER));
  }
}

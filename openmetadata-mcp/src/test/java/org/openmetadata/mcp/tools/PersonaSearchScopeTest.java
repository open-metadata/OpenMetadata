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
package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.type.personaContext.SearchScope;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.PersonaContextAccess;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class PersonaSearchScopeTest {
  private static final String PERSONA_FILTER =
      "{\"query\":{\"term\":{\"service.name.keyword\":\"finance\"}}}";

  @Test
  void compiledScopeRequiresBothAFilterAndEntityTypes() {
    SearchScope complete =
        new SearchScope().withQueryFilter(PERSONA_FILTER).withEntityTypes(Set.of("table"));

    Optional<PersonaSearchScope> scope = PersonaSearchScope.from(complete);

    assertTrue(scope.isPresent());
    assertEquals(List.of("table"), scope.orElseThrow().entityTypes());
    assertTrue(
        PersonaSearchScope.from(new SearchScope().withQueryFilter(PERSONA_FILTER)).isEmpty());
    assertTrue(
        PersonaSearchScope.from(new SearchScope().withEntityTypes(Set.of("table"))).isEmpty());
    assertTrue(
        PersonaSearchScope.from(
                new SearchScope().withQueryFilter("[]").withEntityTypes(Set.of("table")))
            .isEmpty());
  }

  @Test
  void activePersonaDefinitionIsCompiledIntoTheSearchScope() {
    ContextRule rule =
        new ContextRule()
            .withName("Finance tables")
            .withEntityType(Entity.TABLE)
            .withQueryFilter(PERSONA_FILTER)
            .withEnabled(true)
            .withFilteredInSearch(true);
    Persona persona =
        new Persona()
            .withContextDefinition(
                new PersonaContextDefinition().withEnabled(true).withRules(List.of(rule)));
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);

    try (MockedStatic<PersonaContextAccess> access = mockStatic(PersonaContextAccess.class)) {
      access.when(() -> PersonaContextAccess.activePersona(securityContext)).thenReturn(persona);

      PersonaSearchScope scope = PersonaSearchScope.resolve(securityContext).orElseThrow();

      assertTrue(scope.entityTypes().contains(Entity.TABLE));
      assertTrue(scope.queryFilter().contains("service.name.keyword"));
    }
  }

  @Test
  void missingActivePersonaDegradesToUnscopedSearch() {
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    try (MockedStatic<PersonaContextAccess> access = mockStatic(PersonaContextAccess.class)) {
      access
          .when(() -> PersonaContextAccess.activePersona(securityContext))
          .thenThrow(EntityNotFoundException.byMessage("No active persona"));

      assertTrue(PersonaSearchScope.resolve(securityContext).isEmpty());
    }
  }

  @Test
  void personaFilterIsConjoinedWithTheCallerFilter() {
    PersonaSearchScope scope = new PersonaSearchScope(PERSONA_FILTER, List.of("table"));

    String combined =
        scope.applyTo("{\"bool\":{\"filter\":{\"term\":{\"tier.tagFQN\":\"Tier.Tier1\"}}}}");

    JsonNode filters = JsonUtils.readTree(combined).at("/query/bool/filter");
    assertEquals("Tier.Tier1", filters.get(0).at("/bool/filter/term/tier.tagFQN").asText());
    assertEquals("finance", filters.get(1).at("/term/service.name.keyword").asText());
  }

  @Test
  void scopedEmptyResponseExplainsHowToSearchBeyondTheScope() {
    PersonaSearchScope scope = new PersonaSearchScope(PERSONA_FILTER, List.of("table"));
    Map<String, Object> response = new HashMap<>(Map.of("returnedCount", 0));

    scope.annotate(response);

    assertEquals(true, response.get("personaScopeApplied"));
    assertEquals(List.of("table"), response.get("personaScopeEntityTypes"));
    assertTrue(response.get("message").toString().contains("ignorePersonaScope=true"));
  }

  @Test
  void unscopedFilterIsReturnedUnchanged() {
    PersonaSearchScope scope = new PersonaSearchScope(PERSONA_FILTER, List.of("table"));

    String applied = scope.applyTo(null);

    assertEquals(JsonUtils.readTree(PERSONA_FILTER), JsonUtils.readTree(applied));
    assertFalse(applied.isBlank());
  }
}

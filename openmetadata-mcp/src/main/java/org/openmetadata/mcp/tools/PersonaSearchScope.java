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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.SearchScope;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.aicontext.PersonaContextAccess;
import org.openmetadata.service.aicontext.PersonaContextBuilder;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
record PersonaSearchScope(String queryFilter, List<String> entityTypes) {

  PersonaSearchScope {
    entityTypes = List.copyOf(entityTypes);
  }

  static Optional<PersonaSearchScope> resolve(CatalogSecurityContext securityContext) {
    try {
      Persona persona = PersonaContextAccess.activePersona(securityContext);
      PersonaContextDefinition definition = persona.getContextDefinition();
      SearchScope compiled =
          PersonaContextBuilder.searchScope(
              definition == null ? new PersonaContextDefinition() : definition);
      return from(compiled);
    } catch (EntityNotFoundException exception) {
      LOG.debug("No active persona search scope is configured");
      return Optional.empty();
    } catch (RuntimeException exception) {
      LOG.warn("Unable to apply the active persona's search scope", exception);
      return Optional.empty();
    }
  }

  static Optional<PersonaSearchScope> from(SearchScope scope) {
    if (scope == null
        || nullOrEmpty(scope.getQueryFilter())
        || nullOrEmpty(scope.getEntityTypes())) {
      return Optional.empty();
    }
    try {
      queryNode(scope.getQueryFilter());
      return Optional.of(
          new PersonaSearchScope(scope.getQueryFilter(), new ArrayList<>(scope.getEntityTypes())));
    } catch (RuntimeException exception) {
      LOG.warn("Ignoring an invalid persona search scope: {}", exception.getMessage());
      return Optional.empty();
    }
  }

  String applyTo(String callerFilter) {
    if (nullOrEmpty(callerFilter)) {
      return queryFilter;
    }
    ObjectNode root = JsonUtils.getObjectMapper().createObjectNode();
    ArrayNode filters = root.putObject("query").putObject("bool").putArray("filter");
    filters.add(queryNode(callerFilter));
    filters.add(queryNode(queryFilter));
    return JsonUtils.pojoToJson(root);
  }

  void annotate(Map<String, Object> response) {
    response.put("personaScopeApplied", true);
    response.put("personaScopeEntityTypes", entityTypes);
    if (response.get("returnedCount") instanceof Number count && count.longValue() == 0) {
      response.put(
          "message",
          "No results matched the active persona scope. If the user wants to search beyond it, "
              + "retry with ignorePersonaScope=true.");
    }
  }

  private static JsonNode queryNode(String filter) {
    JsonNode root = JsonUtils.readTree(filter);
    JsonNode query = root != null && root.has("query") ? root.get("query") : root;
    if (query == null || !query.isObject() || query.isEmpty()) {
      throw new IllegalArgumentException("Persona queryFilter must contain a query object");
    }
    return query;
  }

  @FunctionalInterface
  interface Provider {
    Optional<PersonaSearchScope> resolve(CatalogSecurityContext securityContext);
  }
}

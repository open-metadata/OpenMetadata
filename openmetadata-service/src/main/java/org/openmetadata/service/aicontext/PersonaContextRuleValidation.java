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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.Map;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.search.SearchRepository;

/** Validates filters with the configured search engine before they can affect persona members. */
public final class PersonaContextRuleValidation {
  private PersonaContextRuleValidation() {}

  public static JsonNode query(String filter) {
    JsonNode query;
    try {
      JsonNode parsed = JsonUtils.readTree(filter);
      query =
          parsed != null && parsed.isObject() && parsed.has("query") ? parsed.get("query") : parsed;
    } catch (JsonParsingException exception) {
      throw new BadRequestException("Persona rule filter must be valid JSON", exception);
    }
    if (query == null || !query.isObject()) {
      throw new BadRequestException("Persona rule filter must contain a JSON query object");
    }
    return query;
  }

  public static void validate(ContextRule rule, SearchRepository repository) {
    if (!nullOrEmpty(rule.getQueryFilter())) {
      JsonNode query = query(rule.getQueryFilter());
      String body =
          JsonUtils.pojoToJson(
              Map.of("query", query.isEmpty() ? Map.of("match_all", Map.of()) : query));
      String index = repository.getIndexOrAliasName(rule.getEntityType());
      RawSearchResponse response = validateQuery(repository, index, body);
      if (response.statusCode() == 400) {
        throw invalidFilter(rule);
      }
      if (response.statusCode() != 200) {
        throw new ServiceUnavailableException(
            "Search is unavailable while validating persona rules");
      }
      ValidationResult result = JsonUtils.readValue(response.body(), ValidationResult.class);
      if (!Boolean.TRUE.equals(result.valid())) {
        throw invalidFilter(rule);
      }
    }
  }

  private static RawSearchResponse validateQuery(
      SearchRepository repository, String index, String body) {
    try {
      return repository
          .getSearchClient()
          .rawSearchRequest(
              "POST", "/" + index + "/_validate/query?explain=true&all_shards=true", body);
    } catch (IOException exception) {
      throw new ServiceUnavailableException(
          "Search is unavailable while validating persona rules",
          Response.status(Response.Status.SERVICE_UNAVAILABLE).build(),
          exception);
    }
  }

  private static BadRequestException invalidFilter(ContextRule rule) {
    return new BadRequestException(
        "Invalid filter for persona rule '"
            + rule.getName()
            + "'. Check its fields, operators and regular expressions.");
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record ValidationResult(Boolean valid) {}
}

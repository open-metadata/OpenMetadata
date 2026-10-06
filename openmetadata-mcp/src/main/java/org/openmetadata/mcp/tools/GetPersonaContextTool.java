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

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.PersonaContextAccess;
import org.openmetadata.service.aicontext.PersonaContextBuilder;
import org.openmetadata.service.aicontext.PersonaContextCache;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Returns one deterministic, line-bounded part of a persona's shared AI context document. */
public class GetPersonaContextTool implements McpTool {
  private static final int PART_RESPONSE_BUDGET = McpResponseTrim.MAX_RESPONSE_CHARS - 10_000;
  private static final String INSTRUCTIONS_KEY = "instructions";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    Persona persona = resolvePersona(securityContext, stringParam(params, "personaName"));
    PersonaContextAccess.authorize(securityContext, persona);
    PersonaContextBuilder.MaterializedPersonaContext materialized =
        PersonaContextCache.getInstance().get(persona, false).value();
    return page(materialized, stringParam(params, "format"), intParam(params.get("part"), 1));
  }

  /**
   * One part of the document. Part 1 also carries the persona's prompt under its own key: the
   * document is reference data, the prompt is how an admin wants this persona's users assisted.
   */
  static Map<String, Object> page(
      PersonaContextBuilder.MaterializedPersonaContext materialized, String format, int part) {
    boolean json = "json".equalsIgnoreCase(format);
    Map<String, Object> instructions = instructions(materialized.context());
    List<String> parts =
        split(
            json ? JsonUtils.pojoToJson(materialized.context()) : materialized.markdown(),
            instructions.isEmpty() ? 0 : McpResponseTrim.serializedLength(instructions));
    if (part < 1 || part > parts.size()) {
      return Map.of(
          McpResponseTrim.ERROR_KEY,
          "part must be between 1 and " + parts.size(),
          McpResponseTrim.STATUS_CODE_KEY,
          400);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("format", json ? "json" : "markdown");
    if (part == 1) {
      result.putAll(instructions);
    }
    result.put("content", parts.get(part - 1));
    result.put("part", part);
    result.put("totalParts", parts.size());
    result.put(McpResponseTrim.HAS_MORE_KEY, part < parts.size());
    result.put("fingerprint", materialized.context().getFingerprint());
    return result;
  }

  private static Map<String, Object> instructions(PersonaContext context) {
    return nullOrEmpty(context.getPrompt())
        ? Map.of()
        : Map.of(INSTRUCTIONS_KEY, context.getPrompt());
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException(
        "GetPersonaContextTool does not require limit validation.");
  }

  private static Persona resolvePersona(
      CatalogSecurityContext securityContext, String personaName) {
    return personaName == null || personaName.isBlank()
        ? PersonaContextAccess.activePersona(securityContext)
        : Entity.getEntityByName(
            Entity.PERSONA, personaName, "contextDefinition,users", Include.NON_DELETED);
  }

  static List<String> split(String content) {
    return split(content, 0);
  }

  /** {@code firstPartReserve} is what part 1 carries besides its content (the instructions). */
  static List<String> split(String content, int firstPartReserve) {
    List<String> parts = new ArrayList<>();
    if (content == null || content.isEmpty()) {
      return List.of("");
    }
    int start = 0;
    while (start < content.length()) {
      int budget = PART_RESPONSE_BUDGET - (parts.isEmpty() ? firstPartReserve : 0);
      int candidateEnd = largestSerializableEnd(content, start, budget);
      int end = candidateEnd;
      if (candidateEnd < content.length()) {
        int lineEnd = content.lastIndexOf('\n', candidateEnd);
        if (lineEnd > start) {
          end = lineEnd + 1;
        }
      }
      parts.add(content.substring(start, end));
      start = end;
    }
    return parts;
  }

  private static int largestSerializableEnd(String content, int start, int budget) {
    int low = start + 1;
    int high = content.length();
    int result = low;
    while (low <= high) {
      int midpoint = low + (high - low) / 2;
      int serializedLength =
          McpResponseTrim.serializedLength(Map.of("content", content.substring(start, midpoint)));
      if (serializedLength <= budget) {
        result = midpoint;
        low = midpoint + 1;
      } else {
        high = midpoint - 1;
      }
    }
    return result;
  }

  private static String stringParam(Map<String, Object> params, String key) {
    Object value = params.get(key);
    return value == null ? null : String.valueOf(value);
  }

  private static int intParam(Object value, int defaultValue) {
    if (value instanceof Number number) {
      return number.intValue();
    }
    if (value != null) {
      try {
        return Integer.parseInt(String.valueOf(value));
      } catch (NumberFormatException ignored) {
        return -1;
      }
    }
    return defaultValue;
  }
}

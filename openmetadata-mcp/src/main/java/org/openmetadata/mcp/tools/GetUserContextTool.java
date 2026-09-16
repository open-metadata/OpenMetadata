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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Returns the authenticated caller's platform context: identity, teams, roles (direct and
 * team-inherited), domains, persona, and lightweight summaries of owned and followed entities. The
 * user is resolved only from the request's {@link SubjectContext} (JWT / impersonation header) —
 * the tool takes no user-identifying parameter, so it can never read another user's context.
 */
@Slf4j
public class GetUserContextTool implements McpTool {
  private static final int DEFAULT_LIMIT = 20;
  private static final int MAX_LIMIT = 100;

  /** Narrows the owned-entity scan to assets worth surfacing (e.g. governance gaps). */
  public enum OwnedFilter {
    NONE,
    MISSING_DESCRIPTION,
    MISSING_TIER,
    ANY_GAP;

    static OwnedFilter fromValue(String value) {
      OwnedFilter parsed = NONE;
      if (value != null) {
        try {
          parsed = valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
          parsed = NONE;
        }
      }
      return parsed;
    }
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    SubjectContext subject = getSubjectContext(securityContext);
    User user = subject.user();
    List<String> warnings = new ArrayList<>();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("user", identity(user));
    result.put("teams", namedRefs(user.getTeams()));
    result.put("roles", namedRefs(user.getRoles()));
    result.put("inheritedRoles", namedRefs(user.getInheritedRoles()));
    result.put("domains", domainRefs(user.getDomains()));
    putIfPresent(result, "persona", personaRef(subject.getActivePersona()));
    attachSummaries(result, subject, user, params, warnings);
    if (!warnings.isEmpty()) {
      result.put("warnings", warnings);
    }
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "GetUserContextTool does not require limit validation.");
  }

  private void attachSummaries(
      Map<String, Object> result,
      SubjectContext subject,
      User user,
      Map<String, Object> params,
      List<String> warnings)
      throws IOException {
    if (boolParam(params, "includeOwnedSummary", true)) {
      result.put(
          "owned",
          UserContextSearch.ownedSummary(
              subject,
              ownerIds(user),
              intParam(params, "ownedLimit"),
              resolveOwnedFilter(params, warnings)));
    }
    if (boolParam(params, "includeFollowedSummary", true)) {
      result.put(
          "followed",
          UserContextSearch.followedSummary(
              subject, user.getId().toString(), intParam(params, "followedLimit")));
    }
  }

  /**
   * Parses {@code ownedFilter}, but unlike a silent default it records a warning when a non-blank
   * value is unrecognized — otherwise "MISSING_TIERS" would quietly fall back to NONE and the tool
   * would return every owned entity as if it were the gap subset, with no signal to the caller.
   */
  static OwnedFilter resolveOwnedFilter(Map<String, Object> params, List<String> warnings) {
    String raw = stringParam(params, "ownedFilter");
    OwnedFilter filter = OwnedFilter.fromValue(raw);
    if (raw != null
        && !raw.isBlank()
        && filter == OwnedFilter.NONE
        && !"NONE".equalsIgnoreCase(raw.trim())) {
      warnings.add(
          "Unrecognized ownedFilter '"
              + raw
              + "'; returned all owned entities without gap filtering. Valid values: NONE, "
              + "MISSING_DESCRIPTION, MISSING_TIER, ANY_GAP.");
      LOG.debug("Unrecognized ownedFilter '{}'; defaulting to NONE", raw);
    }
    return filter;
  }

  private static List<String> ownerIds(User user) {
    List<String> ids = new ArrayList<>();
    ids.add(user.getId().toString());
    for (EntityReference team : listOrEmpty(user.getTeams())) {
      ids.add(team.getId().toString());
    }
    return ids;
  }

  static Map<String, Object> identity(User user) {
    Map<String, Object> identity = new LinkedHashMap<>();
    identity.put("id", user.getId().toString());
    identity.put("name", user.getName());
    putIfPresent(identity, "displayName", user.getDisplayName());
    putIfPresent(identity, "email", user.getEmail());
    identity.put("isAdmin", Boolean.TRUE.equals(user.getIsAdmin()));
    identity.put("isBot", Boolean.TRUE.equals(user.getIsBot()));
    return identity;
  }

  static List<Map<String, Object>> namedRefs(List<EntityReference> refs) {
    List<Map<String, Object>> named = new ArrayList<>();
    for (EntityReference ref : listOrEmpty(refs)) {
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("id", ref.getId() == null ? null : ref.getId().toString());
      entry.put("name", ref.getName());
      putIfPresent(entry, "displayName", ref.getDisplayName());
      named.add(entry);
    }
    return named;
  }

  static List<Map<String, Object>> domainRefs(List<EntityReference> refs) {
    List<Map<String, Object>> domains = new ArrayList<>();
    for (EntityReference ref : listOrEmpty(refs)) {
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("name", ref.getName());
      entry.put(
          "fqn", ref.getFullyQualifiedName() == null ? ref.getName() : ref.getFullyQualifiedName());
      domains.add(entry);
    }
    return domains;
  }

  static Map<String, Object> personaRef(EntityReference persona) {
    Map<String, Object> ref = null;
    if (persona != null) {
      ref = new LinkedHashMap<>();
      ref.put("name", persona.getName());
      putIfPresent(ref, "displayName", persona.getDisplayName());
    }
    return ref;
  }

  private static void putIfPresent(Map<String, Object> target, String key, Object value) {
    if (value != null) {
      target.put(key, value);
    }
  }

  private static String stringParam(Map<String, Object> params, String key) {
    Object value = params.get(key);
    return value == null ? null : String.valueOf(value);
  }

  /**
   * Reads a boolean param, failing safe to {@code defaultValue} on any non-boolean input. Using
   * {@link Boolean#parseBoolean} here would coerce truthy-looking strings ("yes", "1") to
   * {@code false} and silently drop an entire summary section the caller asked for.
   */
  static boolean boolParam(Map<String, Object> params, String key, boolean defaultValue) {
    Object value = params.get(key);
    boolean parsed = defaultValue;
    if (value instanceof Boolean bool) {
      parsed = bool;
    } else if (value != null) {
      String text = String.valueOf(value).trim();
      if ("true".equalsIgnoreCase(text)) {
        parsed = true;
      } else if ("false".equalsIgnoreCase(text)) {
        parsed = false;
      }
    }
    return parsed;
  }

  private static int intParam(Map<String, Object> params, String key) {
    Object value = params.get(key);
    int parsed = DEFAULT_LIMIT;
    if (value instanceof Number number) {
      parsed = number.intValue();
    } else if (value != null) {
      try {
        parsed = Integer.parseInt(String.valueOf(value));
      } catch (NumberFormatException ignored) {
        parsed = DEFAULT_LIMIT;
      }
    }
    return Math.min(Math.max(parsed, 1), MAX_LIMIT);
  }
}

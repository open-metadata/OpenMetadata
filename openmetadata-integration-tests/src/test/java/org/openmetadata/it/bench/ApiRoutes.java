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

package org.openmetadata.it.bench;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Turns a concrete request into the route it exercises — {@code GET /v1/tables/name/svc.db.t1}
 * becomes {@code GET /v1/tables/name/{fqn}} — so latencies aggregate per API rather than per
 * entity.
 *
 * <p>The client never sees the server's Jersey templates, so this works from the URL alone: a
 * segment after {@code name} is an FQN, a UUID is an id, a dotted or numeric segment is an FQN or a
 * version. Query strings are dropped, except the few parameters that pick a genuinely different
 * code path — search's {@code index}, the scene's {@code band} and whether it is focused — because
 * averaging those together would hide exactly the latency the report exists to show.
 */
final class ApiRoutes {

  static final String API_PREFIX = "/api";

  private static final String NAME_SEGMENT = "name";
  private static final String FQN_PLACEHOLDER = "{fqn}";
  private static final String ID_PLACEHOLDER = "{id}";
  private static final String NUMBER_PLACEHOLDER = "{n}";
  private static final Pattern UUID =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  private static final Pattern NUMBER_OR_VERSION = Pattern.compile("\\d+(\\.\\d+)*");

  /** Parameters whose value selects a different code path, per normalized path. */
  private static final Map<String, List<String>> VALUE_DISCRIMINATORS =
      Map.of(
          "/v1/search/query", List.of("index"),
          "/v1/search/aggregate", List.of("index"),
          "/v1/lineage/scene", List.of("band"));

  /** Parameters whose mere presence selects a different code path. */
  private static final Map<String, Set<String>> PRESENCE_DISCRIMINATORS =
      Map.of("/v1/lineage/scene", Set.of("focusFqn"));

  private ApiRoutes() {}

  /**
   * @param method HTTP method
   * @param rawPath encoded URL path, with or without the {@code /api} prefix
   * @param rawQuery encoded query string, or {@code null}
   */
  static String routeOf(final String method, final String rawPath, final String rawQuery) {
    final String path = normalizePath(stripApiPrefix(rawPath));
    return method + " " + path + discriminators(path, rawQuery);
  }

  static boolean isApiPath(final String rawPath) {
    return rawPath != null && rawPath.startsWith(API_PREFIX + "/v1/");
  }

  private static String stripApiPrefix(final String rawPath) {
    return isApiPath(rawPath) ? rawPath.substring(API_PREFIX.length()) : rawPath;
  }

  private static String normalizePath(final String path) {
    final String[] segments = path.split("/", -1);
    for (int index = 1; index < segments.length; index++) {
      segments[index] = normalizeSegment(segments[index - 1], segments[index]);
    }
    return String.join("/", segments);
  }

  private static String normalizeSegment(final String previous, final String segment) {
    if (NAME_SEGMENT.equals(previous)) {
      return FQN_PLACEHOLDER;
    }
    if (UUID.matcher(segment).matches()) {
      return ID_PLACEHOLDER;
    }
    if (NUMBER_OR_VERSION.matcher(segment).matches()) {
      return NUMBER_PLACEHOLDER;
    }
    return looksLikeFqn(segment) ? FQN_PLACEHOLDER : segment;
  }

  /** A dotted or percent-encoded segment is a name, never a fixed part of an API path. */
  private static boolean looksLikeFqn(final String segment) {
    return segment.indexOf('.') >= 0 || segment.indexOf('%') >= 0;
  }

  private static String discriminators(final String path, final String rawQuery) {
    final List<String> parts = new ArrayList<>();
    final Map<String, String> params = parseQuery(rawQuery);
    for (final String name : VALUE_DISCRIMINATORS.getOrDefault(path, List.of())) {
      if (params.containsKey(name)) {
        parts.add(name + "=" + params.get(name));
      }
    }
    for (final String name : PRESENCE_DISCRIMINATORS.getOrDefault(path, Set.of())) {
      if (params.containsKey(name)) {
        parts.add(name);
      }
    }
    return parts.isEmpty() ? "" : "?" + String.join("&", parts);
  }

  private static Map<String, String> parseQuery(final String rawQuery) {
    if (rawQuery == null || rawQuery.isEmpty()) {
      return Map.of();
    }
    final Map<String, String> params = new LinkedHashMap<>();
    for (final String pair : rawQuery.split("&")) {
      final int separator = pair.indexOf('=');
      final String name = separator < 0 ? pair : pair.substring(0, separator);
      final String value = separator < 0 ? "" : pair.substring(separator + 1);
      params.putIfAbsent(decode(name), decode(value));
    }
    return params;
  }

  private static String decode(final String value) {
    return URLDecoder.decode(value, StandardCharsets.UTF_8);
  }
}

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

package org.openmetadata.service.jdbi3;

import java.util.Objects;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/** Typed descendant rewrite shared by ordinary DAO writes and transactional projection capture. */
public record FqnPrefixRewrite(String oldPrefix, String newPrefix, Scope scope) {
  public enum Scope {
    ENTITY,
    NESTED
  }

  private static final String HASH_ASSIGNMENT =
      ", fqnHash = CONCAT(:prefix.newHashPrefix, SUBSTRING(fqnHash, CHAR_LENGTH(:prefix.oldHashPrefix) + 1))";
  private static final String MYSQL_ASSIGNMENT =
      """
      UPDATE <table> SET json = CASE
        WHEN :prefix.nested THEN CAST(REPLACE(CAST(json AS CHAR), :prefix.oldJsonPrefix, :prefix.newJsonPrefix) AS JSON)
        WHEN LEFT(JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')), CHAR_LENGTH(:prefix.oldPrefixWithSeparator)) = CAST(:prefix.oldPrefixWithSeparator AS BINARY)
          THEN JSON_REPLACE(json, '$.fullyQualifiedName', CONCAT(:prefix.newPrefixWithSeparator,
            SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')), CHAR_LENGTH(:prefix.oldPrefixWithSeparator) + 1)))
        ELSE json END
      """
          + HASH_ASSIGNMENT;
  // Text replacement would also rewrite references to other entities that share the prefix, so
  // only NESTED scope uses it; ENTITY scope rewrites the row's own name, as on MySQL.
  private static final String POSTGRES_ASSIGNMENT =
      """
      UPDATE <table> SET json = CASE
        WHEN :prefix.nested THEN REPLACE(json::text, :prefix.oldJsonPrefix, :prefix.newJsonPrefix)::jsonb
        WHEN LEFT(json->>'fullyQualifiedName', CHAR_LENGTH(:prefix.oldPrefixWithSeparator)) = :prefix.oldPrefixWithSeparator
          THEN jsonb_set(json, '{fullyQualifiedName}', to_jsonb(:prefix.newPrefixWithSeparator
            || SUBSTRING(json->>'fullyQualifiedName', CHAR_LENGTH(:prefix.oldPrefixWithSeparator) + 1)))
        ELSE json END
      """
          + HASH_ASSIGNMENT;
  private static final String PREFIX_SELECTION = " WHERE fqnHash LIKE :prefix.pattern";
  public static final String MYSQL_UPDATE = MYSQL_ASSIGNMENT + PREFIX_SELECTION;
  public static final String POSTGRES_UPDATE = POSTGRES_ASSIGNMENT + PREFIX_SELECTION;

  public FqnPrefixRewrite {
    requirePrefix(oldPrefix);
    requirePrefix(newPrefix);
    Objects.requireNonNull(scope, "scope");
  }

  public boolean nested() {
    return scope == Scope.NESTED;
  }

  public String oldPrefixWithSeparator() {
    return oldPrefix + Entity.SEPARATOR;
  }

  public String newPrefixWithSeparator() {
    return newPrefix + Entity.SEPARATOR;
  }

  public String oldHashPrefix() {
    return FullyQualifiedName.buildHash(oldPrefix) + Entity.SEPARATOR;
  }

  public String newHashPrefix() {
    return FullyQualifiedName.buildHash(newPrefix) + Entity.SEPARATOR;
  }

  public String pattern() {
    return oldHashPrefix() + "%";
  }

  public String oldJsonPrefix() {
    return jsonPrefix(oldPrefixWithSeparator());
  }

  public String newJsonPrefix() {
    return jsonPrefix(newPrefixWithSeparator());
  }

  private static String jsonPrefix(final String prefix) {
    final String json = JsonUtils.pojoToJson(prefix);
    return "\"fullyQualifiedName\": " + json.substring(0, json.length() - 1);
  }

  private static void requirePrefix(final String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("FQN rewrite prefixes must not be blank");
    }
  }
}

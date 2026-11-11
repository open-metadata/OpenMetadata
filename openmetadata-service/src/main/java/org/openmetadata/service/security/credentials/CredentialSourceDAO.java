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

package org.openmetadata.service.security.credentials;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import org.jdbi.v3.sqlobject.config.RegisterConstructorMapper;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;

/**
 * The two statements behind {@link JdbiCredentialSource}. Each is a single SELECT, so it reads one
 * consistent snapshot that starts after the caller's stamp (MySQL REPEATABLE READ autocommit and
 * Postgres READ COMMITTED both take the snapshot at statement start). Reads go straight to the
 * tables, never through EntityRepository or its caches: a cached row would break the "reflects
 * every commit before the stamp" invariant.
 *
 * <p>Both statements return one row per (user, PAT row), or one row with null PAT columns for a
 * user with no PATs, so "user exists, no tokens" and "no such user" stay distinguishable. The full
 * read selects the same columns as the fingerprint read plus the JSON, and one Java function
 * fingerprints the rows of both, so the two reads cannot disagree.
 *
 * <p>Index use: {@code user_entity.nameHash}, then {@code idx_user_tokens_user_type (userId,
 * tokenType, token)}, which covers the join and the selected {@code t.token}.
 */
interface CredentialSourceDAO {

  String MECHANISM_MD5_MYSQL = "MD5(JSON_EXTRACT(u.json, '$.authenticationMechanism'))";
  String MECHANISM_MD5_POSTGRES = "md5((u.json -> 'authenticationMechanism')::text)";
  // The generated `deleted` column is NULL when the JSON omits the field.
  String DELETED_MYSQL = "COALESCE(u.deleted, 0)";
  String DELETED_POSTGRES = "COALESCE(u.deleted, FALSE)";
  String FROM_USER_AND_PATS =
      " FROM user_entity u LEFT JOIN user_tokens t"
          + " ON t.userId = u.id AND t.tokenType = 'PERSONAL_ACCESS_TOKEN'"
          + " WHERE u.nameHash IN (<nameHashes>)";
  String FULL_COLUMNS = ", u.json AS userJson, t.json AS tokenJson";

  @ConnectionAwareSqlQuery(
      value =
          "SELECT u.nameHash, u.id AS userId, "
              + DELETED_MYSQL
              + " AS deleted, u.updatedAt, "
              + MECHANISM_MD5_MYSQL
              + " AS mechanismMd5, t.token AS tokenId"
              + FROM_USER_AND_PATS,
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT u.nameHash, u.id AS userId, "
              + DELETED_POSTGRES
              + " AS deleted, u.updatedAt, "
              + MECHANISM_MD5_POSTGRES
              + " AS mechanismMd5, t.token AS tokenId"
              + FROM_USER_AND_PATS,
      connectionType = POSTGRES)
  @RegisterConstructorMapper(FingerprintRow.class)
  List<FingerprintRow> fingerprintRows(@BindList("nameHashes") List<String> nameHashes);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT u.nameHash, u.id AS userId, "
              + DELETED_MYSQL
              + " AS deleted, u.updatedAt, "
              + MECHANISM_MD5_MYSQL
              + " AS mechanismMd5, t.token AS tokenId"
              + FULL_COLUMNS
              + FROM_USER_AND_PATS,
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT u.nameHash, u.id AS userId, "
              + DELETED_POSTGRES
              + " AS deleted, u.updatedAt, "
              + MECHANISM_MD5_POSTGRES
              + " AS mechanismMd5, t.token AS tokenId"
              + FULL_COLUMNS
              + FROM_USER_AND_PATS,
      connectionType = POSTGRES)
  @RegisterConstructorMapper(FullRow.class)
  List<FullRow> fullRows(@BindList("nameHashes") List<String> nameHashes);

  /** The columns the fingerprint is a function of; both row records expose them. */
  interface FingerprintInputs {
    String nameHash();

    String userId();

    boolean deleted();

    long updatedAt();

    /** Null when the user has no authentication mechanism. */
    String mechanismMd5();

    /** Null when the user has no PAT rows. */
    String tokenId();
  }

  record FingerprintRow(
      String nameHash,
      String userId,
      boolean deleted,
      long updatedAt,
      String mechanismMd5,
      String tokenId)
      implements FingerprintInputs {}

  record FullRow(
      String nameHash,
      String userId,
      boolean deleted,
      long updatedAt,
      String mechanismMd5,
      String tokenId,
      String userJson,
      String tokenJson)
      implements FingerprintInputs {}
}

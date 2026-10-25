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

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.secrets.SecretsManagerFactory;

/** Reaches the package-private {@code JdbiCredentialSource} from integration tests. */
public final class CredentialSourceTestSupport {
  private CredentialSourceTestSupport() {}

  private static JdbiCredentialSource source(Jdbi jdbi) {
    return new JdbiCredentialSource(
        jdbi, SecretsManagerFactory::getSecretsManager, CredentialVerificationConfig.defaults());
  }

  /** The cheap read's fingerprint of {@code userName}; compare with equals. */
  public static Object fingerprint(Jdbi jdbi, String userName) {
    CredentialSubject subject = CredentialSubject.of(userName);
    return source(jdbi).fingerprints(Set.of(subject)).get(subject);
  }

  /** The full read's fingerprint of {@code userName}; compare with equals. */
  public static Object fullFingerprint(Jdbi jdbi, String userName) {
    return fullRecord(jdbi, userName, Map.of()).fingerprint();
  }

  /** The fingerprint that no existing user has. */
  public static Object absentFingerprint() {
    return SourceFingerprint.ABSENT;
  }

  /** Every token digest the full read holds for {@code userName}. */
  public static Set<TokenDigest> digests(Jdbi jdbi, String userName) {
    return fullRecord(jdbi, userName, Map.of()).digests();
  }

  /** The query plan of the fingerprint statement for {@code userName}, one line per plan row. */
  public static String explainFingerprintStatement(Jdbi jdbi, String userName) throws Exception {
    String sql = fingerprintSql(jdbi, userName);
    ConnectionType type = connectionType(jdbi);
    return jdbi.withHandle(handle -> explain(handle, sql, type));
  }

  private static CredentialRecord fullRecord(
      Jdbi jdbi, String userName, Map<CredentialSubject, CredentialRecord> previous) {
    CredentialSubject subject = CredentialSubject.of(userName);
    return source(jdbi).read(Set.of(subject), previous).get(subject);
  }

  private static String fingerprintSql(Jdbi jdbi, String userName) throws Exception {
    ConnectionType type = connectionType(jdbi);
    ConnectionAwareSqlQuery query = null;
    for (ConnectionAwareSqlQuery candidate :
        CredentialSourceDAO.class
            .getMethod("fingerprintRows", List.class)
            .getAnnotationsByType(ConnectionAwareSqlQuery.class)) {
      if (candidate.connectionType() == type) {
        query = candidate;
      }
    }
    String literal = "'" + CredentialSubject.of(userName).nameHash() + "'";
    return query.value().replace("<nameHashes>", literal);
  }

  private static ConnectionType connectionType(Jdbi jdbi) {
    String product =
        jdbi.withHandle(handle -> handle.createQuery("SELECT version()").mapTo(String.class).one());
    return product.toLowerCase(Locale.ROOT).contains("postgres")
        ? ConnectionType.POSTGRES
        : ConnectionType.MYSQL;
  }

  // Postgres prefers a sequential scan on the handful of rows a test database holds, which would
  // say nothing about the index; switching it off for the transaction shows whether one is usable.
  private static String explain(Handle handle, String sql, ConnectionType type) {
    handle.begin();
    try {
      if (type == ConnectionType.POSTGRES) {
        handle.execute("SET LOCAL enable_seqscan = off");
      }
      return handle.createQuery("EXPLAIN " + sql).mapToMap().list().stream()
          .map(Map::toString)
          .collect(Collectors.joining("\n"));
    } finally {
      handle.rollback();
    }
  }
}

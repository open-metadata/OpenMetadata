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

import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.service.Entity;

/** Serializes grant issuance and revocation across servers, on one database connection. */
public class McpGrantTransaction {
  private static final ThreadLocal<OAuthDAOs> CURRENT = new ThreadLocal<>();

  private final Supplier<CollectionDAO> collections;

  public McpGrantTransaction() {
    this(Entity::getCollectionDAO);
  }

  McpGrantTransaction(Supplier<CollectionDAO> collections) {
    this.collections = collections;
  }

  @FunctionalInterface
  public interface Operation<T, E extends Exception> {
    T get() throws E;
  }

  public <T, E extends Exception> T execute(String clientId, Operation<T, E> operation) throws E {
    return collections
        .get()
        .inTransaction(
            dao -> {
              if (dao.oauthClientDAO().lockClient(clientId) == null) {
                throw new IllegalArgumentException("MCP OAuth client no longer exists");
              }
              CURRENT.set(dao);
              try {
                return operation.get();
              } finally {
                CURRENT.remove();
              }
            });
  }

  public static <T> T resolve(Function<OAuthDAOs, T> accessor, T fallback) {
    final OAuthDAOs current = CURRENT.get();
    return current == null ? fallback : accessor.apply(current);
  }
}

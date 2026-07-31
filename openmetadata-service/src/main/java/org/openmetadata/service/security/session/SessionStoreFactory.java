/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.security.session;

import io.lettuce.core.api.sync.RedisCommands;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.cache.RedisCacheProvider;

/**
 * Picks the {@link SessionStore} implementation based on cache configuration. If the application
 * is wired with a {@link RedisCacheProvider} that's available at startup, sessions are stored in
 * Redis; otherwise we fall back to the JDBC-backed {@code user_session} table.
 *
 * <p>Selection is done once at boot time. We do <b>not</b> fail over live between Redis and JDBC
 * because that would split in-flight sessions across two stores and produce hard-to-debug auth
 * failures. If Redis goes down after start, all sessions stored there become unreadable until it
 * recovers — operators see the failures immediately rather than silently re-issuing sessions to
 * the DB.
 */
@Slf4j
public final class SessionStoreFactory {

  private SessionStoreFactory() {}

  public static SessionStore create() {
    CacheProvider provider = CacheBundle.getCacheProvider();
    CacheConfig config = CacheBundle.getCacheConfig();
    if (config != null && config.provider == CacheConfig.Provider.redis && config.redis != null) {
      if (provider instanceof RedisCacheProvider redisProvider && provider.available()) {
        RedisCommands<String, String> commands = redisProvider.getSyncCommands();
        if (commands != null) {
          LOG.info(
              "SessionStore backend: Redis (keyspace={})",
              config.redis.keyspace == null ? "om" : config.redis.keyspace);
          return new RedisSessionStore(commands, config.redis.keyspace);
        }
      }
      throw new IllegalStateException(
          "Redis cache is configured for this node, but Redis is not available. Refusing to "
              + "fall back to JDBC session storage because that would split sessions across "
              + "different backends in a multi-node deployment.");
    }
    LOG.info("SessionStore backend: JDBC (user_session table)");
    return new JdbcSessionStore();
  }
}

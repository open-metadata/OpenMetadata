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
package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.lettuce.core.api.sync.RedisCommands;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.cache.RedisCacheProvider;

class SessionStoreFactoryTest {

  @Test
  void explicitJdbcModeUsesJdbcEvenWhenRedisCacheIsConfigured() {
    final CacheConfig config = new CacheConfig();
    config.provider = CacheConfig.Provider.redis;
    config.sessionStore = CacheConfig.SessionStoreMode.jdbc;

    final SessionStore store = SessionStoreFactory.create(new NoopCacheProvider(), config);

    assertInstanceOf(JdbcSessionStore.class, store);
  }

  @Test
  void autoModeUsesJdbcWhenCacheProviderIsNone() {
    final CacheConfig config = new CacheConfig();
    config.provider = CacheConfig.Provider.none;
    config.sessionStore = CacheConfig.SessionStoreMode.auto;

    final SessionStore store = SessionStoreFactory.create(new NoopCacheProvider(), config);

    assertInstanceOf(JdbcSessionStore.class, store);
  }

  @Test
  void autoModeUsesRedisWhenRedisProviderIsAvailable() {
    final CacheConfig config = new CacheConfig();
    config.provider = CacheConfig.Provider.redis;
    config.sessionStore = CacheConfig.SessionStoreMode.auto;
    final RedisCacheProvider provider = mock(RedisCacheProvider.class);
    @SuppressWarnings("unchecked")
    final RedisCommands<String, String> commands = mock(RedisCommands.class);
    when(provider.available()).thenReturn(true);
    when(provider.getSyncCommands()).thenReturn(commands);

    final SessionStore store = SessionStoreFactory.create(provider, config);

    assertInstanceOf(RedisSessionStore.class, store);
  }

  @Test
  void explicitRedisModeFailsFastWhenRedisIsUnavailable() {
    final CacheConfig config = new CacheConfig();
    config.provider = CacheConfig.Provider.none;
    config.sessionStore = CacheConfig.SessionStoreMode.redis;

    assertThrows(
        IllegalStateException.class,
        () -> SessionStoreFactory.create(new NoopCacheProvider(), config));
  }
}

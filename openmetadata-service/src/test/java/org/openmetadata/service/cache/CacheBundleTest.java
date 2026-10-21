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

package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.dropwizard.core.setup.Environment;
import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.policyevaluator.SubjectCache;

/**
 * Per-JVM authorization caches exist whatever the cache provider is, so a policy, role or team
 * write has to reach them even when no Redis layer is configured.
 */
class CacheBundleTest {
  private static final String USER_NAME = "bundleUser";
  private static final AtomicInteger USER_VERSION = new AtomicInteger();

  @BeforeAll
  static void registerUserRepository() {
    UserRepository userRepository = mock(UserRepository.class);
    Entity.registerEntity(User.class, Entity.USER, userRepository);
    when(userRepository.getByName(
            isNull(), anyString(), isNull(), any(Include.class), anyBoolean()))
        .thenAnswer(
            invocation ->
                new User()
                    .withName(USER_NAME)
                    .withId(UUID.randomUUID())
                    .withDisplayName("v" + USER_VERSION.incrementAndGet()));
  }

  @BeforeEach
  void startClean() throws ReflectiveOperationException {
    clearInvalidatables();
    SubjectCache.invalidateAll();
  }

  @AfterEach
  void restoreGlobalState() throws ReflectiveOperationException {
    clearInvalidatables();
    SubjectCache.invalidateAll();
  }

  @Test
  void nullCacheConfigStillDropsStaleAuthorizationEntries() {
    runBundleWith(null);

    assertWriteDropsCachedUserContext();
  }

  @Test
  void providerNoneStillDropsStaleAuthorizationEntries() {
    CacheConfig config = new CacheConfig();
    config.provider = CacheConfig.Provider.none;

    runBundleWith(config);

    assertWriteDropsCachedUserContext();
  }

  @Test
  void runningTheBundleTwiceKeepsInvalidationWorking() {
    runBundleWith(null);
    runBundleWith(null);

    assertWriteDropsCachedUserContext();
  }

  @Test
  void withoutTheBundleAWriteLeavesTheCachedEntryInPlace() {
    User warm = SubjectCache.getUserContext(USER_NAME);

    CacheBundle.invalidateEntity(Entity.USER, UUID.randomUUID(), USER_NAME.toLowerCase());

    assertSame(warm, SubjectCache.getUserContext(USER_NAME));
  }

  private void assertWriteDropsCachedUserContext() {
    String before = SubjectCache.getUserContext(USER_NAME).getDisplayName();

    CacheBundle.invalidateEntity(Entity.USER, UUID.randomUUID(), USER_NAME.toLowerCase());

    String after = SubjectCache.getUserContext(USER_NAME).getDisplayName();
    assertNotEquals(before, after, "the write must have forced a reload of the user");
  }

  private static void runBundleWith(CacheConfig cacheConfig) {
    OpenMetadataApplicationConfig applicationConfig = mock(OpenMetadataApplicationConfig.class);
    when(applicationConfig.getCacheConfig()).thenReturn(cacheConfig);
    new CacheBundle().run(applicationConfig, mock(Environment.class));
  }

  @SuppressWarnings("unchecked")
  private static void clearInvalidatables() throws ReflectiveOperationException {
    Field registry = CacheBundle.class.getDeclaredField("INVALIDATABLES");
    registry.setAccessible(true);
    ((List<Invalidatable>) registry.get(null)).clear();
  }
}

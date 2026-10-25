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

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;

/**
 * Tells the other servers a credential changed, when Redis is configured: peers nudge their
 * verifier, and servers still on the previous release lose the cached token state they read on
 * every request. Both steps are best effort, because the write has already committed and every
 * server converges through its own sweep.
 */
@Slf4j
public final class CredentialChangeAnnouncer {
  // The previous release's key parts; it reads these on every request, so deleting them makes an
  // old server reload from the database. Kept for one release, then removed with this shim.
  private static final String LEGACY_BOT_KEY_PART = "bot";
  private static final String LEGACY_PAT_KEY_PART = "pat";

  private CredentialChangeAnnouncer() {}

  public static void announce(String userName) {
    String principal = CredentialSubject.of(userName).principal();
    publishNudge(principal);
    evictLegacyState(userName, principal);
  }

  private static void publishNudge(String principal) {
    try {
      CacheInvalidationPubSub pubSub = CacheBundle.getCacheInvalidationPubSub();
      if (pubSub != null) {
        pubSub.publish(CacheInvalidationPubSub.TYPE_CREDENTIAL, null, principal, null);
      }
    } catch (RuntimeException failure) {
      LOG.warn("Could not publish the credential change of {}", principal, failure);
    }
  }

  private static void evictLegacyState(String userName, String principal) {
    CacheConfig config = CacheBundle.getCacheConfig();
    if (config == null || config.provider != CacheConfig.Provider.redis || config.redis == null) {
      return;
    }
    try {
      CacheKeys keys = new CacheKeys(config.redis.keyspace);
      CacheProvider provider = CacheBundle.getCacheProvider();
      if (provider.available()) {
        provider.del(legacyKeys(keys, userName, principal));
      }
    } catch (RuntimeException failure) {
      LOG.warn("Could not evict the legacy credential state of {}", principal, failure);
    }
  }

  private static String[] legacyKeys(CacheKeys keys, String userName, String principal) {
    Set<String> names = new LinkedHashSet<>();
    names.add(userName);
    names.add(principal);
    return names.stream()
        .flatMap(
            name ->
                Stream.of(
                    keys.credentialState(LEGACY_BOT_KEY_PART, name),
                    keys.credentialState(LEGACY_PAT_KEY_PART, name)))
        .toArray(String[]::new);
  }
}

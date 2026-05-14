/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */

package org.openmetadata.service.cache;

import io.lettuce.core.RedisURI;
import java.time.Duration;

/**
 * Builds {@link RedisURI} instances from {@link CacheConfig.Redis}. Shared by {@code
 * RedisCacheProvider} (main data connection) and {@code CacheInvalidationPubSub} (pub/sub
 * connection) so both interpret the same config the same way.
 *
 * <p>Accepts URL forms: {@code redis://…}/{@code rediss://…}, {@code host:port}, or bare {@code
 * host}. Adds password/SSL/database selection from config.
 */
final class RedisURIFactory {
  private RedisURIFactory() {}

  static RedisURI build(CacheConfig.Redis redis) {
    String url = redis.url;
    Duration connectTimeout = Duration.ofMillis(redis.connectTimeoutMs);
    RedisURI.Builder builder;
    if (url.startsWith("redis://") || url.startsWith("rediss://")) {
      RedisURI parsed = RedisURI.create(url);
      // Carry the scheme's SSL flag forward — rediss:// must keep TLS even if useSSL is unset.
      builder =
          RedisURI.Builder.redis(parsed.getHost(), parsed.getPort())
              .withTimeout(connectTimeout)
              .withSsl(parsed.isSsl());
    } else {
      // Normalize bare "host" / "host:port" / "[ipv6]:port" through RedisURI.create so Lettuce
      // handles IPv6 bracketing and validation. split(":") on a raw string breaks on IPv6 (e.g.
      // "fe80::1:6379") and throws on malformed input.
      RedisURI parsed = RedisURI.create("redis://" + url);
      if (parsed.getHost() == null || parsed.getHost().isEmpty()) {
        throw new IllegalArgumentException("Invalid Redis URL: " + url);
      }
      builder =
          RedisURI.Builder.redis(parsed.getHost(), parsed.getPort()).withTimeout(connectTimeout);
    }

    if (redis.authType == CacheConfig.AuthType.PASSWORD && redis.passwordRef != null) {
      if (redis.username != null) {
        builder.withAuthentication(redis.username, redis.passwordRef);
      } else {
        builder.withPassword(redis.passwordRef.toCharArray());
      }
    }
    if (redis.useSSL) {
      builder.withSsl(true);
    }
    builder.withDatabase(redis.database);
    return builder.build();
  }
}

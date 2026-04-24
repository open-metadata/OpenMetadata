package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.pubsub.RedisPubSubAdapter;
import io.lettuce.core.pubsub.RedisPubSubListener;
import io.lettuce.core.pubsub.StatefulRedisPubSubConnection;
import io.lettuce.core.pubsub.api.sync.RedisPubSubCommands;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.service.cache.CacheConfig;

class RedisJobNotifierTest {

  @Test
  void startInitializesRedisConnectionsAndStopCleansThemUp() {
    CacheConfig config = cacheConfig("redis://cache:6380");
    RedisJobNotifier notifier = new RedisJobNotifier(config, "server-123");
    RedisClient redisClient = mock(RedisClient.class);
    StatefulRedisPubSubConnection<String, String> subConnection =
        mock(StatefulRedisPubSubConnection.class);
    StatefulRedisConnection<String, String> pubConnection = mock(StatefulRedisConnection.class);
    RedisPubSubCommands<String, String> pubSubCommands = mock(RedisPubSubCommands.class);
    RedisCommands<String, String> redisCommands = mock(RedisCommands.class);
    when(redisClient.connectPubSub()).thenReturn(subConnection);
    when(redisClient.connect()).thenReturn(pubConnection);
    when(subConnection.sync()).thenReturn(pubSubCommands);
    when(pubConnection.sync()).thenReturn(redisCommands);

    try (MockedStatic<RedisClient> redisClientStatic = Mockito.mockStatic(RedisClient.class)) {
      redisClientStatic.when(() -> RedisClient.create(any(RedisURI.class))).thenReturn(redisClient);

      notifier.start();
      notifier.start();

      assertTrue(notifier.isRunning());
      verify(subConnection)
          .addListener(org.mockito.ArgumentMatchers.<RedisPubSubListener<String, String>>any());
      verify(pubSubCommands).subscribe("om:distributed-jobs:start", "om:distributed-jobs:complete");

      notifier.stop();

      assertFalse(notifier.isRunning());
      verify(pubSubCommands)
          .unsubscribe("om:distributed-jobs:start", "om:distributed-jobs:complete");
      verify(subConnection).close();
      verify(pubConnection).close();
      verify(redisClient).shutdown();
    }
  }

  @Test
  void startRegistersListenerThatHandlesRemoteMessages() {
    CacheConfig config = cacheConfig("redis://cache:6380");
    RedisJobNotifier notifier = new RedisJobNotifier(config, "server-123");
    RedisClient redisClient = mock(RedisClient.class);
    StatefulRedisPubSubConnection<String, String> subConnection =
        mock(StatefulRedisPubSubConnection.class);
    StatefulRedisConnection<String, String> pubConnection = mock(StatefulRedisConnection.class);
    RedisPubSubCommands<String, String> pubSubCommands = mock(RedisPubSubCommands.class);
    when(redisClient.connectPubSub()).thenReturn(subConnection);
    when(redisClient.connect()).thenReturn(pubConnection);
    when(subConnection.sync()).thenReturn(pubSubCommands);

    try (MockedStatic<RedisClient> redisClientStatic = Mockito.mockStatic(RedisClient.class)) {
      redisClientStatic.when(() -> RedisClient.create(any(RedisURI.class))).thenReturn(redisClient);

      notifier.start();
      AtomicReference<UUID> callbackJob = new AtomicReference<>();
      notifier.onJobStarted(callbackJob::set);

      @SuppressWarnings("unchecked")
      ArgumentCaptor<RedisPubSubAdapter<String, String>> listenerCaptor =
          ArgumentCaptor.forClass(RedisPubSubAdapter.class);
      verify(subConnection).addListener(listenerCaptor.capture());

      UUID jobId = UUID.randomUUID();
      listenerCaptor.getValue().message("om:distributed-jobs:start", jobId + "|SEARCH_INDEX|other");

      assertEquals(jobId, callbackJob.get());
    }
  }

  @Test
  void startFailureResetsRunningState() {
    RedisJobNotifier notifier =
        new RedisJobNotifier(cacheConfig("redis://cache:6379"), "server-123");

    try (MockedStatic<RedisClient> redisClientStatic = Mockito.mockStatic(RedisClient.class)) {
      redisClientStatic
          .when(() -> RedisClient.create(any(RedisURI.class)))
          .thenThrow(new IllegalStateException("redis down"));

      assertThrows(RuntimeException.class, notifier::start);
      assertFalse(notifier.isRunning());
    }
  }

  @Test
  void stopReturnsWhenNotifierWasNeverStarted() {
    RedisJobNotifier notifier =
        new RedisJobNotifier(cacheConfig("redis://cache:6379"), "server-123");

    notifier.stop();

    assertFalse(notifier.isRunning());
  }

  @Test
  void stopSwallowsShutdownExceptions() throws Exception {
    RedisJobNotifier notifier =
        new RedisJobNotifier(cacheConfig("redis://cache:6379"), "server-123");
    StatefulRedisPubSubConnection<String, String> subConnection =
        mock(StatefulRedisPubSubConnection.class);
    RedisPubSubCommands<String, String> pubSubCommands = mock(RedisPubSubCommands.class);
    when(subConnection.sync()).thenReturn(pubSubCommands);
    Mockito.doThrow(new IllegalStateException("unsubscribe failed"))
        .when(pubSubCommands)
        .unsubscribe("om:distributed-jobs:start", "om:distributed-jobs:complete");
    getRunningFlag(notifier).set(true);
    setField(notifier, "subConnection", subConnection);
    setField(notifier, "pubConnection", mock(StatefulRedisConnection.class));
    setField(notifier, "redisClient", mock(RedisClient.class));

    notifier.stop();

    assertFalse(notifier.isRunning());
  }

  @Test
  void notifyMethodsAndInboundMessagesRespectSourceServer() throws Exception {
    RedisJobNotifier notifier = new RedisJobNotifier(cacheConfig("cache:6379"), "server-123");
    StatefulRedisConnection<String, String> pubConnection = mock(StatefulRedisConnection.class);
    RedisCommands<String, String> redisCommands = mock(RedisCommands.class);
    when(pubConnection.sync()).thenReturn(redisCommands);
    when(redisCommands.publish(any(), any())).thenReturn(2L);
    getRunningFlag(notifier).set(true);
    setField(notifier, "pubConnection", pubConnection);

    UUID jobId = UUID.randomUUID();
    notifier.notifyJobStarted(jobId, "SEARCH_INDEX");
    notifier.notifyJobCompleted(jobId);

    verify(redisCommands).publish("om:distributed-jobs:start", jobId + "|SEARCH_INDEX|server-123");
    verify(redisCommands).publish("om:distributed-jobs:complete", jobId + "|COMPLETED|server-123");

    AtomicReference<UUID> callbackJob = new AtomicReference<>();
    notifier.onJobStarted(callbackJob::set);
    invokeHandleMessage(
        notifier, "om:distributed-jobs:start", jobId + "|SEARCH_INDEX|other-server");
    assertEquals(jobId, callbackJob.get());

    callbackJob.set(null);
    invokeHandleMessage(notifier, "om:distributed-jobs:start", jobId + "|SEARCH_INDEX|server-123");
    assertNull(callbackJob.get());

    invokeHandleMessage(notifier, "om:distributed-jobs:start", "invalid");
    invokeHandleMessage(notifier, "om:distributed-jobs:start", "not-a-uuid|SEARCH_INDEX|other");
    invokeHandleMessage(
        notifier, "om:distributed-jobs:complete", jobId + "|COMPLETED|other-server");
  }

  @Test
  void notifyMethodsSwallowPublishFailures() throws Exception {
    RedisJobNotifier notifier = new RedisJobNotifier(cacheConfig("cache:6379"), "server-123");
    StatefulRedisConnection<String, String> pubConnection = mock(StatefulRedisConnection.class);
    RedisCommands<String, String> redisCommands = mock(RedisCommands.class);
    when(pubConnection.sync()).thenReturn(redisCommands);
    when(redisCommands.publish(eq("om:distributed-jobs:start"), any()))
        .thenThrow(new IllegalStateException("publish failed"));
    when(redisCommands.publish(eq("om:distributed-jobs:complete"), any()))
        .thenThrow(new IllegalStateException("publish failed"));
    getRunningFlag(notifier).set(true);
    setField(notifier, "pubConnection", pubConnection);

    notifier.notifyJobStarted(UUID.randomUUID(), "SEARCH_INDEX");
    notifier.notifyJobCompleted(UUID.randomUUID());
  }

  @Test
  void notifyMethodsSkipWhenNotRunningOrWithoutPublisher() {
    RedisJobNotifier notifier = new RedisJobNotifier(cacheConfig("cache:6379"), "server-123");
    StatefulRedisConnection<String, String> pubConnection = mock(StatefulRedisConnection.class);

    notifier.notifyJobStarted(UUID.randomUUID(), "SEARCH_INDEX");
    notifier.notifyJobCompleted(UUID.randomUUID());
    verify(pubConnection, never()).sync();
  }

  @Test
  void buildRedisUriSupportsUrlVariantsAndAuthentication() throws Exception {
    CacheConfig config = cacheConfig("redis://cache.example.com:6380");
    config.redis.authType = CacheConfig.AuthType.PASSWORD;
    config.redis.username = "user";
    config.redis.passwordRef = "secret";
    config.redis.useSSL = true;
    config.redis.database = 4;
    config.redis.connectTimeoutMs = 1234;

    RedisJobNotifier notifier = new RedisJobNotifier(config, "server-123");
    RedisURI uri = (RedisURI) invokePrivate(notifier, "buildRedisURI");

    assertEquals("cache.example.com", uri.getHost());
    assertEquals(6380, uri.getPort());
    assertTrue(uri.isSsl());
    assertEquals(4, uri.getDatabase());
    assertEquals(Duration.ofMillis(1234), uri.getTimeout());
    assertEquals("user", uri.getUsername());

    CacheConfig hostOnlyConfig = cacheConfig("redis-host");
    RedisURI hostOnlyUri =
        (RedisURI)
            invokePrivate(new RedisJobNotifier(hostOnlyConfig, "server-123"), "buildRedisURI");
    assertEquals("redis-host", hostOnlyUri.getHost());
    assertEquals(6379, hostOnlyUri.getPort());

    CacheConfig hostPortConfig = cacheConfig("cache.example.com:6381");
    RedisURI hostPortUri =
        (RedisURI)
            invokePrivate(new RedisJobNotifier(hostPortConfig, "server-123"), "buildRedisURI");
    assertEquals("cache.example.com", hostPortUri.getHost());
    assertEquals(6381, hostPortUri.getPort());

    CacheConfig passwordOnlyConfig = cacheConfig("cache.example.com:6382");
    passwordOnlyConfig.redis.authType = CacheConfig.AuthType.PASSWORD;
    passwordOnlyConfig.redis.passwordRef = "secret";
    RedisURI passwordOnlyUri =
        (RedisURI)
            invokePrivate(new RedisJobNotifier(passwordOnlyConfig, "server-123"), "buildRedisURI");
    assertEquals("cache.example.com", passwordOnlyUri.getHost());
    assertEquals(6382, passwordOnlyUri.getPort());
  }

  @Test
  void exposedTypeMatchesRedisImplementation() {
    RedisJobNotifier notifier = new RedisJobNotifier(cacheConfig("cache:6379"), "server-123");

    assertEquals("redis-pubsub", notifier.getType());
  }

  private void invokeHandleMessage(RedisJobNotifier notifier, String channel, String message)
      throws Exception {
    Method method =
        notifier.getClass().getDeclaredMethod("handleMessage", String.class, String.class);
    method.setAccessible(true);
    method.invoke(notifier, channel, message);
  }

  private Object invokePrivate(RedisJobNotifier notifier, String methodName) throws Exception {
    Method method = notifier.getClass().getDeclaredMethod(methodName);
    method.setAccessible(true);
    return method.invoke(notifier);
  }

  private AtomicBoolean getRunningFlag(RedisJobNotifier notifier) throws Exception {
    return (AtomicBoolean) getField(notifier, "running");
  }

  private Object getField(Object target, String name) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return field.get(target);
  }

  private void setField(Object target, String name, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }

  private CacheConfig cacheConfig(String url) {
    CacheConfig cacheConfig = new CacheConfig();
    cacheConfig.redis.url = url;
    cacheConfig.redis.authType = CacheConfig.AuthType.NONE;
    cacheConfig.redis.connectTimeoutMs = 2_000;
    return cacheConfig;
  }
}

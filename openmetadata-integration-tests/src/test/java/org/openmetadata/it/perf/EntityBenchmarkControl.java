package org.openmetadata.it.perf;

import com.google.common.cache.Cache;
import com.sun.management.ThreadMXBean;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.reflect.Field;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.testcontainers.containers.GenericContainer;

/** Local benchmark controls run outside measured API requests and never enter the application. */
public final class EntityBenchmarkControl implements AutoCloseable {
  public record Endpoint(URI uri, String token) {}

  record Heap(
      long used,
      long committed,
      long max,
      long collections,
      long collectionMillis,
      long allocatedBytes) {}

  private final HttpServer server;
  private final ThreadPoolExecutor executor;
  private final Endpoint endpoint;

  private static EntityBenchmarkSqlProbe sqlProbe;

  private EntityBenchmarkControl() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 1);
    executor = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(1));
    endpoint =
        new Endpoint(
            URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
            UUID.randomUUID().toString());
    server.setExecutor(executor);
    server.createContext("/", this::handle);
    server.start();
  }

  public static void main(String[] args) throws Exception {
    if (args.length != 1)
      throw new IllegalArgumentException("Expected the benchmark manifest path");
    try (var control = new EntityBenchmarkControl()) {
      control.writeEndpoint(Path.of(args[0] + ".control.json"));
      Runtime.getRuntime().addShutdownHook(new Thread(control::close));
      EntityBenchmarkServer.main(args);
    }
  }

  private void writeEndpoint(Path path) throws IOException {
    Files.createDirectories(path.toAbsolutePath().getParent());
    Files.createFile(
        path, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
    Files.writeString(path, JsonUtils.pojoToJson(endpoint));
  }

  private void handle(HttpExchange exchange) throws IOException {
    try (exchange) {
      if (!authorized(exchange)) {
        reply(exchange, 403, "Forbidden");
      } else {
        handleCommand(exchange);
      }
    }
  }

  private boolean authorized(HttpExchange exchange) {
    return "POST".equals(exchange.getRequestMethod())
        && ("Bearer " + endpoint.token())
            .equals(exchange.getRequestHeaders().getFirst("Authorization"));
  }

  private void handleCommand(HttpExchange exchange) throws IOException {
    try {
      String response = execute(exchange.getRequestURI().getPath());
      reply(exchange, 200, response);
    } catch (ReflectiveOperationException | RuntimeException exception) {
      System.getLogger(EntityBenchmarkControl.class.getName())
          .log(System.Logger.Level.ERROR, "Benchmark control failed", exception);
      reply(exchange, 500, exception.getClass().getSimpleName());
    }
  }

  private static String execute(String command) throws ReflectiveOperationException {
    return switch (command) {
      case "/cold" -> {
        clearRedis();
        clearLocal();
        yield "ok";
      }
      case "/l1-cold" -> {
        clearLocal();
        yield "ok";
      }
      case "/redis-pause" -> {
        redis().getDockerClient().pauseContainerCmd(redis().getContainerId()).exec();
        yield "ok";
      }
      case "/redis-resume" -> {
        redis().getDockerClient().unpauseContainerCmd(redis().getContainerId()).exec();
        yield "ok";
      }
      case "/heap" -> JsonUtils.pojoToJson(heap());
      case "/sql-start" -> startSqlProbe();
      case "/sql-stop" -> stopSqlProbe();
      default -> throw new IllegalArgumentException("Unknown benchmark command");
    };
  }

  private static String startSqlProbe() {
    if (sqlProbe != null)
      throw new IllegalStateException("SQL diagnostic window is already active");
    sqlProbe = new EntityBenchmarkSqlProbe(Entity.getJdbi());
    return "ok";
  }

  private static String stopSqlProbe() {
    if (sqlProbe == null) throw new IllegalStateException("No SQL diagnostic window is active");
    sqlProbe.close();
    final String result = JsonUtils.pojoToJson(sqlProbe.counts());
    sqlProbe = null;
    return result;
  }

  private static void clearRedis() {
    if (TestSuiteBootstrap.isRedisEnabled()) {
      final String keyspace = CacheBundle.getCacheConfig().redis.keyspace;
      if (!keyspace.startsWith("om:it:"))
        throw new IllegalStateException("Expected an isolated test keyspace");
      if (!CacheBundle.getCacheProvider().available())
        throw new IllegalStateException("Redis is unavailable");
      CacheBundle.getCacheProvider().scanDelete(keyspace + ":*");
    }
  }

  private static void clearLocal() throws ReflectiveOperationException {
    try {
      final Class<?> caches = Class.forName("org.openmetadata.service.entity.cache.EntityCaches");
      ((Cache<?, ?>) caches.getMethod("byId").invoke(null)).invalidateAll();
      ((Cache<?, ?>) caches.getMethod("byName").invoke(null)).invalidateAll();
      cacheField("org.openmetadata.service.entity.history.EntityHistoryQuery", "COUNTS")
          .invalidateAll();
    } catch (ClassNotFoundException absentOnBaseline) {
      final String legacy = "org.openmetadata.service.jdbi3.EntityRepository";
      cacheField(legacy, "CACHE_WITH_ID").invalidateAll();
      cacheField(legacy, "CACHE_WITH_NAME").invalidateAll();
      cacheField(legacy, "COUNT_CACHE").invalidateAll();
    }
  }

  private static Cache<?, ?> cacheField(String owner, String name)
      throws ReflectiveOperationException {
    return (Cache<?, ?>) staticField(owner, name);
  }

  private static Object staticField(String owner, String name) throws ReflectiveOperationException {
    final Field field = Class.forName(owner).getDeclaredField(name);
    field.setAccessible(true);
    return field.get(null);
  }

  private static GenericContainer<?> redis() throws ReflectiveOperationException {
    final var container =
        (GenericContainer<?>) staticField(TestSuiteBootstrap.class.getName(), "REDIS_CONTAINER");
    if (container == null || !container.isRunning())
      throw new IllegalStateException("No running benchmark Redis container");
    return container;
  }

  private static Heap heap() {
    final var usage = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
    long collections = 0;
    long millis = 0;
    for (final var collector : ManagementFactory.getGarbageCollectorMXBeans()) {
      collections += collector.getCollectionCount();
      millis += collector.getCollectionTime();
    }
    final var threads = ManagementFactory.getThreadMXBean();
    final long allocated =
        threads instanceof ThreadMXBean bean && bean.isThreadAllocatedMemoryEnabled()
            ? bean.getTotalThreadAllocatedBytes()
            : -1;
    return new Heap(
        usage.getUsed(), usage.getCommitted(), usage.getMax(), collections, millis, allocated);
  }

  private static void reply(HttpExchange exchange, int status, String text) throws IOException {
    final byte[] body = text.getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(status, body.length);
    exchange.getResponseBody().write(body);
  }

  @Override
  public void close() {
    server.stop(0);
    executor.shutdownNow();
  }
}

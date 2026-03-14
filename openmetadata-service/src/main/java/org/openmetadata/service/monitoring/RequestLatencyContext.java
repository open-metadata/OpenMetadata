package org.openmetadata.service.monitoring;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Thread-local context for tracking request latencies using Micrometer.
 *
 * <p>This context can be shared across multiple worker threads using {@link #setContext} or {@link
 * #wrapWithContext} for operations like bulk processing. Database, search, auth, and RDF time
 * tracking uses atomic operations and aggregates correctly across threads.
 */
@Slf4j(topic = "org.openmetadata.slowrequest")
public class RequestLatencyContext {

  private static final String ENDPOINT = "endpoint";
  private static final String METHOD = "method";
  private static final String SLOW_REQUEST_THRESHOLD_PROPERTY = "requestLatencyThresholdMs";
  private static final long DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1000L;
  private static final ThreadLocal<RequestContext> requestContext = new ThreadLocal<>();
  private static final ThreadLocal<Deque<ActivePhase>> phaseStack =
      ThreadLocal.withInitial(ArrayDeque::new);

  private static final ConcurrentHashMap<String, Timer> requestTimers = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Timer> databaseTimers = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Timer> searchTimers = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Timer> authTimers = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Timer> rdfTimers = new ConcurrentHashMap<>();
  private static final ConcurrentHashMap<String, Timer> serverTimers = new ConcurrentHashMap<>();

  private static final io.micrometer.core.instrument.MeterRegistry NOOP_REGISTRY =
      new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
  private static final Timer DUMMY_TIMER =
      Timer.builder("internal.sample.stop").register(NOOP_REGISTRY);
  private static final long slowRequestThresholdNanos = resolveSlowRequestThresholdNanos();

  private static long resolveSlowRequestThresholdNanos() {
    String configuredThreshold = System.getProperty(SLOW_REQUEST_THRESHOLD_PROPERTY);
    if (configuredThreshold == null || configuredThreshold.isBlank()) {
      return DEFAULT_SLOW_REQUEST_THRESHOLD_MS * 1_000_000L;
    }

    try {
      long thresholdMs = Long.parseLong(configuredThreshold.trim());
      if (thresholdMs < 0) {
        LOG.warn(
            "Ignoring negative request latency threshold '{}={}', using default {}ms",
            SLOW_REQUEST_THRESHOLD_PROPERTY,
            configuredThreshold,
            DEFAULT_SLOW_REQUEST_THRESHOLD_MS);
        return DEFAULT_SLOW_REQUEST_THRESHOLD_MS * 1_000_000L;
      }
      return thresholdMs * 1_000_000L;
    } catch (NumberFormatException ex) {
      LOG.warn(
          "Invalid request latency threshold '{}={}', using default {}ms",
          SLOW_REQUEST_THRESHOLD_PROPERTY,
          configuredThreshold,
          DEFAULT_SLOW_REQUEST_THRESHOLD_MS);
      return DEFAULT_SLOW_REQUEST_THRESHOLD_MS * 1_000_000L;
    }
  }

  public static void startRequest(String endpoint, String method, String uriPath) {
    String normalizedMethod = method.toUpperCase();
    RequestContext context = new RequestContext(endpoint, normalizedMethod, uriPath);
    requestContext.set(context);
    String timerKey = endpoint + "|" + normalizedMethod;
    requestTimers.computeIfAbsent(
        timerKey,
        k ->
            Timer.builder("request.latency.total")
                .tag(ENDPOINT, endpoint)
                .tag(METHOD, normalizedMethod)
                .description("Total request latency")
                .serviceLevelObjectives(
                    Duration.ofMillis(100),
                    Duration.ofMillis(500),
                    Duration.ofSeconds(1),
                    Duration.ofSeconds(5),
                    Duration.ofSeconds(10))
                .register(Metrics.globalRegistry));
    context.requestTimerSample = Timer.start(Metrics.globalRegistry);
    context.internalTimerStartNanos.set(System.nanoTime());
  }

  public static void startRequest(String endpoint, String method) {
    startRequest(endpoint, method, null);
  }

  public static Timer.Sample startDatabaseOperation() {
    RequestContext context = requestContext.get();
    if (context == null) {
      return null;
    }
    long internalStart = context.internalTimerStartNanos.getAndSet(0);
    if (internalStart > 0) {
      context.serverTime.addAndGet(System.nanoTime() - internalStart);
    }
    context.dbOperationCount.incrementAndGet();
    return Timer.start(Metrics.globalRegistry);
  }

  public static void endDatabaseOperation(Timer.Sample timerSample) {
    if (timerSample == null) return;
    RequestContext context = requestContext.get();
    if (context == null) return;
    long duration = timerSample.stop(DUMMY_TIMER);
    context.dbTime.addAndGet(duration);
    context.internalTimerStartNanos.set(System.nanoTime());
  }

  public static Timer.Sample startSearchOperation() {
    RequestContext context = requestContext.get();
    if (context == null) {
      return null;
    }
    long internalStart = context.internalTimerStartNanos.getAndSet(0);
    if (internalStart > 0) {
      context.serverTime.addAndGet(System.nanoTime() - internalStart);
    }
    context.searchOperationCount.incrementAndGet();
    return Timer.start(Metrics.globalRegistry);
  }

  public static void endSearchOperation(Timer.Sample timerSample) {
    if (timerSample == null) return;
    RequestContext context = requestContext.get();
    if (context == null) return;
    long duration = timerSample.stop(DUMMY_TIMER);
    context.searchTime.addAndGet(duration);
    context.internalTimerStartNanos.set(System.nanoTime());
  }

  public static Timer.Sample startAuthOperation() {
    RequestContext context = requestContext.get();
    if (context == null) {
      return null;
    }
    long internalStart = context.internalTimerStartNanos.getAndSet(0);
    if (internalStart > 0) {
      context.serverTime.addAndGet(System.nanoTime() - internalStart);
    }
    context.authOperationCount.incrementAndGet();
    return Timer.start(Metrics.globalRegistry);
  }

  public static void endAuthOperation(Timer.Sample timerSample) {
    if (timerSample == null) return;
    RequestContext context = requestContext.get();
    if (context == null) return;
    long duration = timerSample.stop(DUMMY_TIMER);
    context.authTime.addAndGet(duration);
    context.internalTimerStartNanos.set(System.nanoTime());
  }

  public static Timer.Sample startRdfOperation() {
    RequestContext context = requestContext.get();
    if (context == null) {
      return null;
    }
    long internalStart = context.internalTimerStartNanos.getAndSet(0);
    if (internalStart > 0) {
      context.serverTime.addAndGet(System.nanoTime() - internalStart);
    }
    context.rdfOperationCount.incrementAndGet();
    return Timer.start(Metrics.globalRegistry);
  }

  public static void endRdfOperation(Timer.Sample timerSample) {
    if (timerSample == null) return;
    RequestContext context = requestContext.get();
    if (context == null) return;
    long duration = timerSample.stop(DUMMY_TIMER);
    context.rdfTime.addAndGet(duration);
    context.internalTimerStartNanos.set(System.nanoTime());
  }

  public static void trackJsonDeserialize(int jsonLength) {
    RequestContext context = requestContext.get();
    if (context == null) return;
    context.jsonBytesDeserialized.addAndGet(jsonLength);
    context.jsonDeserializeCount.incrementAndGet();
  }

  public static Phase phase(String name) {
    RequestContext context = requestContext.get();
    if (context == null) {
      return Phase.NOOP;
    }
    return new Phase(name, context);
  }

  public static class Phase implements AutoCloseable {
    static final Phase NOOP = new Phase(null, null);

    private final String name;
    private final RequestContext context;
    private final ActivePhase activePhase;

    private Phase(String name, RequestContext context) {
      this.name = name;
      this.context = context;
      if (context != null) {
        this.activePhase = new ActivePhase(System.nanoTime(), context.dbTime.get());
        phaseStack.get().push(this.activePhase);
      } else {
        this.activePhase = null;
      }
    }

    @Override
    public void close() {
      if (context == null || activePhase == null) {
        return;
      }

      Deque<ActivePhase> stack = phaseStack.get();
      ActivePhase top = stack.peek();
      if (top == activePhase) {
        stack.pop();
      } else {
        // Defensive: handle out-of-order close without throwing.
        if (!stack.remove(activePhase)) {
          return;
        }
      }

      long elapsed = System.nanoTime() - activePhase.startNanos;
      long exclusive = elapsed - activePhase.childNanos;
      if (exclusive < 0) {
        exclusive = 0;
      }

      long dbInPhase = context.dbTime.get() - activePhase.dbTimeAtStartNanos;
      long exclusiveDb = dbInPhase - activePhase.childDbNanos;
      if (exclusiveDb < 0) {
        exclusiveDb = 0;
      }

      context.phaseTime.computeIfAbsent(name, k -> new AtomicLong(0)).addAndGet(elapsed);
      context.phaseExclusiveTime.computeIfAbsent(name, k -> new AtomicLong(0)).addAndGet(exclusive);
      if (exclusiveDb > 0) {
        context.phaseDbTime.computeIfAbsent(name, k -> new AtomicLong(0)).addAndGet(exclusiveDb);
      }

      ActivePhase parent = stack.peek();
      if (parent != null) {
        parent.childNanos += elapsed;
        parent.childDbNanos += dbInPhase;
      } else if (stack.isEmpty()) {
        phaseStack.remove();
      }
    }
  }

  public static void endRequest() {
    RequestContext context = requestContext.get();
    if (context == null) return;

    String timerKey = context.endpoint + "|" + context.method;
    try {
      if (context.requestTimerSample != null) {
        Timer requestTimer = requestTimers.get(timerKey);
        if (requestTimer != null) {
          context.totalTime = context.requestTimerSample.stop(requestTimer);
        }
      }

      long finalInternalStart = context.internalTimerStartNanos.get();
      if (finalInternalStart > 0) {
        context.serverTime.addAndGet(System.nanoTime() - finalInternalStart);
      }

      long dbTimeNanos = context.dbTime.get();
      long searchTimeNanos = context.searchTime.get();
      long authTimeNanos = context.authTime.get();
      long rdfTimeNanos = context.rdfTime.get();
      long serverTimeNanos = context.serverTime.get();
      int dbOps = context.dbOperationCount.get();

      Timer dbTimer =
          databaseTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.database")
                      .tag(ENDPOINT, context.endpoint)
                      .tag(METHOD, context.method)
                      .register(Metrics.globalRegistry));
      if (dbTimeNanos > 0) {
        dbTimer.record(dbTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      Timer searchTimer =
          searchTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.search")
                      .tag(ENDPOINT, context.endpoint)
                      .tag(METHOD, context.method)
                      .register(Metrics.globalRegistry));
      if (searchTimeNanos > 0) {
        searchTimer.record(searchTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      Timer authTimer =
          authTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.auth")
                      .tag(ENDPOINT, context.endpoint)
                      .tag(METHOD, context.method)
                      .register(Metrics.globalRegistry));
      if (authTimeNanos > 0) {
        authTimer.record(authTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      Timer rdfTimer =
          rdfTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.rdf")
                      .tag(ENDPOINT, context.endpoint)
                      .tag(METHOD, context.method)
                      .register(Metrics.globalRegistry));
      if (rdfTimeNanos > 0) {
        rdfTimer.record(rdfTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      Timer serverTimer =
          serverTimers.computeIfAbsent(
              timerKey,
              k ->
                  Timer.builder("request.latency.server")
                      .tag(ENDPOINT, context.endpoint)
                      .tag(METHOD, context.method)
                      .register(Metrics.globalRegistry));
      if (serverTimeNanos > 0) {
        serverTimer.record(serverTimeNanos, java.util.concurrent.TimeUnit.NANOSECONDS);
      }

      if (context.totalTime > slowRequestThresholdNanos) {
        String path = context.uriPath != null ? context.uriPath : context.endpoint;
        String phaseBreakdown = formatPhaseBreakdown(context.phaseTime);
        String phaseExclusiveBreakdown =
            formatPhaseBreakdown("phaseExclusive", context.phaseExclusiveTime);
        String phaseDbBreakdown = formatPhaseBreakdown("phaseDb", context.phaseDbTime);
        long phaseExclusiveNanos =
            context.phaseExclusiveTime.values().stream().mapToLong(AtomicLong::get).sum();
        long unphasedServerNanos = Math.max(0L, serverTimeNanos - phaseExclusiveNanos);
        long jsonKB = context.jsonBytesDeserialized.get() / 1024;
        int jsonOps = context.jsonDeserializeCount.get();
        LOG.warn(
            "Slow request - {} {}, total: {}ms, db: {}ms, search: {}ms, auth: {}ms, rdf: {}ms,"
                + " server: {}ms, dbOps: {}, searchOps: {}, rdfOps: {}, jsonKB: {}, jsonOps:"
                + " {}{}, unphasedServer: {}ms{}{}",
            context.method,
            path,
            context.totalTime / 1_000_000,
            dbTimeNanos / 1_000_000,
            searchTimeNanos / 1_000_000,
            authTimeNanos / 1_000_000,
            rdfTimeNanos / 1_000_000,
            serverTimeNanos / 1_000_000,
            dbOps,
            context.searchOperationCount.get(),
            context.rdfOperationCount.get(),
            jsonKB,
            jsonOps,
            phaseBreakdown,
            unphasedServerNanos / 1_000_000,
            phaseExclusiveBreakdown,
            phaseDbBreakdown);
      }

    } finally {
      phaseStack.remove();
      requestContext.remove();
    }
  }

  private static String formatPhaseBreakdown(ConcurrentHashMap<String, AtomicLong> phaseTime) {
    return formatPhaseBreakdown("phases", phaseTime);
  }

  private static String formatPhaseBreakdown(
      String label, ConcurrentHashMap<String, AtomicLong> phaseTime) {
    if (phaseTime.isEmpty()) {
      return "";
    }
    String phases =
        phaseTime.entrySet().stream()
            .sorted((a, b) -> Long.compare(b.getValue().get(), a.getValue().get()))
            .map(e -> e.getKey() + ": " + (e.getValue().get() / 1_000_000) + "ms")
            .collect(Collectors.joining(", "));
    return ", " + label + ": {" + phases + "}";
  }

  public static RequestContext getContext() {
    return requestContext.get();
  }

  public static void setContext(RequestContext context) {
    if (context != null) {
      requestContext.set(context);
    }
  }

  public static void clearContext() {
    phaseStack.remove();
    requestContext.remove();
  }

  private static final class ActivePhase {
    private final long startNanos;
    private final long dbTimeAtStartNanos;
    // Phase state is thread-confined via phaseStack ThreadLocal and never propagated cross-thread.
    private long childNanos;
    private long childDbNanos;

    private ActivePhase(long startNanos, long dbTimeAtStartNanos) {
      this.startNanos = startNanos;
      this.dbTimeAtStartNanos = dbTimeAtStartNanos;
      this.childNanos = 0;
      this.childDbNanos = 0;
    }
  }

  public static Runnable wrapWithContext(Runnable task) {
    RequestContext ctx = getContext();
    if (ctx == null) return task;
    return () -> {
      // Intentionally propagate only request counters, not phaseStack hierarchy.
      phaseStack.remove();
      setContext(ctx);
      try {
        task.run();
      } finally {
        clearContext();
      }
    };
  }

  public static <T> Supplier<T> wrapWithContext(Supplier<T> task) {
    RequestContext ctx = getContext();
    if (ctx == null) return task;
    return () -> {
      // Intentionally propagate only request counters, not phaseStack hierarchy.
      phaseStack.remove();
      setContext(ctx);
      try {
        return task.get();
      } finally {
        clearContext();
      }
    };
  }

  public static void reset() {
    requestContext.remove();
    requestTimers.clear();
    databaseTimers.clear();
    searchTimers.clear();
    authTimers.clear();
    rdfTimers.clear();
    serverTimers.clear();
  }

  @Getter
  public static class RequestContext {
    final String endpoint;
    final String method;
    final String uriPath;
    volatile Timer.Sample requestTimerSample;
    final AtomicLong internalTimerStartNanos = new AtomicLong(0);

    volatile long totalTime = 0;
    final AtomicLong dbTime = new AtomicLong(0);
    final AtomicLong searchTime = new AtomicLong(0);
    final AtomicLong authTime = new AtomicLong(0);
    final AtomicLong rdfTime = new AtomicLong(0);
    final AtomicLong serverTime = new AtomicLong(0);

    final AtomicInteger dbOperationCount = new AtomicInteger(0);
    final AtomicInteger searchOperationCount = new AtomicInteger(0);
    final AtomicInteger authOperationCount = new AtomicInteger(0);
    final AtomicInteger rdfOperationCount = new AtomicInteger(0);
    final AtomicLong jsonBytesDeserialized = new AtomicLong(0);
    final AtomicInteger jsonDeserializeCount = new AtomicInteger(0);

    final ConcurrentHashMap<String, AtomicLong> phaseTime = new ConcurrentHashMap<>();
    final ConcurrentHashMap<String, AtomicLong> phaseExclusiveTime = new ConcurrentHashMap<>();
    final ConcurrentHashMap<String, AtomicLong> phaseDbTime = new ConcurrentHashMap<>();

    RequestContext(String endpoint, String method, String uriPath) {
      this.endpoint = endpoint;
      this.method = method;
      this.uriPath = uriPath;
    }

    RequestContext(String endpoint, String method) {
      this(endpoint, method, null);
    }
  }
}

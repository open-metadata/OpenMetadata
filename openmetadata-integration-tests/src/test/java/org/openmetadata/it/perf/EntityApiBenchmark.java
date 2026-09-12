package org.openmetadata.it.perf;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.locks.LockSupport;
import org.openmetadata.it.perf.EntityBenchmarkHttp.Context;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.utils.JsonUtils;

/** Version-neutral HTTP measurements. Run in a separate JVM from each benchmark server. */
public final class EntityApiBenchmark {
  private final EntityBenchmarkManifest manifest;
  private final EntityBenchmarkHttp http;
  private final EntityBenchmarkGate gate;
  private final Scheduling scheduling;
  private final int concurrency;
  private final String run = UUID.randomUUID().toString();

  private EntityApiBenchmark(EntityBenchmarkManifest manifest) throws IOException {
    this.manifest = manifest;
    http = new EntityBenchmarkHttp(manifest);
    gate = EntityBenchmarkGate.configured();
    scheduling = Scheduling.configured();
    concurrency =
        gate == null && scheduling == Scheduling.OPEN_LOOP
            ? Integer.getInteger("entityBenchmark.concurrency", 32)
            : 1;
    if (concurrency < 1 || concurrency > 32) {
      throw new IllegalArgumentException("Benchmark concurrency must be between 1 and 32");
    }
  }

  public static void main(final String[] args) throws Exception {
    final Options options = Options.parse(args);
    final var manifest =
        JsonUtils.readValue(Files.readString(options.manifest()), EntityBenchmarkManifest.class);
    new EntityApiBenchmark(manifest).measure(options);
  }

  private void measure(final Options options) throws Exception {
    final StringBuilder csv =
        new StringBuilder(
            "workload,samples,errors,p50_ms,p95_ms,p99_ms,mean_ms,offered_rps,elapsed_seconds,reset,max_in_flight,scheduling\n");
    int errors = 0;
    for (final Workload workload : workloads(options.expression())) {
      final Measurement measured = measure(workload, options);
      errors += measured.errors();
      final double rate = scheduling == Scheduling.OPEN_LOOP ? options.sampling().rate() : 0;
      csv.append(measured.toCsv(workload.name(), rate).stripTrailing())
          .append(',')
          .append(gate == null ? "none" : gate.mode())
          .append(',')
          .append(concurrency)
          .append(',')
          .append(gate == null ? scheduling.value : "acknowledged-reset-serial")
          .append('\n');
      Files.writeString(options.output(), csv);
      measured.writeSamples(Path.of(options.output() + "." + workload.name() + ".samples.csv"));
      measured.writeRequests(Path.of(options.output() + "." + workload.name() + ".requests.csv"));
      System.out.println(
          workload.name()
              + ": "
              + measured.samples()
              + " samples, "
              + measured.errors()
              + " errors");
    }
    requireSuccessfulRequests(errors, "Measurement");
  }

  private List<Workload> workloads(final String expression) {
    final List<Workload> selected =
        manifest.workloads().stream()
            .filter(workload -> workload.name().matches(expression))
            .toList();
    if (selected.isEmpty()) {
      throw new IllegalArgumentException("No workload matches the requested expression");
    }
    return selected;
  }

  private Measurement measure(final Workload workload, final Options options) throws Exception {
    final Sampling sampling = options.sampling();
    final List<Context> prepared = prepare(workload, sampling.warmup() + sampling.samples());
    final Measurement warmup = run(workload, sampling.warmup(), sampling.rate(), 0, prepared);
    requireSuccessfulRequests(warmup.errors(), "Warmup for " + workload.name());
    try (var observation =
        EntityBenchmarkObservation.open(
            Path.of(options.output() + "." + workload.name() + ".sql.json"))) {
      return run(workload, sampling.samples(), sampling.rate(), sampling.warmup(), prepared);
    }
  }

  private static void requireSuccessfulRequests(final int errors, final String stage) {
    if (errors > 0) {
      throw new IllegalStateException(
          stage + " had " + errors + " failed requests; comparison is invalid");
    }
  }

  record Sampling(int samples, int warmup, double rate) {
    Sampling {
      if (samples < 1
          || samples > 100_000
          || warmup < 0
          || warmup > 100_000
          || !Double.isFinite(rate)
          || rate <= 0) {
        throw new IllegalArgumentException("Invalid sample count, warmup or offered rate");
      }
    }
  }

  private enum Scheduling {
    OPEN_LOOP("open-loop"),
    SINGLE_CLIENT("single-client");

    private final String value;

    Scheduling(final String value) {
      this.value = value;
    }

    private static Scheduling configured() {
      return switch (System.getProperty("entityBenchmark.scheduling", "open-loop")) {
        case "open-loop" -> OPEN_LOOP;
        case "single-client" -> SINGLE_CLIENT;
        default -> throw new IllegalArgumentException("Unknown benchmark scheduling mode");
      };
    }
  }

  private record Options(Path manifest, Path output, Sampling sampling, String expression) {
    static Options parse(final String[] args) {
      if (args.length != 6) {
        throw new IllegalArgumentException(
            "manifest output.csv samples warmup requestsPerSecond workloadRegex");
      }
      return new Options(
          Path.of(args[0]),
          Path.of(args[1]),
          new Sampling(
              Integer.parseInt(args[2]), Integer.parseInt(args[3]), Double.parseDouble(args[4])),
          args[5]);
    }
  }

  private List<Context> prepare(final Workload workload, final int count)
      throws IOException, InterruptedException {
    if (workload.setup().isEmpty()) return List.of();
    final List<Future<Context>> pending = new ArrayList<>(count);
    final Semaphore inFlight = new Semaphore(8);
    try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
      for (int sequence = 0; sequence < count; sequence++) {
        inFlight.acquire();
        final int index = sequence;
        pending.add(workers.submit(() -> prepareContext(workload, index, inFlight)));
      }
      return preparedContexts(pending);
    }
  }

  private Context prepareContext(Workload workload, int sequence, Semaphore inFlight)
      throws IOException, InterruptedException {
    try {
      Context context = new Context(run + "_" + sequence, null);
      for (final Request request : workload.setup()) {
        context = prepareRequest(workload, request, context);
      }
      return context;
    } finally {
      inFlight.release();
    }
  }

  private List<Context> preparedContexts(List<Future<Context>> pending)
      throws IOException, InterruptedException {
    final List<Context> contexts = new ArrayList<>(pending.size());
    try {
      for (final Future<Context> context : pending) {
        contexts.add(context.get());
      }
    } catch (ExecutionException exception) {
      throw new IOException("Benchmark fixture preparation failed", exception.getCause());
    }
    return List.copyOf(contexts);
  }

  private Context prepareRequest(
      final Workload workload, final Request request, final Context context)
      throws IOException, InterruptedException {
    final boolean capture =
        workload.checks().entityIdFromSetup() && "POST".equals(request.method());
    final Integer bulkItems =
        URI.create(context.expand(request.path())).getPath().endsWith("/bulk")
            ? JsonUtils.readTree(request.body()).size()
            : null;
    final var reply = http.send(request, context, capture || bulkItems != null);
    if (!reply.succeeds(request, bulkItems)) {
      throw new IllegalStateException("Fixture preparation failed for " + workload.name());
    }
    return capture ? new Context(context.sequence(), reply.entityId()) : context;
  }

  private Measurement run(
      final Workload workload,
      final int count,
      final double rate,
      final int sequenceOffset,
      final List<Context> prepared)
      throws Exception {
    final List<Future<Sample>> pending = new ArrayList<>(count);
    final Semaphore inFlight = new Semaphore(concurrency);
    final long started = System.nanoTime();
    try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
      for (int index = 0; index < count; index++) {
        final long scheduled = started + (long) (index * 1_000_000_000.0 / rate);
        if (scheduling == Scheduling.OPEN_LOOP) {
          awaitArrival(scheduled);
        }
        inFlight.acquire();
        final long arrival = scheduling == Scheduling.OPEN_LOOP ? scheduled : System.nanoTime();
        final int sequence = index + sequenceOffset;
        final Context context =
            prepared.isEmpty() ? new Context(run + "_" + sequence, null) : prepared.get(sequence);
        pending.add(workers.submit(() -> sample(workload, context, arrival, inFlight)));
      }
      return collect(pending, started);
    }
  }

  private Sample sample(
      final Workload workload,
      final Context context,
      final long scheduled,
      final Semaphore inFlight)
      throws InterruptedException {
    long requestStarted = scheduled;
    long submissionDelay = 0;
    int status = 0;
    try {
      requestStarted = gate == null ? scheduled : gate.startRequest();
      submissionDelay = Math.max(0, System.nanoTime() - requestStarted);
      final var reply =
          http.send(
              workload.request(),
              context,
              workload.checks().bulkItems() != null || workload.checks().csvRows() != null);
      status = reply.status();
      final var completion = workload.checks().completion();
      final boolean success = reply.succeeds(workload.request(), workload.checks());
      long completed = reply.completed();
      if (success && completion != null) {
        final long observed = http.await(completion, context);
        if (completion.measure()) completed = observed;
      }
      return new Sample(completed - requestStarted, success, submissionDelay, status);
    } catch (IOException exception) {
      return new Sample(System.nanoTime() - requestStarted, false, submissionDelay, status);
    } finally {
      inFlight.release();
    }
  }

  private Measurement collect(final List<Future<Sample>> pending, final long started)
      throws Exception {
    final long[] durations = new long[pending.size()];
    final List<Sample> requests = new ArrayList<>(pending.size());
    int errors = 0;
    for (int index = 0; index < pending.size(); index++) {
      final Sample sample = pending.get(index).get();
      requests.add(sample);
      durations[index] = sample.nanoseconds();
      if (!sample.success()) {
        errors++;
      }
    }
    Arrays.sort(durations);
    return new Measurement(
        durations, errors, (System.nanoTime() - started) / 1_000_000_000.0, requests);
  }

  private static void awaitArrival(long scheduled) throws InterruptedException {
    long remaining;
    while ((remaining = scheduled - System.nanoTime()) > 0) {
      LockSupport.parkNanos(remaining);
      if (Thread.interrupted()) {
        throw new InterruptedException("Benchmark interrupted");
      }
    }
  }

  record Sample(long nanoseconds, boolean success, long submissionDelay, int status) {}

  record Measurement(
      long[] sortedNanoseconds, int errors, double elapsedSeconds, List<Sample> requests) {
    Measurement {
      sortedNanoseconds = sortedNanoseconds.clone();
      requests = List.copyOf(requests);
    }

    @Override
    public long[] sortedNanoseconds() {
      return sortedNanoseconds.clone();
    }

    int samples() {
      return sortedNanoseconds.length;
    }

    double percentile(double fraction) {
      if (!Double.isFinite(fraction) || fraction < 0 || fraction > 1) {
        throw new IllegalArgumentException("Percentile must be between zero and one");
      }
      if (samples() == 0) {
        return 0;
      }
      return sortedNanoseconds[Math.max(0, (int) Math.ceil(samples() * fraction) - 1)]
          / 1_000_000.0;
    }

    void writeSamples(Path path) throws IOException {
      final StringBuilder csv = new StringBuilder("rank,latency_ms\n");
      for (int index = 0; index < samples(); index++) {
        csv.append(index + 1)
            .append(',')
            .append(sortedNanoseconds[index] / 1_000_000.0)
            .append('\n');
      }
      Files.writeString(path, csv);
    }

    void writeRequests(Path path) throws IOException {
      final StringBuilder csv =
          new StringBuilder("sequence,latency_ms,submission_delay_ms,http_status,success\n");
      for (int index = 0; index < requests.size(); index++) {
        final Sample request = requests.get(index);
        csv.append(index + 1)
            .append(',')
            .append(request.nanoseconds() / 1_000_000.0)
            .append(',')
            .append(request.submissionDelay() / 1_000_000.0)
            .append(',')
            .append(request.status())
            .append(',')
            .append(request.success())
            .append('\n');
      }
      Files.writeString(path, csv);
    }

    String toCsv(String name, double rate) {
      double mean = Arrays.stream(sortedNanoseconds).average().orElse(0) / 1_000_000.0;
      return String.format(
          Locale.ROOT,
          "%s,%d,%d,%.6f,%.6f,%.6f,%.6f,%.3f,%.3f%n",
          name,
          samples(),
          errors,
          percentile(0.50),
          percentile(0.95),
          percentile(0.99),
          mean,
          rate,
          elapsedSeconds);
    }
  }
}

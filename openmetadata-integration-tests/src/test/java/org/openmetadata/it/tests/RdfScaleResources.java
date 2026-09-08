package org.openmetadata.it.tests;

import com.sun.management.OperatingSystemMXBean;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.testcontainers.containers.GenericContainer;

/** Streams samples to disk; in-memory aggregation retains only resource peaks. */
final class RdfScaleResources implements AutoCloseable {
  private static final long MIN_FREE_DISK = 12L * 1024 * 1024 * 1024;
  private static final OperatingSystemMXBean SYSTEM =
      ManagementFactory.getPlatformMXBean(OperatingSystemMXBean.class);
  private final GenericContainer<?> fuseki;
  private final GenericContainer<?> database;
  private final BufferedWriter samples;
  private final ScheduledExecutorService sampler = Executors.newSingleThreadScheduledExecutor();
  private final AtomicReference<RuntimeException> failure = new AtomicReference<>();
  private volatile String phase = "initializing";
  private Peaks peaks = new Peaks(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  private int sampleCount;

  record Peaks(
      long appHeapBytes,
      long appRssBytes,
      long fusekiRssBytes,
      long fusekiContainerBytes,
      long fusekiDiskBytes,
      long databaseContainerBytes,
      long databaseDiskBytes,
      long sampleCount,
      int coordinatorWorkers,
      int participantWorkers) {}

  record Sample(
      String time,
      String phase,
      long appHeapBytes,
      long appRssBytes,
      long fusekiRssBytes,
      long fusekiContainerBytes,
      long fusekiDiskBytes,
      long databaseContainerBytes,
      long databaseDiskBytes,
      long hostFreeDiskBytes,
      long hostFreeMemoryBytes,
      long hostSwapUsedBytes,
      double hostLoadAverage,
      int coordinatorWorkers,
      int participantWorkers) {}

  RdfScaleResources(
      final GenericContainer<?> fuseki, final GenericContainer<?> database, final Path output)
      throws IOException {
    this.fuseki = fuseki;
    this.database = database;
    Files.createDirectories(output);
    samples = Files.newBufferedWriter(output.resolve("resources.jsonl"), StandardCharsets.UTF_8);
    sampler.scheduleWithFixedDelay(this::sampleSafely, 0, 2, TimeUnit.SECONDS);
  }

  synchronized void phase(final String name) {
    phase = name;
    peaks = new Peaks(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    sampleCount = 0;
  }

  synchronized Peaks peaks() {
    check();
    return peaks;
  }

  void check() {
    final RuntimeException samplingFailure = failure.get();
    if (samplingFailure != null) {
      throw new IllegalStateException("RDF scale resource sampling failed", samplingFailure);
    }
  }

  private void sampleSafely() {
    try {
      sample();
    } catch (IOException exception) {
      failure.compareAndSet(null, new UncheckedIOException(exception));
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      failure.compareAndSet(
          null, new IllegalStateException("Resource sampling interrupted", exception));
    } catch (RuntimeException exception) {
      failure.compareAndSet(null, exception);
    }
  }

  private synchronized void sample() throws IOException, InterruptedException {
    final long hostFree = Files.getFileStore(Path.of(".")).getUsableSpace();
    if (hostFree < MIN_FREE_DISK)
      throw new IllegalStateException("Scale run reached the 12 GiB free-disk reserve");
    final long heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
    final long appRss = processRss();
    final var fusekiSample = sampleFuseki();
    final var databaseSample = sampleDatabase();
    final WorkerCounts workers = countWorkers();
    final Sample sample =
        new Sample(
            Instant.now().toString(),
            phase,
            heap,
            appRss,
            fusekiSample.rss(),
            fusekiSample.memory(),
            fusekiSample.disk(),
            databaseSample.memory(),
            databaseSample.disk(),
            hostFree,
            SYSTEM.getFreeMemorySize(),
            SYSTEM.getTotalSwapSpaceSize() - SYSTEM.getFreeSwapSpaceSize(),
            SYSTEM.getSystemLoadAverage(),
            workers.coordinator(),
            workers.participant());
    samples.write(JsonUtils.pojoToJson(sample));
    samples.newLine();
    samples.flush();
    recordPeaks(sample);
  }

  private record ContainerSample(long rss, long memory, long disk) {}

  private record WorkerCounts(int coordinator, int participant) {}

  private static WorkerCounts countWorkers() {
    final var threads = ManagementFactory.getThreadMXBean();
    int coordinator = 0;
    int participant = 0;
    for (var thread : threads.getThreadInfo(threads.getAllThreadIds())) {
      if (thread == null) continue;
      final String name = thread.getThreadName();
      if (name.startsWith("rdf-distributed-coordinator-")) coordinator++;
      if (name.startsWith("rdf-distributed-participant-")) participant++;
    }
    return new WorkerCounts(coordinator, participant);
  }

  private ContainerSample sampleFuseki() throws IOException, InterruptedException {
    final var result =
        fuseki.execInContainer(
            "sh",
            "-c",
            """
        awk '/^Name:/ {isjava=($2=="java")} /^VmRSS:/ && isjava {printf "rss %.0f\\n", $2*1024}' /proc/[0-9]*/status
        if test -r /sys/fs/cgroup/memory.current; then
          awk '{print "memory " $1}' /sys/fs/cgroup/memory.current
        else
          awk '{print "memory " $1}' /sys/fs/cgroup/memory/memory.usage_in_bytes
        fi
        du -sk /fuseki-data | awk '{printf "disk %.0f\\n", $1*1024}'
        """);
    if (result.getExitCode() != 0)
      throw new IOException("Fuseki sampling failed: " + result.getStderr());
    return new ContainerSample(
        metric(result.getStdout(), "rss"),
        metric(result.getStdout(), "memory"),
        metric(result.getStdout(), "disk"));
  }

  private ContainerSample sampleDatabase() throws IOException, InterruptedException {
    final var databaseSample =
        database.execInContainer(
            "sh",
            "-c",
            """
        if test -r /sys/fs/cgroup/memory.current; then
          awk '{print "memory " $1}' /sys/fs/cgroup/memory.current
        else
          awk '{print "memory " $1}' /sys/fs/cgroup/memory/memory.usage_in_bytes
        fi
        du -sk /var/lib/postgresql/data | awk '{printf "disk %.0f\\n", $1*1024}'
        """);
    if (databaseSample.getExitCode() != 0)
      throw new IOException("Database sampling failed: " + databaseSample.getStderr());
    return new ContainerSample(
        0,
        metric(databaseSample.getStdout(), "memory"),
        metric(databaseSample.getStdout(), "disk"));
  }

  private void recordPeaks(final Sample sample) {
    sampleCount++;
    peaks =
        new Peaks(
            Math.max(peaks.appHeapBytes(), sample.appHeapBytes()),
            Math.max(peaks.appRssBytes(), sample.appRssBytes()),
            Math.max(peaks.fusekiRssBytes(), sample.fusekiRssBytes()),
            Math.max(peaks.fusekiContainerBytes(), sample.fusekiContainerBytes()),
            Math.max(peaks.fusekiDiskBytes(), sample.fusekiDiskBytes()),
            Math.max(peaks.databaseContainerBytes(), sample.databaseContainerBytes()),
            Math.max(peaks.databaseDiskBytes(), sample.databaseDiskBytes()),
            sampleCount,
            Math.max(peaks.coordinatorWorkers(), sample.coordinatorWorkers()),
            Math.max(peaks.participantWorkers(), sample.participantWorkers()));
  }

  private static long metric(final String output, final String name) throws IOException {
    return output
        .lines()
        .filter(line -> line.startsWith(name + " "))
        .mapToLong(line -> Long.parseLong(line.substring(name.length() + 1).strip()))
        .max()
        .orElseThrow(() -> new IOException("Missing " + name + " sample: " + output));
  }

  private static long processRss() throws IOException, InterruptedException {
    final Process process =
        new ProcessBuilder(
                List.of("ps", "-o", "rss=", "-p", Long.toString(ProcessHandle.current().pid())))
            .start();
    if (!process.waitFor(5, TimeUnit.SECONDS)) {
      process.destroyForcibly();
      throw new IOException("Timed out sampling the application process");
    }
    if (process.exitValue() != 0) throw new IOException("Cannot sample application RSS");
    return Long.parseLong(
            new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip())
        * 1024;
  }

  @Override
  public void close() throws IOException {
    sampler.shutdown();
    try {
      if (!sampler.awaitTermination(30, TimeUnit.SECONDS)) sampler.shutdownNow();
    } catch (InterruptedException exception) {
      sampler.shutdownNow();
      Thread.currentThread().interrupt();
      throw new IOException("Interrupted while closing resource samples", exception);
    } finally {
      samples.close();
    }
    check();
  }
}

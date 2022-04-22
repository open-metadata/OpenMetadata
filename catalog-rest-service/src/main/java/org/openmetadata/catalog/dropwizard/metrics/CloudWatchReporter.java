package org.openmetadata.catalog.dropwizard.metrics;

import com.codahale.metrics.Clock;
import com.codahale.metrics.Counter;
import com.codahale.metrics.Counting;
import com.codahale.metrics.Gauge;
import com.codahale.metrics.Histogram;
import com.codahale.metrics.Meter;
import com.codahale.metrics.Metered;
import com.codahale.metrics.MetricFilter;
import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.ScheduledReporter;
import com.codahale.metrics.Snapshot;
import com.codahale.metrics.Timer;
import com.codahale.metrics.jvm.BufferPoolMetricSet;
import com.codahale.metrics.jvm.ClassLoadingGaugeSet;
import com.codahale.metrics.jvm.FileDescriptorRatioGauge;
import com.codahale.metrics.jvm.GarbageCollectorMetricSet;
import com.codahale.metrics.jvm.MemoryUsageGaugeSet;
import com.codahale.metrics.jvm.ThreadStatesGaugeSet;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.SortedMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.LongStream;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;
import software.amazon.awssdk.services.cloudwatch.model.MetricDatum;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataRequest;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataResponse;
import software.amazon.awssdk.services.cloudwatch.model.StandardUnit;
import software.amazon.awssdk.services.cloudwatch.model.StatisticSet;

@Slf4j
public class CloudWatchReporter extends ScheduledReporter {

  static final String DIMENSION_NAME_TYPE = "Type";

  static final String DIMENSION_GAUGE = "gauge";

  static final String DIMENSION_COUNT = "count";

  static final String DIMENSION_SNAPSHOT_SUMMARY = "snapshot-summary";

  static final String DIMENSION_SNAPSHOT_MEAN = "snapshot-mean";

  static final String DIMENSION_SNAPSHOT_STD_DEV = "snapshot-std-dev";

  private static final int HIGH_RESOLUTION = 1;

  private static final int STANDARD_RESOLUTION = 60;

  private static final double SMALLEST_SENDABLE_VALUE = 8.515920e-109;

  private static final double LARGEST_SENDABLE_VALUE = 1.174271e+108;

  private static final int MAXIMUM_DATUMS_PER_REQUEST = 20;

  private final Map<Counting, Long> lastPolledCounts;

  private final Builder builder;
  private final String namespace;
  private final CloudWatchAsyncClient cloudWatchAsyncClient;
  private final StandardUnit rateUnit;
  private final StandardUnit durationUnit;
  private final boolean highResolution;

  private CloudWatchReporter(final Builder builder) {
    super(
        builder.metricRegistry,
        "openmetadata-metrics-cloud-watch-reporter",
        builder.metricFilter,
        builder.rateUnit,
        builder.durationUnit);
    this.builder = builder;
    this.namespace = builder.namespace;
    this.cloudWatchAsyncClient = builder.cloudWatchAsyncClient;
    this.lastPolledCounts = new ConcurrentHashMap<>();
    this.rateUnit = builder.cwRateUnit;
    this.durationUnit = builder.cwDurationUnit;
    this.highResolution = builder.highResolution;
  }

  @Override
  public void report(
      final SortedMap<String, Gauge> gauges,
      final SortedMap<String, Counter> counters,
      final SortedMap<String, Histogram> histograms,
      final SortedMap<String, Meter> meters,
      final SortedMap<String, Timer> timers) {

    if (builder.withDryRun) {
      LOG.warn("** Reporter is running in 'DRY RUN' mode **");
    }

    try {
      final List<MetricDatum> metricData =
          new ArrayList<>(gauges.size() + counters.size() + 10 * histograms.size() + 10 * timers.size());
      processGauges(gauges, metricData);
      processCounters(counters, metricData);
      processHistogram(histograms, metricData);
      processMeters(meters, metricData);
      processTimers(timers, metricData);
      final Collection<List<MetricDatum>> metricDataPartitions = partition(metricData, MAXIMUM_DATUMS_PER_REQUEST);
      final List<Future<PutMetricDataResponse>> cloudWatchFutures = new ArrayList<>(metricData.size());

      for (final List<MetricDatum> partition : metricDataPartitions) {
        final PutMetricDataRequest putMetricDataRequest =
            PutMetricDataRequest.builder().namespace(namespace).metricData(partition).build();

        if (builder.withDryRun) {
          if (LOG.isDebugEnabled()) {
            LOG.debug("Dry run - constructed PutMetricDataRequest: {}", putMetricDataRequest);
          }
        } else {
          cloudWatchFutures.add(cloudWatchAsyncClient.putMetricData(putMetricDataRequest));
        }
      }

      for (final Future<PutMetricDataResponse> cloudWatchFuture : cloudWatchFutures) {
        try {
          cloudWatchFuture.get();
        } catch (final Exception e) {
          LOG.error(
              "Error reporting metrics to CloudWatch. The data in this CloudWatch API request "
                  + "may have been discarded, did not make it to CloudWatch.",
              e);
        }
      }

      if (LOG.isDebugEnabled()) {
        LOG.debug(
            "Sent {} metric datums to CloudWatch. Namespace: {}, metric data {}",
            metricData.size(),
            namespace,
            metricData);
      }
    } catch (final RuntimeException e) {
      LOG.error("Error marshalling CloudWatch metrics.", e);
    }
  }

  @Override
  public void stop() {
    try {
      super.stop();
    } catch (final Exception e) {
      LOG.error("Error when stopping the reporter.", e);
    } finally {
      if (!builder.withDryRun) {
        try {
          cloudWatchAsyncClient.close();
        } catch (final Exception e) {
          LOG.error("Error shutting down AmazonCloudWatchAsync {}, {}", cloudWatchAsyncClient, e);
        }
      }
    }
  }

  private void processGauges(SortedMap<String, Gauge> gauges, final List<MetricDatum> metricData) {
    gauges.forEach(
        (k, v) ->
            Optional.ofNullable(v.getValue())
                .filter(value -> value instanceof Number)
                .map(value -> (Number) value)
                .ifPresent(
                    value ->
                        stageMetricDatum(
                            true, k, value.doubleValue(), StandardUnit.NONE, DIMENSION_GAUGE, metricData)));
  }

  private void processCounters(SortedMap<String, Counter> counters, final List<MetricDatum> metricData) {
    for (final Map.Entry<String, Counter> counterEntry : counters.entrySet()) {
      String metricName = counterEntry.getKey();
      Counter counter = counterEntry.getValue();
      processCounter(metricName, counter, metricData);
    }
  }

  private void processMeters(SortedMap<String, Meter> meters, final List<MetricDatum> metricData) {
    for (final Map.Entry<String, Meter> meterEntry : meters.entrySet()) {
      String metricName = meterEntry.getKey();
      Meter meter = meterEntry.getValue();
      processMeter(metricName, meter, metricData);
      processCounter(metricName, meter, metricData);
    }
  }

  private void processMeter(final String metricName, final Metered meter, final List<MetricDatum> metricData) {
    final String formattedRate = String.format("-rate [per-%s]", getRateUnit());
    stageMetricDatum(
        builder.withOneMinuteMeanRate,
        metricName,
        convertRate(meter.getOneMinuteRate()),
        rateUnit,
        "1-min-mean" + formattedRate,
        metricData);
    stageMetricDatum(
        builder.withFiveMinuteMeanRate,
        metricName,
        convertRate(meter.getFiveMinuteRate()),
        rateUnit,
        "5-min-mean" + formattedRate,
        metricData);
    stageMetricDatum(
        builder.withFifteenMinuteMeanRate,
        metricName,
        convertRate(meter.getFifteenMinuteRate()),
        rateUnit,
        "15-min-mean" + formattedRate,
        metricData);
    stageMetricDatum(
        builder.withMeanRate,
        metricName,
        convertRate(meter.getMeanRate()),
        rateUnit,
        "mean" + formattedRate,
        metricData);
  }

  private void processCounter(final String metricName, final Counting counter, final List<MetricDatum> metricData) {
    long currentCount = counter.getCount();
    Long lastCount = lastPolledCounts.get(counter);
    lastPolledCounts.put(counter, currentCount);

    if (lastCount == null) {
      lastCount = 0L;
    }

    final long reportValue;
    if (builder.withReportRawCountValue) {
      reportValue = currentCount;
    } else {
      // Only submit metrics that have changed - let's save some money!
      reportValue = currentCount - lastCount;
    }

    stageMetricDatum(true, metricName, reportValue, StandardUnit.COUNT, DIMENSION_COUNT, metricData);
  }

  private void processTimers(SortedMap<String, Timer> timers, final List<MetricDatum> metricData) {

    for (final Map.Entry<String, Timer> timerEntry : timers.entrySet()) {
      String metricName = timerEntry.getKey();
      Timer timer = timerEntry.getValue();
      final Snapshot snapshot = timer.getSnapshot();

      if (builder.withZeroValuesSubmission || snapshot.size() > 0) {
        for (final Percentile percentile : builder.percentiles) {
          final double convertedDuration = convertDuration(snapshot.getValue(percentile.getQuantile()));
          stageMetricDatum(true, metricName, convertedDuration, durationUnit, percentile.getDesc(), metricData);
        }
      }

      // prevent empty snapshot from causing InvalidParameterValueException
      if (snapshot.size() > 0) {
        final String formattedDuration = String.format(" [in-%s]", getDurationUnit());
        stageMetricDatum(
            builder.withArithmeticMean,
            metricName,
            convertDuration(snapshot.getMean()),
            durationUnit,
            DIMENSION_SNAPSHOT_MEAN + formattedDuration,
            metricData);
        stageMetricDatum(
            builder.withStdDev,
            metricName,
            convertDuration(snapshot.getStdDev()),
            durationUnit,
            DIMENSION_SNAPSHOT_STD_DEV + formattedDuration,
            metricData);
        stageMetricDatumWithConvertedSnapshot(builder.withStatisticSet, metricName, snapshot, durationUnit, metricData);
      }

      processCounter(timerEntry.getKey(), timerEntry.getValue(), metricData);
      processMeter(timerEntry.getKey(), timerEntry.getValue(), metricData);
    }
  }

  private void processHistogram(SortedMap<String, Histogram> histogramCounters, final List<MetricDatum> metricData) {
    for (final Map.Entry<String, Histogram> counterEntry : histogramCounters.entrySet()) {
      String metricName = counterEntry.getKey();
      Histogram histogram = counterEntry.getValue();
      final Snapshot snapshot = histogram.getSnapshot();

      if (builder.withZeroValuesSubmission || snapshot.size() > 0) {
        for (final Percentile percentile : builder.percentiles) {
          final double value = snapshot.getValue(percentile.getQuantile());
          stageMetricDatum(true, metricName, value, StandardUnit.NONE, percentile.getDesc(), metricData);
        }
      }

      // prevent empty snapshot from causing InvalidParameterValueException
      if (snapshot.size() > 0) {
        stageMetricDatum(
            builder.withArithmeticMean,
            metricName,
            snapshot.getMean(),
            StandardUnit.NONE,
            DIMENSION_SNAPSHOT_MEAN,
            metricData);
        stageMetricDatum(
            builder.withStdDev,
            metricName,
            snapshot.getStdDev(),
            StandardUnit.NONE,
            DIMENSION_SNAPSHOT_STD_DEV,
            metricData);
        stageMetricDatumWithRawSnapshot(builder.withStatisticSet, metricName, snapshot, StandardUnit.NONE, metricData);
      }

      processCounter(metricName, histogram, metricData);
    }
  }

  private void stageMetricDatum(
      final boolean metricConfigured,
      final String metricName,
      final double metricValue,
      final StandardUnit standardUnit,
      final String dimensionValue,
      final List<MetricDatum> metricData) {
    // Only submit metrics that show some data, so let's save some money
    if (metricConfigured && (builder.withZeroValuesSubmission || metricValue > 0)) {
      final DimensionedName dimensionedName = DimensionedName.decode(metricName);

      final Set<Dimension> dimensions = new LinkedHashSet<>(builder.globalDimensions);
      dimensions.add(Dimension.builder().name(DIMENSION_NAME_TYPE).value(dimensionValue).build());
      dimensions.addAll(dimensionedName.getDimensions());

      metricData.add(
          MetricDatum.builder()
              .timestamp(Instant.ofEpochMilli(builder.clock.getTime()))
              .value(cleanMetricValue(metricValue))
              .metricName(dimensionedName.getName())
              .dimensions(dimensions)
              .storageResolution(highResolution ? HIGH_RESOLUTION : STANDARD_RESOLUTION)
              .unit(standardUnit)
              .build());
    }
  }

  private void stageMetricDatumWithConvertedSnapshot(
      final boolean metricConfigured,
      final String metricName,
      final Snapshot snapshot,
      final StandardUnit standardUnit,
      final List<MetricDatum> metricData) {
    if (metricConfigured) {
      final DimensionedName dimensionedName = DimensionedName.decode(metricName);
      double scaledSum = convertDuration(LongStream.of(snapshot.getValues()).sum());
      final StatisticSet statisticSet =
          StatisticSet.builder()
              .sum(scaledSum)
              .sampleCount((double) snapshot.size())
              .minimum(convertDuration(snapshot.getMin()))
              .maximum(convertDuration(snapshot.getMax()))
              .build();

      final Set<Dimension> dimensions = new LinkedHashSet<>(builder.globalDimensions);
      dimensions.add(Dimension.builder().name(DIMENSION_NAME_TYPE).value(DIMENSION_SNAPSHOT_SUMMARY).build());
      dimensions.addAll(dimensionedName.getDimensions());

      metricData.add(
          MetricDatum.builder()
              .timestamp(Instant.ofEpochMilli(builder.clock.getTime()))
              .metricName(dimensionedName.getName())
              .dimensions(dimensions)
              .statisticValues(statisticSet)
              .storageResolution(highResolution ? HIGH_RESOLUTION : STANDARD_RESOLUTION)
              .unit(standardUnit)
              .build());
    }
  }

  private void stageMetricDatumWithRawSnapshot(
      final boolean metricConfigured,
      final String metricName,
      final Snapshot snapshot,
      final StandardUnit standardUnit,
      final List<MetricDatum> metricData) {
    if (metricConfigured) {
      final DimensionedName dimensionedName = DimensionedName.decode(metricName);
      double total = LongStream.of(snapshot.getValues()).sum();
      final StatisticSet statisticSet =
          StatisticSet.builder()
              .sum(total)
              .sampleCount((double) snapshot.size())
              .minimum((double) snapshot.getMin())
              .maximum((double) snapshot.getMax())
              .build();

      final Set<Dimension> dimensions = new LinkedHashSet<>(builder.globalDimensions);
      dimensions.add(Dimension.builder().name(DIMENSION_NAME_TYPE).value(DIMENSION_SNAPSHOT_SUMMARY).build());
      dimensions.addAll(dimensionedName.getDimensions());

      metricData.add(
          MetricDatum.builder()
              .timestamp(Instant.ofEpochMilli(builder.clock.getTime()))
              .metricName(dimensionedName.getName())
              .dimensions(dimensions)
              .statisticValues(statisticSet)
              .storageResolution(highResolution ? HIGH_RESOLUTION : STANDARD_RESOLUTION)
              .unit(standardUnit)
              .build());
    }
  }

  private double cleanMetricValue(final double metricValue) {
    double absoluteValue = Math.abs(metricValue);
    if (absoluteValue < SMALLEST_SENDABLE_VALUE) {
      // Allow 0 through untouched, everything else gets rounded to SMALLEST_SENDABLE_VALUE
      if (absoluteValue > 0) {
        if (metricValue < 0) {
          return -SMALLEST_SENDABLE_VALUE;
        } else {
          return SMALLEST_SENDABLE_VALUE;
        }
      }
    } else if (absoluteValue > LARGEST_SENDABLE_VALUE) {
      if (metricValue < 0) {
        return -LARGEST_SENDABLE_VALUE;
      } else {
        return LARGEST_SENDABLE_VALUE;
      }
    }
    return metricValue;
  }

  public <T> Collection<List<T>> partition(final Collection<T> wholeCollection, final int partitionSize) {
    final int[] itemCounter = new int[] {0};

    return wholeCollection.stream().collect(Collectors.groupingBy(item -> itemCounter[0]++ / partitionSize)).values();
  }

  public static Builder forRegistry(
      final MetricRegistry metricRegistry, final CloudWatchAsyncClient client, final String namespace) {
    return new Builder(metricRegistry, client, namespace);
  }

  public enum Percentile {
    P50(0.50, "50%"),
    P75(0.75, "75%"),
    P95(0.95, "95%"),
    P98(0.98, "98%"),
    P99(0.99, "99%"),
    P995(0.995, "99.5%"),
    P999(0.999, "99.9%");

    private final double quantile;
    private final String desc;

    Percentile(final double quantile, final String desc) {
      this.quantile = quantile;
      this.desc = desc;
    }

    public double getQuantile() {
      return quantile;
    }

    public String getDesc() {
      return desc;
    }
  }

  public static class Builder {

    private final String namespace;
    private final CloudWatchAsyncClient cloudWatchAsyncClient;
    private final MetricRegistry metricRegistry;

    private Percentile[] percentiles;
    private boolean withOneMinuteMeanRate;
    private boolean withFiveMinuteMeanRate;
    private boolean withFifteenMinuteMeanRate;
    private boolean withMeanRate;
    private boolean withArithmeticMean;
    private boolean withStdDev;
    private boolean withDryRun;
    private boolean withZeroValuesSubmission;
    private boolean withStatisticSet;
    private boolean withJvmMetrics;
    private boolean withReportRawCountValue;
    private MetricFilter metricFilter;
    private TimeUnit rateUnit;
    private TimeUnit durationUnit;
    private Optional<StandardUnit> cwMeterUnit;
    private StandardUnit cwRateUnit;
    private StandardUnit cwDurationUnit;
    private Set<Dimension> globalDimensions;
    private final Clock clock;
    private boolean highResolution;

    private Builder(
        final MetricRegistry metricRegistry,
        final CloudWatchAsyncClient cloudWatchAsyncClient,
        final String namespace) {
      this.metricRegistry = metricRegistry;
      this.cloudWatchAsyncClient = cloudWatchAsyncClient;
      this.namespace = namespace;
      this.percentiles = new Percentile[] {Percentile.P75, Percentile.P95, Percentile.P999};
      this.metricFilter = MetricFilter.ALL;
      this.rateUnit = TimeUnit.SECONDS;
      this.durationUnit = TimeUnit.MILLISECONDS;
      this.globalDimensions = new LinkedHashSet<>();
      this.cwMeterUnit = Optional.empty();
      this.cwRateUnit = toStandardUnit(rateUnit);
      this.cwDurationUnit = toStandardUnit(durationUnit);
      this.clock = Clock.defaultClock();
    }

    public Builder convertRatesTo(final TimeUnit rateUnit) {
      this.rateUnit = rateUnit;
      return this;
    }

    public Builder convertDurationsTo(final TimeUnit durationUnit) {
      this.durationUnit = durationUnit;
      return this;
    }

    public Builder filter(final MetricFilter metricFilter) {
      this.metricFilter = metricFilter;
      return this;
    }

    public Builder withOneMinuteMeanRate() {
      withOneMinuteMeanRate = true;
      return this;
    }

    public Builder withFiveMinuteMeanRate() {
      withFiveMinuteMeanRate = true;
      return this;
    }

    public Builder withFifteenMinuteMeanRate() {
      withFifteenMinuteMeanRate = true;
      return this;
    }

    public Builder withMeanRate() {
      withMeanRate = true;
      return this;
    }

    public Builder withArithmeticMean() {
      withArithmeticMean = true;
      return this;
    }

    public Builder withStdDev() {
      withStdDev = true;
      return this;
    }

    public Builder withStatisticSet() {
      withStatisticSet = true;
      return this;
    }

    public Builder withJvmMetrics() {
      withJvmMetrics = true;
      return this;
    }

    public Builder withDryRun() {
      withDryRun = true;
      return this;
    }

    public Builder withZeroValuesSubmission() {
      withZeroValuesSubmission = true;
      return this;
    }

    public Builder withReportRawCountValue() {
      withReportRawCountValue = true;
      return this;
    }

    public Builder withPercentiles(final Percentile... percentiles) {
      this.percentiles = percentiles;
      return this;
    }

    public Builder withGlobalDimensions(final String... dimensions) {
      for (final String pair : dimensions) {
        final List<String> splitted = Stream.of(pair.split("=")).map(String::trim).collect(Collectors.toList());
        this.globalDimensions.add(Dimension.builder().name(splitted.get(0)).value(splitted.get(1)).build());
      }
      return this;
    }

    public Builder withHighResolution() {
      this.highResolution = true;
      return this;
    }

    public Builder withMeterUnitSentToCW(final StandardUnit reportUnit) {
      this.cwMeterUnit = Optional.of(reportUnit);
      return this;
    }

    public CloudWatchReporter build() {

      if (withJvmMetrics) {
        metricRegistry.register("jvm.uptime", (Gauge<Long>) () -> ManagementFactory.getRuntimeMXBean().getUptime());
        metricRegistry.register("jvm.current_time", (Gauge<Long>) clock::getTime);
        metricRegistry.register("jvm.classes", new ClassLoadingGaugeSet());
        metricRegistry.register("jvm.fd_usage", new FileDescriptorRatioGauge());
        metricRegistry.register("jvm.buffers", new BufferPoolMetricSet(ManagementFactory.getPlatformMBeanServer()));
        metricRegistry.register("jvm.gc", new GarbageCollectorMetricSet());
        metricRegistry.register("jvm.memory", new MemoryUsageGaugeSet());
        metricRegistry.register("jvm.thread-states", new ThreadStatesGaugeSet());
      }

      cwRateUnit = cwMeterUnit.orElse(toStandardUnit(rateUnit));
      cwDurationUnit = toStandardUnit(durationUnit);

      return new CloudWatchReporter(this);
    }

    private StandardUnit toStandardUnit(final TimeUnit timeUnit) {
      switch (timeUnit) {
        case SECONDS:
          return StandardUnit.SECONDS;
        case MILLISECONDS:
          return StandardUnit.MILLISECONDS;
        case MICROSECONDS:
          return StandardUnit.MICROSECONDS;
        default:
          throw new IllegalArgumentException("Unsupported TimeUnit: " + timeUnit);
      }
    }
  }
}

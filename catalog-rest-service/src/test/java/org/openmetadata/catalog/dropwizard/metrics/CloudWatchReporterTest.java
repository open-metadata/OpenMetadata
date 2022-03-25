package org.openmetadata.catalog.dropwizard.metrics;

import static com.google.common.truth.Truth.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.openmetadata.catalog.dropwizard.metrics.CloudWatchReporter.DIMENSION_COUNT;
import static org.openmetadata.catalog.dropwizard.metrics.CloudWatchReporter.DIMENSION_GAUGE;
import static org.openmetadata.catalog.dropwizard.metrics.CloudWatchReporter.DIMENSION_NAME_TYPE;
import static org.openmetadata.catalog.dropwizard.metrics.CloudWatchReporter.DIMENSION_SNAPSHOT_MEAN;
import static org.openmetadata.catalog.dropwizard.metrics.CloudWatchReporter.DIMENSION_SNAPSHOT_STD_DEV;
import static org.openmetadata.catalog.dropwizard.metrics.CloudWatchReporter.DIMENSION_SNAPSHOT_SUMMARY;

import com.codahale.metrics.ExponentialMovingAverages;
import com.codahale.metrics.Gauge;
import com.codahale.metrics.Histogram;
import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.SlidingWindowReservoir;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.LinkedList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;
import software.amazon.awssdk.services.cloudwatch.model.MetricDatum;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataRequest;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataResponse;
import software.amazon.awssdk.services.cloudwatch.model.StandardUnit;

@ExtendWith(MockitoExtension.class)
public class CloudWatchReporterTest {
  private static final String NAMESPACE = "namespace";
  private static final String ARBITRARY_COUNTER_NAME = "TheCounter";
  private static final String ARBITRARY_METER_NAME = "TheMeter";
  private static final String ARBITRARY_HISTOGRAM_NAME = "TheHistogram";
  private static final String ARBITRARY_TIMER_NAME = "TheTimer";
  private static final String ARBITRARY_GAUGE_NAME = "TheGauge";

  @Mock private CloudWatchAsyncClient mockAmazonCloudWatchAsyncClient;

  @Mock private CompletableFuture<PutMetricDataResponse> mockPutMetricDataResultFuture;

  @Captor private ArgumentCaptor<PutMetricDataRequest> metricDataRequestCaptor;

  private MetricRegistry metricRegistry;
  private CloudWatchReporter.Builder reporterBuilder;

  @BeforeAll
  public static void beforeClass() throws Exception {
    reduceExponentialMovingAveragesDefaultTickInterval();
  }

  @BeforeEach
  public void setUp() throws Exception {
    metricRegistry = new MetricRegistry();
    reporterBuilder = CloudWatchReporter.forRegistry(metricRegistry, mockAmazonCloudWatchAsyncClient, NAMESPACE);
    lenient()
        .when(mockAmazonCloudWatchAsyncClient.putMetricData(metricDataRequestCaptor.capture()))
        .thenReturn(mockPutMetricDataResultFuture);
  }

  @Test
  public void shouldNotInvokeCloudWatchClientInDryRunMode() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.withDryRun().build().report();

    verify(mockAmazonCloudWatchAsyncClient, never()).putMetricData(any(PutMetricDataRequest.class));
  }

  @Test
  public void notSettingHighResolutionGeneratesMetricsWithStorageResolutionSetToSixty() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.build().report();

    final MetricDatum firstMetricDatum = firstMetricDatumFromCapturedRequest();

    assertThat(firstMetricDatum.storageResolution()).isEqualTo(60);
  }

  @Test
  public void settingHighResolutionGeneratesMetricsWithStorageResolutionSetToOne() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.withHighResolution().build().report();

    final MetricDatum firstMetricDatum = firstMetricDatumFromCapturedRequest();

    assertThat(firstMetricDatum.storageResolution()).isEqualTo(1);
  }

  @Test
  public void shouldReportWithoutGlobalDimensionsWhenGlobalDimensionsNotConfigured() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.build().report(); // When 'withGlobalDimensions' was not called

    final List<Dimension> dimensions = firstMetricDatumDimensionsFromCapturedRequest();

    assertThat(dimensions).hasSize(1);
    assertThat(dimensions).contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value(DIMENSION_COUNT).build());
  }

  @Test
  public void reportedCounterShouldContainExpectedDimension() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.build().report();

    final List<Dimension> dimensions = firstMetricDatumDimensionsFromCapturedRequest();

    assertThat(dimensions).contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value(DIMENSION_COUNT).build());
  }

  @Test
  public void reportedGaugesAreInvokedOnlyOnce() {
    Gauge<Long> theGauge =
        spy(
            new Gauge<Long>() {
              @Override
              public Long getValue() {
                return 1L;
              }
            });
    metricRegistry.register(ARBITRARY_GAUGE_NAME, theGauge);
    reporterBuilder.build().report();

    verify(theGauge).getValue();
  }

  @Test
  public void reportedGaugeShouldContainExpectedDimension() throws Exception {
    metricRegistry.register(ARBITRARY_GAUGE_NAME, (Gauge<Long>) () -> 1L);
    reporterBuilder.build().report();

    final List<Dimension> dimensions = firstMetricDatumDimensionsFromCapturedRequest();

    assertThat(dimensions).contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value(DIMENSION_GAUGE).build());
  }

  @Test
  public void shouldNotReportGaugeWhenMetricValueNotOfTypeNumber() throws Exception {
    metricRegistry.register(ARBITRARY_GAUGE_NAME, (Gauge<String>) () -> "bad value type");
    reporterBuilder.build().report();

    verify(mockAmazonCloudWatchAsyncClient, never()).putMetricData(any(PutMetricDataRequest.class));
  }

  @Test
  public void neverReportMetersCountersGaugesWithZeroValues() throws Exception {
    metricRegistry.register(ARBITRARY_GAUGE_NAME, (Gauge<Long>) () -> 0L);
    metricRegistry.meter(ARBITRARY_METER_NAME).mark(0);
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc(0);

    buildReportWithSleep(
        reporterBuilder
            .withArithmeticMean()
            .withOneMinuteMeanRate()
            .withFiveMinuteMeanRate()
            .withFifteenMinuteMeanRate()
            .withMeanRate());

    verify(mockAmazonCloudWatchAsyncClient, never()).putMetricData(any(PutMetricDataRequest.class));
  }

  @Test
  public void reportMetersCountersGaugesWithZeroValuesOnlyWhenConfigured() throws Exception {
    metricRegistry.register(ARBITRARY_GAUGE_NAME, (Gauge<Long>) () -> 0L);
    metricRegistry.meter(ARBITRARY_METER_NAME).mark(0);
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc(0);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(-1L, TimeUnit.NANOSECONDS);

    buildReportWithSleep(
        reporterBuilder
            .withArithmeticMean()
            .withOneMinuteMeanRate()
            .withFiveMinuteMeanRate()
            .withFifteenMinuteMeanRate()
            .withZeroValuesSubmission()
            .withMeanRate());

    verify(mockAmazonCloudWatchAsyncClient, times(1)).putMetricData(metricDataRequestCaptor.capture());

    final PutMetricDataRequest putMetricDataRequest = metricDataRequestCaptor.getValue();
    final List<MetricDatum> metricData = putMetricDataRequest.metricData();
    for (final MetricDatum metricDatum : metricData) {
      assertThat(metricDatum.value()).isEqualTo(0.0);
    }
  }

  @Test
  public void reportedMeterShouldContainExpectedOneMinuteMeanRateDimension() throws Exception {
    metricRegistry.meter(ARBITRARY_METER_NAME).mark(1);
    buildReportWithSleep(reporterBuilder.withOneMinuteMeanRate());

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value("1-min-mean-rate [per-second]").build());
  }

  @Test
  public void reportedMeterShouldContainExpectedFiveMinuteMeanRateDimension() throws Exception {
    metricRegistry.meter(ARBITRARY_METER_NAME).mark(1);
    buildReportWithSleep(reporterBuilder.withFiveMinuteMeanRate());

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value("5-min-mean-rate [per-second]").build());
  }

  @Test
  public void reportedMeterShouldContainExpectedFifteenMinuteMeanRateDimension() throws Exception {
    metricRegistry.meter(ARBITRARY_METER_NAME).mark(1);
    buildReportWithSleep(reporterBuilder.withFifteenMinuteMeanRate());

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value("15-min-mean-rate [per-second]").build());
  }

  @Test
  public void reportedMeterShouldContainExpectedMeanRateDimension() throws Exception {
    metricRegistry.meter(ARBITRARY_METER_NAME).mark(1);
    reporterBuilder.withMeanRate().build().report();

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value("mean-rate [per-second]").build());
  }

  @Test
  public void reportedMeterShouldHaveChangedUnit() throws Exception {
    metricRegistry.meter(ARBITRARY_METER_NAME).mark(1);
    CloudWatchReporter.Builder builder = reporterBuilder.withMeanRate().withMeterUnitSentToCW(StandardUnit.TERABYTES);
    CloudWatchReporter cloudWatchReporter = builder.build();
    cloudWatchReporter.report();

    final List<MetricDatum> metricData = allMetricDataFromCapturedRequests();

    List<MetricDatum> filtered =
        metricData.stream().filter(x -> !x.unit().equals(StandardUnit.COUNT)).collect(Collectors.toList());

    assertThat(filtered.size()).isEqualTo(1);
    assertThat(filtered.get(0).unit()).isEqualTo(StandardUnit.TERABYTES);
  }

  @Test
  public void reportedHistogramShouldContainExpectedArithmeticMeanDimension() throws Exception {
    metricRegistry.histogram(ARBITRARY_HISTOGRAM_NAME).update(1);
    reporterBuilder.withArithmeticMean().build().report();

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value(DIMENSION_SNAPSHOT_MEAN).build());
  }

  @Test
  public void reportedHistogramShouldContainExpectedStdDevDimension() throws Exception {
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(1);
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(2);
    reporterBuilder.withStdDev().build().report();

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value(DIMENSION_SNAPSHOT_STD_DEV).build());
  }

  @Test
  public void reportedTimerShouldContainExpectedArithmeticMeanDimension() throws Exception {
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(3, TimeUnit.MILLISECONDS);
    reporterBuilder.withArithmeticMean().build().report();

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value("snapshot-mean [in-milliseconds]").build());
  }

  @Test
  public void reportedTimerShouldContainExpectedStdDevDimension() throws Exception {
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(1, TimeUnit.MILLISECONDS);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(3, TimeUnit.MILLISECONDS);
    reporterBuilder.withStdDev().build().report();

    final List<Dimension> dimensions = allDimensionsFromCapturedRequest();

    assertThat(dimensions)
        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value("snapshot-std-dev [in-milliseconds]").build());
  }

  @Test
  public void shouldReportExpectedSingleGlobalDimension() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.withGlobalDimensions("Region=us-west-2").build().report();

    final List<Dimension> dimensions = firstMetricDatumDimensionsFromCapturedRequest();

    assertThat(dimensions).contains(Dimension.builder().name("Region").value("us-west-2").build());
  }

  @Test
  public void shouldReportExpectedGlobalAndCustomDimensions() throws Exception {

    metricRegistry
        .counter(
            DimensionedName.withName(ARBITRARY_COUNTER_NAME)
                .withDimension("key1", "value1")
                .withDimension("key2", "value2")
                .build()
                .encode())
        .inc();
    reporterBuilder.withGlobalDimensions("Region=us-west-2").build().report();

    final List<Dimension> dimensions = firstMetricDatumDimensionsFromCapturedRequest();

    assertThat(dimensions).contains(Dimension.builder().name("Region").value("us-west-2").build());
    assertThat(dimensions).contains(Dimension.builder().name("key1").value("value1").build());
    assertThat(dimensions).contains(Dimension.builder().name("key2").value("value2").build());
  }

  @Test
  public void shouldReportExpectedMultipleGlobalDimensions() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.withGlobalDimensions("Region=us-west-2", "Instance=stage").build().report();

    final List<Dimension> dimensions = firstMetricDatumDimensionsFromCapturedRequest();

    assertThat(dimensions).contains(Dimension.builder().name("Region").value("us-west-2").build());
    assertThat(dimensions).contains(Dimension.builder().name("Instance").value("stage").build());
  }

  @Test
  public void shouldNotReportDuplicateGlobalDimensions() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.withGlobalDimensions("Region=us-west-2", "Region=us-west-2").build().report();

    final List<Dimension> dimensions = firstMetricDatumDimensionsFromCapturedRequest();

    assertThat(dimensions).containsNoDuplicates();
  }

  @Test
  public void shouldReportExpectedCounterValue() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    reporterBuilder.build().report();

    final MetricDatum metricDatum = firstMetricDatumFromCapturedRequest();

    assertThat(metricDatum.value()).isWithin(1.0);
    assertThat(metricDatum.unit()).isEqualTo(StandardUnit.COUNT);
  }

  @Test
  public void shouldNotReportUnchangedCounterValue() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    final CloudWatchReporter cloudWatchReporter = reporterBuilder.build();

    cloudWatchReporter.report();
    MetricDatum metricDatum = firstMetricDatumFromCapturedRequest();
    assertThat(metricDatum.value().intValue()).isEqualTo(1);
    metricDataRequestCaptor.getAllValues().clear();

    cloudWatchReporter.report();

    verify(mockAmazonCloudWatchAsyncClient, times(1)).putMetricData(any(PutMetricDataRequest.class));
  }

  @Test
  public void shouldReportCounterValueDelta() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    final CloudWatchReporter cloudWatchReporter = reporterBuilder.build();

    cloudWatchReporter.report();
    MetricDatum metricDatum = firstMetricDatumFromCapturedRequest();
    assertThat(metricDatum.value().intValue()).isEqualTo(2);
    metricDataRequestCaptor.getAllValues().clear();

    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();

    cloudWatchReporter.report();
    metricDatum = firstMetricDatumFromCapturedRequest();
    assertThat(metricDatum.value().intValue()).isEqualTo(6);

    verify(mockAmazonCloudWatchAsyncClient, times(2)).putMetricData(any(PutMetricDataRequest.class));
  }

  @Test
  public void shouldReportArithmeticMeanAfterConversionByDefaultDurationWhenReportingTimer() throws Exception {
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(1_000_000, TimeUnit.NANOSECONDS);
    reporterBuilder.withArithmeticMean().build().report();

    final MetricDatum metricData = metricDatumByDimensionFromCapturedRequest("snapshot-mean [in-milliseconds]");

    assertThat(metricData.value().intValue()).isEqualTo(1);
    assertThat(metricData.unit()).isEqualTo(StandardUnit.MILLISECONDS);
  }

  @Test
  public void shouldReportStdDevAfterConversionByDefaultDurationWhenReportingTimer() throws Exception {
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(1_000_000, TimeUnit.NANOSECONDS);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(2_000_000, TimeUnit.NANOSECONDS);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(3_000_000, TimeUnit.NANOSECONDS);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(30_000_000, TimeUnit.NANOSECONDS);
    reporterBuilder.withStdDev().build().report();

    final MetricDatum metricData = metricDatumByDimensionFromCapturedRequest("snapshot-std-dev [in-milliseconds]");

    assertThat(metricData.value().intValue()).isEqualTo(12);
    assertThat(metricData.unit()).isEqualTo(StandardUnit.MILLISECONDS);
  }

  @Test
  public void shouldReportSnapshotValuesAfterConversionByCustomDurationWhenReportingTimer() throws Exception {
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(1, TimeUnit.SECONDS);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(2, TimeUnit.SECONDS);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(3, TimeUnit.SECONDS);
    metricRegistry.timer(ARBITRARY_TIMER_NAME).update(30, TimeUnit.SECONDS);
    reporterBuilder.withStatisticSet().convertDurationsTo(TimeUnit.MICROSECONDS).build().report();

    final MetricDatum metricData = metricDatumByDimensionFromCapturedRequest(DIMENSION_SNAPSHOT_SUMMARY);

    assertThat(metricData.statisticValues().sum().intValue()).isEqualTo(36_000_000);
    assertThat(metricData.statisticValues().maximum().intValue()).isEqualTo(30_000_000);
    assertThat(metricData.statisticValues().minimum().intValue()).isEqualTo(1_000_000);
    assertThat(metricData.statisticValues().sampleCount().intValue()).isEqualTo(4);
    assertThat(metricData.unit()).isEqualTo(StandardUnit.MICROSECONDS);
  }

  @Test
  public void shouldReportArithmeticMeanWithoutConversionWhenReportingHistogram() throws Exception {
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(1);
    reporterBuilder.withArithmeticMean().build().report();

    final MetricDatum metricData = metricDatumByDimensionFromCapturedRequest(DIMENSION_SNAPSHOT_MEAN);

    assertThat(metricData.value().intValue()).isEqualTo(1);
    assertThat(metricData.unit()).isEqualTo(StandardUnit.NONE);
  }

  @Test
  public void shouldReportStdDevWithoutConversionWhenReportingHistogram() throws Exception {
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(1);
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(2);
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(3);
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(30);
    reporterBuilder.withStdDev().build().report();

    final MetricDatum metricData = metricDatumByDimensionFromCapturedRequest(DIMENSION_SNAPSHOT_STD_DEV);

    assertThat(metricData.value().intValue()).isEqualTo(12);
    assertThat(metricData.unit()).isEqualTo(StandardUnit.NONE);
  }

  @Test
  public void shouldReportSnapshotValuesWithoutConversionWhenReportingHistogram() throws Exception {
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(1);
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(2);
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(3);
    metricRegistry.histogram(CloudWatchReporterTest.ARBITRARY_HISTOGRAM_NAME).update(30);
    reporterBuilder.withStatisticSet().build().report();

    final MetricDatum metricData = metricDatumByDimensionFromCapturedRequest(DIMENSION_SNAPSHOT_SUMMARY);

    assertThat(metricData.statisticValues().sum().intValue()).isEqualTo(36);
    assertThat(metricData.statisticValues().maximum().intValue()).isEqualTo(30);
    assertThat(metricData.statisticValues().minimum().intValue()).isEqualTo(1);
    assertThat(metricData.statisticValues().sampleCount().intValue()).isEqualTo(4);
    assertThat(metricData.unit()).isEqualTo(StandardUnit.NONE);
  }

  @Test
  public void shouldReportHistogramSubsequentSnapshotValues_SumMaxMinValues() throws Exception {
    CloudWatchReporter reporter = reporterBuilder.withStatisticSet().build();

    final Histogram slidingWindowHistogram = new Histogram(new SlidingWindowReservoir(4));
    metricRegistry.register("SlidingWindowHistogram", slidingWindowHistogram);

    slidingWindowHistogram.update(1);
    slidingWindowHistogram.update(2);
    slidingWindowHistogram.update(30);
    reporter.report();

    final MetricDatum metricData = metricDatumByDimensionFromCapturedRequest(DIMENSION_SNAPSHOT_SUMMARY);

    assertThat(metricData.statisticValues().maximum().intValue()).isEqualTo(30);
    assertThat(metricData.statisticValues().minimum().intValue()).isEqualTo(1);
    assertThat(metricData.statisticValues().sampleCount().intValue()).isEqualTo(3);
    assertThat(metricData.statisticValues().sum().intValue()).isEqualTo(33);
    assertThat(metricData.unit()).isEqualTo(StandardUnit.NONE);

    slidingWindowHistogram.update(4);
    slidingWindowHistogram.update(100);
    slidingWindowHistogram.update(5);
    slidingWindowHistogram.update(6);
    reporter.report();

    final MetricDatum secondMetricData = metricDatumByDimensionFromCapturedRequest(DIMENSION_SNAPSHOT_SUMMARY);

    assertThat(secondMetricData.statisticValues().maximum().intValue()).isEqualTo(100);
    assertThat(secondMetricData.statisticValues().minimum().intValue()).isEqualTo(4);
    assertThat(secondMetricData.statisticValues().sampleCount().intValue()).isEqualTo(4);
    assertThat(secondMetricData.statisticValues().sum().intValue()).isEqualTo(115);
    assertThat(secondMetricData.unit()).isEqualTo(StandardUnit.NONE);
  }

  @Test
  public void shouldNotReportCounterValueDeltaWhenReportingRawCountValue() throws Exception {
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    final CloudWatchReporter cloudWatchReporter = reporterBuilder.withReportRawCountValue().build();

    cloudWatchReporter.report();
    MetricDatum metricDatum = firstMetricDatumFromCapturedRequest();
    assertThat(metricDatum.value().intValue()).isEqualTo(2);
    metricDataRequestCaptor.getAllValues().clear();

    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();
    metricRegistry.counter(ARBITRARY_COUNTER_NAME).inc();

    cloudWatchReporter.report();
    metricDatum = firstMetricDatumFromCapturedRequest();
    assertThat(metricDatum.value().intValue()).isEqualTo(8);

    verify(mockAmazonCloudWatchAsyncClient, times(2)).putMetricData(any(PutMetricDataRequest.class));
  }

  private MetricDatum metricDatumByDimensionFromCapturedRequest(final String dimensionValue) {
    final PutMetricDataRequest putMetricDataRequest = metricDataRequestCaptor.getValue();
    final List<MetricDatum> metricData = putMetricDataRequest.metricData();

    final Optional<MetricDatum> metricDatumOptional =
        metricData.stream()
            .filter(
                metricDatum ->
                    metricDatum
                        .dimensions()
                        .contains(Dimension.builder().name(DIMENSION_NAME_TYPE).value(dimensionValue).build()))
            .findFirst();

    if (metricDatumOptional.isPresent()) {
      return metricDatumOptional.get();
    }

    throw new IllegalStateException("Could not find MetricDatum for Dimension value: " + dimensionValue);
  }

  private MetricDatum firstMetricDatumFromCapturedRequest() {
    final PutMetricDataRequest putMetricDataRequest = metricDataRequestCaptor.getValue();
    return putMetricDataRequest.metricData().get(0);
  }

  private List<MetricDatum> allMetricDataFromCapturedRequests() {
    final PutMetricDataRequest putMetricDataRequest = metricDataRequestCaptor.getValue();
    return putMetricDataRequest.metricData();
  }

  private List<Dimension> firstMetricDatumDimensionsFromCapturedRequest() {
    final PutMetricDataRequest putMetricDataRequest = metricDataRequestCaptor.getValue();
    final MetricDatum metricDatum = putMetricDataRequest.metricData().get(0);
    return metricDatum.dimensions();
  }

  private List<Dimension> allDimensionsFromCapturedRequest() {
    final PutMetricDataRequest putMetricDataRequest = metricDataRequestCaptor.getValue();
    final List<MetricDatum> metricData = putMetricDataRequest.metricData();
    final List<Dimension> all = new LinkedList<>();
    for (final MetricDatum metricDatum : metricData) {
      all.addAll(metricDatum.dimensions());
    }
    return all;
  }

  private void buildReportWithSleep(final CloudWatchReporter.Builder cloudWatchReporterBuilder)
      throws InterruptedException {
    final CloudWatchReporter cloudWatchReporter = cloudWatchReporterBuilder.build();
    Thread.sleep(10);
    cloudWatchReporter.report();
  }

  /**
   * @throws NoSuchFieldException
   * @throws IllegalAccessException
   * @see ExponentialMovingAverages#tickIfNecessary()
   */
  private static void reduceExponentialMovingAveragesDefaultTickInterval()
      throws NoSuchFieldException, IllegalAccessException {
    setFinalStaticField(ExponentialMovingAverages.class, "TICK_INTERVAL", TimeUnit.MILLISECONDS.toNanos(1));
  }

  private static void setFinalStaticField(final Class clazz, final String fieldName, long value)
      throws NoSuchFieldException, IllegalAccessException {
    final Field field = clazz.getDeclaredField(fieldName);
    field.setAccessible(true);
    final Field modifiers = field.getClass().getDeclaredField("modifiers");
    modifiers.setAccessible(true);
    modifiers.setInt(field, field.getModifiers() & ~Modifier.FINAL);
    field.set(null, value);
  }
}

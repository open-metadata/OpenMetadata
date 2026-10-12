package org.openmetadata.service.apps.bundles.dataRetention;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

class DataRetentionExtensionRegistryTest {

  private static final String FIRST_STEP = "first_step";
  private static final String SECOND_STEP = "second_step";
  private static final String INERT_STEP =
      InertTestRetentionExtension.NAME
          + "_"
          + InertTestRetentionExtension.DEFAULT_RETENTION_DAYS
          + "d";

  /** A provider that contributes nothing but a name, for ordering and isolation assertions. */
  private record StubExtension(String name, List<RetentionStep> contributed, Throwable blowUp)
      implements DataRetentionExtension {

    @Override
    public List<RetentionStep> steps(DataRetentionConfiguration configuration) {
      if (blowUp instanceof RuntimeException runtimeFailure) {
        throw runtimeFailure;
      }
      if (blowUp instanceof Error errorFailure) {
        throw errorFailure;
      }
      return contributed;
    }
  }

  private static RetentionStep noOpStep(String statsKey) {
    return new RetentionStep(statsKey, batchSize -> 0);
  }

  private static List<String> statsKeys(List<RetentionStep> steps) {
    return steps.stream().map(RetentionStep::statsKey).toList();
  }

  /**
   * A classloader serving a throwaway {@code META-INF/services} registration. Scoping it to the
   * test keeps the providers off the classpath of every other test in this module, which a real
   * {@code src/test/resources} registration would not.
   */
  private static ClassLoader registering(Path directory, Class<?>... providers) throws IOException {
    return registeringNames(
        directory, List.of(providers).stream().map(Class::getName).toArray(String[]::new));
  }

  private static ClassLoader registeringNames(Path directory, String... providerNames)
      throws IOException {
    Path services = Files.createDirectories(directory.resolve("META-INF").resolve("services"));
    Files.writeString(
        services.resolve(DataRetentionExtension.class.getName()), String.join("\n", providerNames));
    return new URLClassLoader(
        new URL[] {directory.toUri().toURL()},
        DataRetentionExtensionRegistryTest.class.getClassLoader());
  }

  private static ClassLoader linkageFailingClassLoader(
      Path directory, String failingClass, String... providerNames) throws IOException {
    Path services = Files.createDirectories(directory.resolve("META-INF").resolve("services"));
    Files.writeString(
        services.resolve(DataRetentionExtension.class.getName()), String.join("\n", providerNames));
    return new URLClassLoader(
        new URL[] {directory.toUri().toURL()},
        DataRetentionExtensionRegistryTest.class.getClassLoader()) {
      @Override
      public Class<?> loadClass(String name) throws ClassNotFoundException {
        if (failingClass.equals(name)) {
          throw new NoClassDefFoundError(name.replace('.', '/'));
        }
        return super.loadClass(name);
      }
    };
  }

  @Test
  void discoverFindsExtensionsRegisteredViaServiceLoader(@TempDir Path registrations)
      throws IOException {
    ClassLoader classLoader = registering(registrations, InertTestRetentionExtension.class);

    List<RetentionStep> steps =
        DataRetentionExtensionRegistry.discover(classLoader).resolveSteps(null, failure -> {});

    assertEquals(List.of(INERT_STEP), statsKeys(steps));
  }

  @Test
  void discoverFindsNothingWhenNoProviderIsRegistered(@TempDir Path registrations)
      throws IOException {
    ClassLoader classLoader = registeringNames(registrations);

    List<RetentionStep> steps =
        DataRetentionExtensionRegistry.discover(classLoader).resolveSteps(null, failure -> {});

    assertTrue(steps.isEmpty());
  }

  @Test
  void discoverSkipsARegistrationNamingAClassThatIsNotOnTheClasspath(@TempDir Path registrations)
      throws IOException {
    ClassLoader classLoader =
        registeringNames(
            registrations,
            "org.openmetadata.service.apps.bundles.dataRetention.NoSuchRetentionExtension",
            InertTestRetentionExtension.class.getName());

    List<RetentionStep> steps =
        DataRetentionExtensionRegistry.discover(classLoader).resolveSteps(null, failure -> {});

    assertEquals(
        List.of(INERT_STEP),
        statsKeys(steps),
        "an unreadable registration must not hide the healthy provider behind it");
  }

  /**
   * A provider class whose superclass or implemented interface is missing fails during {@code
   * Class.forName}, inside {@code ServiceLoader}'s own iterator. That surfaces as a bare {@link
   * NoClassDefFoundError}, not the {@link java.util.ServiceConfigurationError} the loader wraps a
   * plain missing class in, so it escapes discovery unless the iteration guard covers LinkageError.
   */
  @Test
  void discoverSkipsAProviderThatFailsToLink(@TempDir Path registrations) throws IOException {
    String unlinkable = "org.openmetadata.service.apps.bundles.dataRetention.UnlinkableExtension";
    ClassLoader classLoader =
        linkageFailingClassLoader(
            registrations, unlinkable, unlinkable, InertTestRetentionExtension.class.getName());

    List<RetentionStep> steps =
        DataRetentionExtensionRegistry.discover(classLoader).resolveSteps(null, failure -> {});

    assertEquals(
        List.of(INERT_STEP),
        statsKeys(steps),
        "a provider that fails to link must not take DataRetention's constructor down with it");
  }

  @Test
  void discoverSkipsAProviderWhoseConstructorThrows(@TempDir Path registrations)
      throws IOException {
    ClassLoader classLoader =
        registering(
            registrations,
            ExplodingTestRetentionExtension.class,
            InertTestRetentionExtension.class);

    List<RetentionStep> steps =
        DataRetentionExtensionRegistry.discover(classLoader).resolveSteps(null, failure -> {});

    assertEquals(
        List.of(INERT_STEP),
        statsKeys(steps),
        "a provider that cannot be constructed must not stop DataRetention from starting");
  }

  @Test
  void resolveStepsKeepsExtensionAndStepOrder() {
    DataRetentionExtensionRegistry registry =
        new DataRetentionExtensionRegistry(
            List.of(
                new StubExtension("first", List.of(noOpStep(FIRST_STEP)), null),
                new StubExtension("second", List.of(noOpStep(SECOND_STEP)), null)));

    List<RetentionStep> steps = registry.resolveSteps(null, failure -> {});

    assertEquals(List.of(FIRST_STEP, SECOND_STEP), statsKeys(steps));
  }

  @Test
  void aThrowingExtensionIsReportedAndDoesNotStopTheOthers() {
    RuntimeException failure = new IllegalStateException("provider is broken");
    DataRetentionExtensionRegistry registry =
        new DataRetentionExtensionRegistry(
            List.of(
                new StubExtension("broken", null, failure),
                new StubExtension("healthy", List.of(noOpStep(SECOND_STEP)), null)));
    List<Throwable> reported = new ArrayList<>();

    List<RetentionStep> steps = registry.resolveSteps(null, reported::add);

    assertEquals(List.of(SECOND_STEP), statsKeys(steps));
    assertEquals(1, reported.size());
    assertSame(failure, reported.get(0));
  }

  @Test
  void anExtensionMissingADependencyIsReportedAndDoesNotStopTheOthers() {
    Error failure = new NoClassDefFoundError("com/example/MissingDao");
    DataRetentionExtensionRegistry registry =
        new DataRetentionExtensionRegistry(
            List.of(
                new StubExtension("halfDeployed", null, failure),
                new StubExtension("healthy", List.of(noOpStep(SECOND_STEP)), null)));
    List<Throwable> reported = new ArrayList<>();

    List<RetentionStep> steps = registry.resolveSteps(null, reported::add);

    assertEquals(List.of(SECOND_STEP), statsKeys(steps));
    assertSame(failure, reported.get(0));
  }

  @Test
  void anExtensionThatCannotEvenReportItsNameIsStillIsolated() {
    RuntimeException failure = new IllegalStateException("provider is broken");
    DataRetentionExtension nameless =
        new DataRetentionExtension() {
          @Override
          public String name() {
            throw new UnsupportedOperationException("no name either");
          }

          @Override
          public List<RetentionStep> steps(DataRetentionConfiguration configuration) {
            throw failure;
          }
        };
    DataRetentionExtensionRegistry registry =
        new DataRetentionExtensionRegistry(
            List.of(nameless, new StubExtension("healthy", List.of(noOpStep(SECOND_STEP)), null)));
    List<Throwable> reported = new ArrayList<>();

    List<RetentionStep> steps = registry.resolveSteps(null, reported::add);

    assertEquals(List.of(SECOND_STEP), statsKeys(steps));
    assertSame(failure, reported.get(0));
  }

  @Test
  void anExtensionReturningNoStepsContributesNothing() {
    DataRetentionExtensionRegistry registry =
        new DataRetentionExtensionRegistry(List.of(new StubExtension("silent", null, null)));

    List<RetentionStep> steps = registry.resolveSteps(null, failure -> {});

    assertTrue(steps.isEmpty());
  }

  @Test
  void nullStepsFromAnExtensionAreDropped() {
    List<RetentionStep> contributed = new ArrayList<>();
    contributed.add(null);
    contributed.add(noOpStep(FIRST_STEP));
    DataRetentionExtensionRegistry registry =
        new DataRetentionExtensionRegistry(List.of(new StubExtension("sloppy", contributed, null)));

    List<RetentionStep> steps = registry.resolveSteps(null, failure -> {});

    assertEquals(List.of(FIRST_STEP), statsKeys(steps));
  }

  @Test
  void retentionPeriodFallsBackToTheExtensionDefaultWhenUnconfigured() {
    DataRetentionExtension extension = new InertTestRetentionExtension();

    assertEquals(30, extension.retentionPeriodDays(null, 30));
    assertEquals(30, extension.retentionPeriodDays(new DataRetentionConfiguration(), 30));
  }

  @Test
  void retentionPeriodReadsTheOperatorsValueForThisExtension() {
    DataRetentionExtension extension = new InertTestRetentionExtension();
    DataRetentionConfiguration configuration =
        new DataRetentionConfiguration()
            .withExtensions(Map.of(InertTestRetentionExtension.NAME, 3, "someOtherExtension", 90));

    assertEquals(3, extension.retentionPeriodDays(configuration, 30));
  }

  @Test
  void aStepDrainsUntilItReturnsLessThanABatch() {
    AtomicInteger remaining = new AtomicInteger(25);
    RetentionStep step =
        new RetentionStep(
            FIRST_STEP,
            batchSize -> {
              int deleted = Math.min(batchSize, remaining.get());
              remaining.addAndGet(-deleted);
              return deleted;
            });

    int batchSize = 10;
    int totalDeleted = 0;
    int deleted;
    do {
      deleted = step.deleter().deleteBatch(batchSize);
      totalDeleted += deleted;
    } while (deleted == batchSize);

    assertEquals(25, totalDeleted);
    assertEquals(0, remaining.get());
  }

  @Test
  void aStepWithoutAStatsKeyOrDeleterIsRejected() {
    assertThrows(IllegalArgumentException.class, () -> new RetentionStep("", batchSize -> 0));
    assertThrows(IllegalArgumentException.class, () -> new RetentionStep(null, batchSize -> 0));
    assertThrows(NullPointerException.class, () -> new RetentionStep(FIRST_STEP, null));
    assertNotNull(noOpStep(FIRST_STEP));
  }
}

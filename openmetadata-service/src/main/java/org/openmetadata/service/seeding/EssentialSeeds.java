package org.openmetadata.service.seeding;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.seeding.EssentialSeedReport.MissingArtifact;
import org.openmetadata.service.seeding.EssentialSeedReport.SeedFailure;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * System artifacts whose absence silently disables product features (e.g. system bots). Each type
 * declares its expected names from its seed files; {@link #report()} checks them against the
 * database on every call, so artifacts removed after startup are reported too.
 */
@Slf4j
public final class EssentialSeeds {

  private static final int MAX_ERROR_LENGTH = 300;
  private static final EssentialSeeds INSTANCE =
      new EssentialSeeds(EssentialSeeds::existsInDatabase);

  private final BiPredicate<String, String> exists;
  private final Map<String, List<String>> expectedByType = new LinkedHashMap<>();
  private final List<SeedFailure> failures = new ArrayList<>();

  EssentialSeeds(BiPredicate<String, String> exists) {
    this.exists = exists;
  }

  public static EssentialSeeds getInstance() {
    return INSTANCE;
  }

  public synchronized void register(String entityType, List<String> expectedNames) {
    expectedByType.put(entityType, List.copyOf(expectedNames));
  }

  public <T> void seedEach(
      String entityType, List<T> items, Function<T, String> nameOf, Consumer<T> seeder) {
    items.forEach(item -> seedOne(entityType, nameOf.apply(item), () -> seeder.accept(item)));
  }

  public synchronized EssentialSeedReport report() {
    return reportFor(entityType -> true);
  }

  public synchronized EssentialSeedReport report(Set<String> entityTypes) {
    return reportFor(entityTypes::contains);
  }

  public synchronized List<String> expectedNames(String entityType) {
    return expectedByType.getOrDefault(entityType, List.of());
  }

  private EssentialSeedReport reportFor(Predicate<String> includesType) {
    List<MissingArtifact> missing =
        expectedByType.entrySet().stream()
            .filter(expected -> includesType.test(expected.getKey()))
            .flatMap(
                expected ->
                    expected.getValue().stream()
                        .map(name -> new MissingArtifact(expected.getKey(), name)))
            .filter(artifact -> !exists.test(artifact.entityType(), artifact.name()))
            .toList();
    List<SeedFailure> matching =
        failures.stream().filter(failure -> includesType.test(failure.entityType())).toList();
    return new EssentialSeedReport(missing, matching);
  }

  public synchronized void reset() {
    expectedByType.clear();
    failures.clear();
  }

  private void seedOne(String entityType, String itemName, Runnable seeder) {
    try {
      seeder.run();
    } catch (RuntimeException e) {
      // Broad on purpose: one system artifact failing must not abort seeding the rest.
      LOG.error("Essential seed {} failed for {}: {}", entityType, itemName, e.getMessage(), e);
      recordFailure(entityType, itemName, e);
    }
  }

  private synchronized void recordFailure(
      String entityType, String itemName, RuntimeException cause) {
    // Skills and personas are seeded from two resources in one startup; report each failure once.
    SeedFailure failure = new SeedFailure(entityType, itemName, describe(cause));
    if (!failures.contains(failure)) {
      failures.add(failure);
    }
    SeedDataGate.getInstance().recordSeedFailure();
  }

  private static String describe(RuntimeException cause) {
    String message =
        Objects.requireNonNullElse(cause.getMessage(), cause.getClass().getSimpleName());
    return message.length() > MAX_ERROR_LENGTH
        ? message.substring(0, MAX_ERROR_LENGTH) + "..."
        : message;
  }

  private static boolean existsInDatabase(String entityType, String name) {
    return Entity.getEntityRepository(entityType)
            .findByNameOrNull(FullyQualifiedName.quoteName(name), Include.NON_DELETED)
        != null;
  }
}

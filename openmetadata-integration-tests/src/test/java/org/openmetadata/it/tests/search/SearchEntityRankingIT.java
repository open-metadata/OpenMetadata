package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.tests.search.EntitySeeder.Placement;
import org.openmetadata.it.tests.search.RankingSupport.SearchResult;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * End-to-end ranking coverage per searchable entity type. Every asset type shares the same
 * common-field boosts (name/displayName over description) and the same global term / value boosts,
 * so the ranking paths are asserted uniformly, driven by one {@link EntitySeeder} per type that
 * knows how to place a token in each field:
 *
 * <ol>
 *   <li>a name match outranks a description-only match (higher field boost),
 *   <li>a displayName match outranks a description-only match,
 *   <li>an exact displayName match ranks at least as high as a partial one ({@code
 *       displayName.keyword} exact vs {@code displayName} phrase),
 *   <li>on a text tie (identical displayName) a {@code Tier.Tier1}-tagged entity outranks an
 *       untagged one (global term boost),
 *   <li>the entity's distinctive nested field (columns / charts / tasks / synonyms / …) is itself
 *       searchable.
 * </ol>
 *
 * Each entity is one parameterized case; every failure across the checks is collected and reported
 * together. Seeding uses {@link SdkClients#adminClient()} so any entity type is reachable.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class SearchEntityRankingIT {

  private record Case(
      Placement high,
      boolean tierHigh,
      Placement low,
      boolean tierLow,
      boolean allowEqual,
      String label) {}

  private static final List<Case> CASES =
      List.of(
          new Case(
              Placement.NAME, false, Placement.DESCRIPTION, false, false, "name > description"),
          new Case(
              Placement.DISPLAY_NAME_PHRASE,
              false,
              Placement.DESCRIPTION,
              false,
              false,
              "displayName > description"),
          new Case(
              Placement.DISPLAY_NAME_EXACT,
              false,
              Placement.DISPLAY_NAME_PHRASE,
              false,
              true,
              "exact displayName >= partial"),
          new Case(
              Placement.DISPLAY_NAME_EXACT,
              true,
              Placement.DISPLAY_NAME_EXACT,
              false,
              false,
              "Tier1 > untagged on a text tie"));

  static Stream<Arguments> seeders() {
    return EntityRankingSeeders.all().stream()
        .map(seeder -> Arguments.of(Named.of(seeder.entityType(), seeder)));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("seeders")
  void entityRanking(EntitySeeder seeder, TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String parent = seeder.setup(client, ns);

    List<String> failures = new ArrayList<>();
    for (Case testCase : CASES) {
      evaluateCase(client, ns, seeder, parent, testCase, failures);
    }
    if (seeder.hasDistinctive()) {
      evaluateDistinctive(client, ns, seeder, parent, failures);
    }
    assertTrue(
        failures.isEmpty(),
        seeder.entityType() + " ranking failures:\n  - " + String.join("\n  - ", failures));
  }

  private void evaluateCase(
      OpenMetadataClient client,
      TestNamespace ns,
      EntitySeeder seeder,
      String parent,
      Case testCase,
      List<String> failures) {
    String term = RankingSupport.uniqueTerm(ns);
    String high = seeder.seed(client, ns, parent, term, testCase.high(), testCase.tierHigh());
    String low = seeder.seed(client, ns, parent, term, testCase.low(), testCase.tierLow());
    boolean bothIndexed =
        RankingSupport.awaitTrue(
            () -> {
              SearchResult polled = RankingSupport.search(client, seeder.index(), term);
              return polled.contains(high) && polled.contains(low);
            });
    if (!bothIndexed) {
      failures.add(testCase.label() + ": both documents were not indexed in time");
      return;
    }
    SearchResult result = RankingSupport.search(client, seeder.index(), term);
    int rankHigh = result.rankOf(high).orElse(Integer.MAX_VALUE);
    int rankLow = result.rankOf(low).orElse(Integer.MAX_VALUE);
    boolean ok = testCase.allowEqual() ? rankHigh <= rankLow : rankHigh < rankLow;
    if (!ok) {
      failures.add(
          testCase.label()
              + ": expected ["
              + high
              + "] "
              + (testCase.allowEqual() ? ">=" : ">")
              + " ["
              + low
              + "] but ranks were "
              + rankHigh
              + " vs "
              + rankLow
              + " -> "
              + result.names());
    }
  }

  private void evaluateDistinctive(
      OpenMetadataClient client,
      TestNamespace ns,
      EntitySeeder seeder,
      String parent,
      List<String> failures) {
    String term = RankingSupport.uniqueTerm(ns);
    String name = seeder.seed(client, ns, parent, term, Placement.DISTINCTIVE, false);
    boolean found =
        RankingSupport.awaitTrue(
            () -> RankingSupport.search(client, seeder.index(), term).contains(name));
    if (!found) {
      failures.add(
          "distinctive field: ["
              + name
              + "] not found by its nested-field token -> "
              + RankingSupport.search(client, seeder.index(), term).names());
    }
  }
}

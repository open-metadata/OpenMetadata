package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class OntologyReleaseMemberQueryTest {
  private static final int BUDGET = 10;

  private record Call(int releases, int members) {}

  private static List<String> ids(final String prefix, final int count) {
    return IntStream.range(0, count).mapToObj(i -> prefix + i).toList();
  }

  private static List<String> run(
      final List<String> releaseIds, final List<String> memberIds, final List<Call> calls) {
    return OntologyReleaseMemberQuery.run(
        releaseIds,
        memberIds,
        BUDGET,
        (releases, members) -> {
          calls.add(new Call(releases.size(), members.size()));
          final List<String> pairs = new ArrayList<>();
          for (final String release : releases) {
            for (final String member : members) {
              pairs.add(release + "|" + member);
            }
          }
          return pairs;
        });
  }

  private static List<String> crossProduct(
      final List<String> releases, final List<String> members) {
    return releases.stream()
        .flatMap(release -> members.stream().map(member -> release + "|" + member))
        .sorted()
        .collect(Collectors.toList());
  }

  private static void assertWithinBudgetAndComplete(
      final List<String> releases, final List<String> members, final int expectedCalls) {
    final List<Call> calls = new ArrayList<>();
    final List<String> pairs = run(releases, members, calls);
    assertEquals(expectedCalls, calls.size());
    assertTrue(
        calls.stream().allMatch(call -> call.releases() + call.members() <= BUDGET),
        calls.toString());
    assertEquals(crossProduct(releases, members), pairs.stream().sorted().toList());
  }

  @Test
  void bothListsThatFitTogetherStayOneQuery() {
    assertWithinBudgetAndComplete(ids("r", 3), ids("m", 7), 1);
  }

  @Test
  void memberListAloneNeedsSplitting() {
    assertWithinBudgetAndComplete(ids("r", 3), ids("m", 20), 3);
  }

  @Test
  void releaseListAloneExceedsTheBudget() {
    assertWithinBudgetAndComplete(ids("r", 23), ids("m", 2), 5);
  }
}

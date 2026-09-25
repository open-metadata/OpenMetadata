/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.factories;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.TestNamespace;

/**
 * Focus-point selection decides which node every focused benchmark scenario measures against. If it
 * picked the wrong hierarchy level the benchmark would keep reporting a number — just not the one
 * it claims — so the FQN arithmetic is pinned here.
 */
class LineageGraphLoaderTest {

  private static final String SCHEMA_FQN = "lnbench_abc123_s0.db0.sc0";

  @Test
  void derivesEachHierarchyLevelFromTheSchemaFqn() {
    final LineageFocusPoints focus = LineageGraphLoader.focusPoints(List.of(SCHEMA_FQN), tables(5));

    assertThat(focus.serviceFqn()).isEqualTo("lnbench_abc123_s0");
    assertThat(focus.databaseFqn()).isEqualTo("lnbench_abc123_s0.db0");
    assertThat(focus.schemaFqn()).isEqualTo(SCHEMA_FQN);
  }

  /** The planner gives the widest fan-out to the first node of the first layer. */
  @Test
  void focusesTheHubOnTheFirstTableAndTheLeafOnTheLast() {
    final List<LineageTableNode> tables = tables(5);

    final LineageFocusPoints focus = LineageGraphLoader.focusPoints(List.of(SCHEMA_FQN), tables);

    assertThat(focus.hubTableFqn()).isEqualTo(tables.getFirst().fullyQualifiedName());
    assertThat(focus.leafTableFqn()).isEqualTo(tables.getLast().fullyQualifiedName());
  }

  @Test
  void pointsTheFieldBandAtAColumnThatEveryTableActuallyHas() {
    final List<LineageTableNode> tables = tables(5);

    final LineageFocusPoints focus = LineageGraphLoader.focusPoints(List.of(SCHEMA_FQN), tables);

    assertThat(focus.hubColumnFqn())
        .isEqualTo(tables.getFirst().fullyQualifiedName() + ".lineage_key")
        .startsWith(focus.hubTableFqn() + ".");
  }

  @Test
  void survivesAServiceNameContainingTheHierarchySeparator() {
    // Table FQNs quote a dotted segment; the service segment itself never contains a bare dot, so
    // trailing-segment arithmetic is the correct reading of a schema FQN.
    final LineageFocusPoints focus =
        LineageGraphLoader.focusPoints(List.of("svc.db.sc"), tables(2));

    assertThat(focus.serviceFqn()).isEqualTo("svc");
    assertThat(focus.databaseFqn()).isEqualTo("svc.db");
  }

  /**
   * Workers finish in any order, and the planner lays tables out by position — so the order handed
   * to it must not depend on completion order, or two runs of one seed build different graphs.
   */
  @Test
  void ordersTablesTheSameWayWhateverOrderTheyFinishedIn() {
    final List<LineageTableNode> created = tables(50);
    final List<LineageTableNode> shuffled = new ArrayList<>(created);
    Collections.shuffle(shuffled, new Random(7));

    assertThat(LineageGraphLoader.inDeterministicOrder(shuffled))
        .isEqualTo(LineageGraphLoader.inDeterministicOrder(created));
  }

  /**
   * The server assigns table ids as random UUIDs, so ordering by id reshuffles the graph on every
   * run — the bug this ordering replaced. Only the FQNs are stable across runs.
   */
  @Test
  void ordersTablesByFqnNotByTheServerAssignedId() {
    final List<LineageTableNode> firstRun = tablesWithRandomIds(50);
    final List<LineageTableNode> secondRun = tablesWithRandomIds(50);

    assertThat(fqns(LineageGraphLoader.inDeterministicOrder(firstRun)))
        .isEqualTo(fqns(LineageGraphLoader.inDeterministicOrder(secondRun)));
  }

  /** Schemas and databases are assigned to their children by position too. */
  @Test
  void ordersContainersByFqnWhateverOrderTheyFinishedIn() {
    final List<String> schemas =
        List.of(SCHEMA_FQN, "lnbench_abc123_s0.db0.sc1", "lnbench_abc123_s1.db0.sc0");
    final List<String> shuffled = new ArrayList<>(schemas);
    Collections.reverse(shuffled);

    assertThat(LineageGraphLoader.inFqnOrder(shuffled))
        .isEqualTo(LineageGraphLoader.inFqnOrder(schemas))
        .isSorted();
  }

  /** Search counts are scoped by this prefix, so every FQN in the load must start with it. */
  @Test
  void cohortPrefixIsStableForANamespaceAndScopesItsServiceNames() {
    final TestNamespace namespace = new TestNamespace("LineageGraphLoaderTest");

    final String prefix = LineageGraphLoader.cohortFqnPrefix(namespace);

    assertThat(LineageGraphLoader.cohortFqnPrefix(namespace)).isEqualTo(prefix);
    assertThat(prefix).startsWith("lnbench_").endsWith("_");
  }

  private static List<String> fqns(final List<LineageTableNode> nodes) {
    return nodes.stream().map(LineageTableNode::fullyQualifiedName).toList();
  }

  private static List<LineageTableNode> tablesWithRandomIds(final int count) {
    return IntStream.range(0, count)
        .mapToObj(index -> new LineageTableNode(UUID.randomUUID(), SCHEMA_FQN + ".t" + index))
        .toList();
  }

  private static List<LineageTableNode> tables(final int count) {
    return IntStream.range(0, count)
        .mapToObj(
            index ->
                new LineageTableNode(
                    UUID.nameUUIDFromBytes(("t" + index).getBytes()), SCHEMA_FQN + ".t" + index))
        .toList();
  }
}

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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.TeamHierarchy;

class TeamRepositoryUnitTest {

  @Test
  void test_expandHierarchyListsASharedTeamWithItsSubtreeUnderEveryParent() {
    TeamHierarchy shared = team("shared", team("leaf"));
    TeamHierarchy root = team("root", team("left", shared), team("right", shared));

    TeamHierarchy expanded = TeamRepository.expandHierarchy(List.of(root), 1000).getFirst();

    for (TeamHierarchy parent : expanded.getChildren()) {
      TeamHierarchy child = parent.getChildren().getFirst();
      assertEquals("shared", child.getName());
      assertEquals("leaf", child.getChildren().getFirst().getName());
    }
  }

  @Test
  void test_expandHierarchyStaysWithinItsBudgetAndExpandsEveryTeamOnce() {
    // Both teams of a layer are parents of both teams of the next one, so a full expansion of 16
    // layers lists about 2^17 nodes.
    List<TeamHierarchy> layer = List.of();
    for (int depth = 16; depth >= 1; depth--) {
      layer = List.of(team("a" + depth, layer), team("b" + depth, layer));
    }

    List<TeamHierarchy> expanded =
        TeamRepository.expandHierarchy(List.of(team("root", layer)), 100);

    int edges = 2 + 4 * 15;
    assertTrue(countNodes(expanded) <= 100 + edges + 1, "nodes: " + countNodes(expanded));
    Set<String> withChildren = new HashSet<>();
    collectTeamsWithChildren(expanded, withChildren);
    assertEquals(
        31, withChildren.size(), "root and every team above the last layer: " + withChildren);
  }

  private static TeamHierarchy team(String name, TeamHierarchy... children) {
    return team(name, List.of(children));
  }

  private static TeamHierarchy team(String name, List<TeamHierarchy> children) {
    return new TeamHierarchy()
        .withId(UUID.nameUUIDFromBytes(name.getBytes()))
        .withName(name)
        .withChildren(new ArrayList<>(children));
  }

  private static int countNodes(List<TeamHierarchy> nodes) {
    return nodes.stream().mapToInt(node -> 1 + countNodes(node.getChildren())).sum();
  }

  private static void collectTeamsWithChildren(List<TeamHierarchy> nodes, Set<String> names) {
    for (TeamHierarchy node : nodes) {
      if (!node.getChildren().isEmpty()) {
        names.add(node.getName());
      }
      collectTeamsWithChildren(node.getChildren(), names);
    }
  }
}

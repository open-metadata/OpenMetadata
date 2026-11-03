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

class TeamHierarchyTreeTest {

  @Test
  void expand_listsASharedTeamWithItsSubtreeUnderEveryParent() {
    TeamHierarchy leaf = node("leaf");
    TeamHierarchy shared = node("shared", leaf);
    TeamHierarchy root = node("root", node("left", shared), node("right", shared));

    TeamHierarchy expanded = TeamHierarchyTree.expand(List.of(root), 5).getFirst();

    for (TeamHierarchy parent : expanded.getChildren()) {
      TeamHierarchy child = parent.getChildren().getFirst();
      assertEquals("shared", child.getName());
      assertEquals(List.of("leaf"), names(child.getChildren()));
    }
  }

  @Test
  void expand_staysWithinBudgetAndStillExpandsEveryTeamOnce() {
    // Each layer's two teams are both parents of the next layer's two: the paths to a team double
    // per layer, so a full expansion of 16 layers has about 2^17 nodes.
    int layers = 16;
    List<TeamHierarchy> next = List.of();
    for (int layer = layers; layer >= 1; layer--) {
      next = List.of(node("a" + layer, next), node("b" + layer, next));
    }
    TeamHierarchy root = node("root", next);
    int teams = 2 * layers + 1;

    List<TeamHierarchy> expanded = TeamHierarchyTree.expand(List.of(root), teams, 100);

    int edges = 2 + 4 * (layers - 1);
    assertTrue(count(expanded) <= 100 + edges + 1, "node count " + count(expanded));
    assertEquals(teams - 1, teamsWithChildrenOrLeaves(expanded).size());
  }

  private static TeamHierarchy node(String name, TeamHierarchy... children) {
    return node(name, List.of(children));
  }

  private static TeamHierarchy node(String name, List<TeamHierarchy> children) {
    return new TeamHierarchy()
        .withId(UUID.nameUUIDFromBytes(name.getBytes()))
        .withName(name)
        .withChildren(new ArrayList<>(children));
  }

  private static List<String> names(List<TeamHierarchy> nodes) {
    return nodes.stream().map(TeamHierarchy::getName).toList();
  }

  private static int count(List<TeamHierarchy> nodes) {
    return nodes.stream().mapToInt(node -> 1 + count(node.getChildren())).sum();
  }

  /** Teams other than the root that appear at least once with their full set of children. */
  private static Set<String> teamsWithChildrenOrLeaves(List<TeamHierarchy> nodes) {
    Set<String> found = new HashSet<>();
    for (TeamHierarchy node : nodes) {
      for (TeamHierarchy child : node.getChildren()) {
        boolean isLeafLayer = child.getName().endsWith("16");
        if (isLeafLayer || child.getChildren().size() == 2) {
          found.add(child.getName());
        }
      }
      found.addAll(teamsWithChildrenOrLeaves(node.getChildren()));
    }
    return found;
  }
}

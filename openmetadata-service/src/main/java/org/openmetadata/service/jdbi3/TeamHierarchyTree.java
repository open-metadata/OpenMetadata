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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.teams.TeamHierarchy;

/**
 * Turns the team graph, where a team with several parents is one node shared by all of them, into
 * the response tree. Every parent lists the team with its full subtree until the response reaches
 * its node budget; after that, a team already expanded elsewhere is listed without children, so
 * each team's subtree still appears at least once
 * (ADR:2026-11-03-a-team-with-several-parents-is-expanded-once).
 */
final class TeamHierarchyTree {
  static final int NODES_PER_TEAM = 10;
  static final int MIN_NODES = 1000;

  private TeamHierarchyTree() {}

  static List<TeamHierarchy> expand(List<TeamHierarchy> roots, int teamCount) {
    return expand(roots, teamCount, Math.max(MIN_NODES, (long) NODES_PER_TEAM * teamCount));
  }

  static List<TeamHierarchy> expand(List<TeamHierarchy> roots, int teamCount, long budget) {
    Expansion expansion = new Expansion(budget, new HashSet<>(teamCount));
    return roots.stream().map(expansion::copy).toList();
  }

  private static final class Expansion {
    private long remaining;
    private final Set<UUID> expanded;

    private Expansion(long budget, Set<UUID> expanded) {
      this.remaining = budget;
      this.expanded = expanded;
    }

    private TeamHierarchy copy(TeamHierarchy node) {
      remaining--;
      boolean firstExpansion = expanded.add(node.getId());
      TeamHierarchy copy = withoutChildren(node);
      if (firstExpansion || remaining > 0) {
        listOrEmpty(node.getChildren()).forEach(child -> copy.getChildren().add(copy(child)));
      }
      return copy;
    }
  }

  private static TeamHierarchy withoutChildren(TeamHierarchy node) {
    return new TeamHierarchy()
        .withId(node.getId())
        .withTeamType(node.getTeamType())
        .withName(node.getName())
        .withDisplayName(node.getDisplayName())
        .withDescription(node.getDescription())
        .withHref(node.getHref())
        .withFullyQualifiedName(node.getFullyQualifiedName())
        .withIsJoinable(node.getIsJoinable())
        .withChildren(new ArrayList<>());
  }
}

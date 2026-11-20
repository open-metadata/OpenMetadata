package org.openmetadata.service.security.listaccess;

import java.util.Set;
import java.util.UUID;

/** The teams under a team, for conditions that read team membership of a row's owners. */
public interface TeamTree {
  /** The team and every team under it, or an incomplete subtree when there are too many to list. */
  TeamSubtree subtreeOf(String teamName);

  TeamSubtree subtreeOf(UUID teamId);

  /** {@code complete} is false when the subtree is larger than the SQL may list. */
  record TeamSubtree(Set<UUID> teams, boolean complete) {
    public TeamSubtree {
      teams = Set.copyOf(teams);
    }

    static TeamSubtree tooLarge() {
      return new TeamSubtree(Set.of(), false);
    }
  }
}

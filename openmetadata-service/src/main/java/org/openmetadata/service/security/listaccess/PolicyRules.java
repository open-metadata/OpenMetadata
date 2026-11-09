package org.openmetadata.service.security.listaccess;

import java.util.List;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.CompiledRule;

/**
 * The rules of one policy and the user or team it reached the caller through, which is what
 * {@code matchTeam()} reads besides the row.
 */
public record PolicyRules(String attachedToType, String attachedToName, List<CompiledRule> rules) {
  public PolicyRules {
    rules = List.copyOf(rules);
  }

  boolean attachedToTeam() {
    return Entity.TEAM.equals(attachedToType);
  }
}

package org.openmetadata.service.security.listaccess;

import java.util.List;
import java.util.UUID;
import org.openmetadata.service.security.policyevaluator.CompiledRule;

/**
 * The deny rules of the policies attached directly to one team. A team that owns a row brings them
 * to every caller outside the team, and so does each team above the owner
 * (ADR:2026-11-03-an-owning-teams-allow-rules-stay-with-its-members).
 */
public record TeamDenies(UUID teamId, String teamName, List<CompiledRule> denyRules) {
  public TeamDenies {
    denyRules = List.copyOf(denyRules);
  }
}

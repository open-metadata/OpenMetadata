package org.openmetadata.service.security.listaccess;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** What policy conditions read about the caller, answered as {@code authorize} answers it. */
public interface Caller {
  UUID userId();

  boolean isAdmin();

  /** The caller and the teams they belong to directly, as isOwner() and isReviewer() match them. */
  Set<UUID> selfAndDirectTeams();

  /** The fully qualified names of the caller's domains, as hasDomain() matches them. */
  Set<String> domainFqns();

  boolean isUnderTeam(String teamName);

  boolean hasAnyRole(String roleName);

  /** The bot that acts for the caller on this request, or null. */
  String impersonatedBy();

  /** The teams whose policies the caller already holds, so they bring no owning-team rules. */
  Set<UUID> visitedTeams();

  /** The caller's own policies: direct roles, then each team up the hierarchy. */
  List<PolicyRules> policies();
}

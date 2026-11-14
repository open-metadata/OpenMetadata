package org.openmetadata.service.security.listaccess;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** The caller of a request, read from the caches and context {@code authorize} reads. */
final class SubjectCaller implements Caller {
  private final SubjectContext subject;

  SubjectCaller(SubjectContext subject) {
    this.subject = subject;
  }

  @Override
  public UUID userId() {
    return subject.user().getId();
  }

  @Override
  public boolean isAdmin() {
    return subject.isAdmin();
  }

  @Override
  public Set<UUID> selfAndDirectTeams() {
    Set<UUID> ids = new HashSet<>();
    ids.add(subject.user().getId());
    listOrEmpty(subject.user().getTeams()).forEach(team -> ids.add(team.getId()));
    return Set.copyOf(ids);
  }

  @Override
  public Set<String> domainFqns() {
    return subject.getUserDomains().stream()
        .map(EntityReference::getFullyQualifiedName)
        .collect(Collectors.toUnmodifiableSet());
  }

  @Override
  public boolean isUnderTeam(String teamName) {
    return subject.isUserUnderTeam(teamName);
  }

  @Override
  public boolean hasAnyRole(String roleName) {
    return subject.hasAnyRole(roleName);
  }

  /** The request's impersonation, as isImpersonated() and impersonatedBy() read it. */
  @Override
  public String impersonatedBy() {
    return ImpersonationContext.getImpersonatedBy();
  }

  @Override
  public Set<UUID> visitedTeams() {
    return Set.copyOf(SubjectCache.getVisitedTeams(subject.user().getName()));
  }

  @Override
  public List<PolicyRules> policies() {
    return SubjectCache.getPolicies(subject.user().getName()).stream()
        .map(
            policy ->
                new PolicyRules(
                    policy.getEntityType(), policy.getEntityName(), listOrEmpty(policy.getRules())))
        .toList();
  }
}

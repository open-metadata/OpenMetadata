package org.openmetadata.service.security.policyevaluator;

import java.util.List;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

/** Builds the policy contexts SubjectCache would resolve, for tests outside this package. */
public final class PolicyContextFixture {
  private PolicyContextFixture() {}

  public static PolicyContext policy(final String roleName, final List<Rule> rules) {
    final List<CompiledRule> compiledRules = rules.stream().map(CompiledRule::new).toList();
    return new PolicyContext(null, null, roleName, roleName + "Policy", compiledRules);
  }
}

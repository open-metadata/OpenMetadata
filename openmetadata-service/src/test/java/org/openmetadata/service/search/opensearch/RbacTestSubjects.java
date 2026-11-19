package org.openmetadata.service.search.opensearch;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** A caller whose search access policy lets them see only the documents of their own domain. */
final class RbacTestSubjects {

  private RbacTestSubjects() {}

  static SubjectContext domainScoped(final boolean isAdmin, final UUID domainId) {
    User user = mock(User.class);
    EntityReference userReference = mock(EntityReference.class);
    when(userReference.getId()).thenReturn(UUID.randomUUID());
    when(user.getEntityReference()).thenReturn(userReference);
    when(user.getId()).thenReturn(UUID.randomUUID());
    when(user.getName()).thenReturn("analyst");
    EntityReference domainRef = new EntityReference().withId(domainId).withType(Entity.DOMAIN);
    when(user.getDomains()).thenReturn(List.of(domainRef));

    SubjectContext.PolicyContext policyContext = mock(SubjectContext.PolicyContext.class);
    when(policyContext.getPolicyName()).thenReturn("DomainAccessPolicy");
    CompiledRule deny = denyRule(List.of("All"), "!hasDomain()");
    CompiledRule allow = allowRule(List.of("All"), "hasDomain()");
    when(policyContext.getRules()).thenReturn(List.of(deny, allow));

    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(isAdmin);
    when(subjectContext.isBot()).thenReturn(false);
    when(subjectContext.user()).thenReturn(user);
    when(subjectContext.getPolicies(any())).thenReturn(List.of(policyContext).iterator());
    return subjectContext;
  }

  private static CompiledRule allowRule(List<String> resources, String condition) {
    return rule(resources, condition, CompiledRule.Effect.ALLOW);
  }

  private static CompiledRule denyRule(List<String> resources, String condition) {
    return rule(resources, condition, CompiledRule.Effect.DENY);
  }

  private static CompiledRule rule(
      List<String> resources, String condition, CompiledRule.Effect effect) {
    CompiledRule compiledRule = mock(CompiledRule.class);
    when(compiledRule.getResources()).thenReturn(resources);
    when(compiledRule.getOperations()).thenReturn(List.of(MetadataOperation.VIEW_ALL));
    when(compiledRule.getCondition()).thenReturn(condition);
    when(compiledRule.getEffect()).thenReturn(effect);
    return compiledRule;
  }
}

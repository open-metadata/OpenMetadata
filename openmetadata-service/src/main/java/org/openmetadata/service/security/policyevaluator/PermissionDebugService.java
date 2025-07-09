package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.policyevaluator.PermissionDebugInfo.*;
import org.openmetadata.service.security.policyevaluator.PermissionEvaluationDebugInfo.*;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

@Slf4j
public class PermissionDebugService {

  private final UserRepository userRepository;
  private final TeamRepository teamRepository;
  private final RoleRepository roleRepository;
  private final PolicyRepository policyRepository;

  public PermissionDebugService() {
    this.userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    this.teamRepository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
    this.roleRepository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
    this.policyRepository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
  }

  public PermissionDebugInfo debugUserPermissionsByName(String userName) {
    User user = userRepository.getByName(null, userName, userRepository.getFields("*"));
    return debugUserPermissions(user);
  }

  private PermissionDebugInfo debugUserPermissions(User user) {
    PermissionDebugInfo debugInfo = new PermissionDebugInfo();
    debugInfo.setUser(user.getEntityReference());

    // Process direct roles
    processDirectRoles(user, debugInfo);

    // Process team permissions (including hierarchy)
    processTeamPermissions(user, debugInfo);

    // Process other inherited permissions (domain, owner, etc.)
    processOtherInheritedPermissions(user, debugInfo);

    // Generate summary
    generateSummary(debugInfo);

    return debugInfo;
  }

  private void processDirectRoles(User user, PermissionDebugInfo debugInfo) {
    if (user.getRoles() == null || user.getRoles().isEmpty()) {
      return;
    }

    for (EntityReference roleRef : user.getRoles()) {
      Role role = roleRepository.get(null, roleRef.getId(), roleRepository.getFields("*"));
      DirectRolePermission directRole = new DirectRolePermission();
      directRole.setRole(role.getEntityReference());

      // Get policies for this role
      if (role.getPolicies() != null) {
        for (EntityReference policyRef : role.getPolicies()) {
          Policy policy =
              policyRepository.get(null, policyRef.getId(), policyRepository.getFields("*"));
          PolicyInfo policyInfo = convertPolicyToInfo(policy);
          directRole.getPolicies().add(policyInfo);
        }
      }

      debugInfo.getDirectRoles().add(directRole);
    }
  }

  private void processTeamPermissions(User user, PermissionDebugInfo debugInfo) {
    if (user.getTeams() == null || user.getTeams().isEmpty()) {
      return;
    }

    for (EntityReference teamRef : user.getTeams()) {
      Team team = teamRepository.get(null, teamRef.getId(), teamRepository.getFields("*"));
      processTeamHierarchy(team, debugInfo, 0);
    }
  }

  private void processTeamHierarchy(Team team, PermissionDebugInfo debugInfo, int level) {
    TeamPermission teamPermission = new TeamPermission();
    teamPermission.setTeam(team.getEntityReference());
    teamPermission.setTeamType(team.getTeamType().value());
    teamPermission.setHierarchyLevel(level);

    // Build team hierarchy path
    List<EntityReference> hierarchy = new ArrayList<>();
    Team currentTeam = team;
    while (currentTeam != null) {
      hierarchy.add(currentTeam.getEntityReference());
      if (currentTeam.getParents() != null && !currentTeam.getParents().isEmpty()) {
        // Get the first parent (assuming single parent for simplicity)
        EntityReference parentRef = currentTeam.getParents().get(0);
        currentTeam = teamRepository.get(null, parentRef.getId(), teamRepository.getFields("*"));
      } else {
        currentTeam = null;
      }
    }
    teamPermission.setTeamHierarchy(hierarchy);

    // Process team's default roles
    if (team.getDefaultRoles() != null) {
      for (EntityReference roleRef : team.getDefaultRoles()) {
        Role role = roleRepository.get(null, roleRef.getId(), roleRepository.getFields("*"));
        RolePermission rolePermission = new RolePermission();
        rolePermission.setRole(role.getEntityReference());
        rolePermission.setInheritedFrom(team.getName());
        rolePermission.setDefaultRole(true);

        // Get policies for this role
        if (role.getPolicies() != null) {
          for (EntityReference policyRef : role.getPolicies()) {
            Policy policy =
                policyRepository.get(null, policyRef.getId(), policyRepository.getFields("*"));
            PolicyInfo policyInfo = convertPolicyToInfo(policy);
            rolePermission.getPolicies().add(policyInfo);
          }
        }

        teamPermission.getRolePermissions().add(rolePermission);
      }
    }

    // Process team's direct policies
    if (team.getPolicies() != null) {
      for (EntityReference policyRef : team.getPolicies()) {
        Policy policy =
            policyRepository.get(null, policyRef.getId(), policyRepository.getFields("*"));
        PolicyInfo policyInfo = convertPolicyToInfo(policy);
        teamPermission.getDirectPolicies().add(policyInfo);
      }
    }

    debugInfo.getTeamPermissions().add(teamPermission);

    // Process parent teams
    if (team.getParents() != null && !team.getParents().isEmpty()) {
      for (EntityReference parentRef : team.getParents()) {
        Team parentTeam =
            teamRepository.get(null, parentRef.getId(), teamRepository.getFields("*"));
        processTeamHierarchy(parentTeam, debugInfo, level + 1);
      }
    }
  }

  private void processOtherInheritedPermissions(User user, PermissionDebugInfo debugInfo) {
    // Check if user is admin
    if (Boolean.TRUE.equals(user.getIsAdmin())) {
      InheritedPermission adminPermission = new InheritedPermission();
      adminPermission.setPermissionType("ADMIN");
      adminPermission.setDescription("User has admin privileges");
      debugInfo.getInheritedPermissions().add(adminPermission);
    }

    // Check domain permissions
    if (user.getDomains() != null && !user.getDomains().isEmpty()) {
      for (EntityReference domainRef : user.getDomains()) {
        InheritedPermission domainPermission = new InheritedPermission();
        domainPermission.setPermissionType("DOMAIN_ACCESS");
        domainPermission.setSource(domainRef);
        domainPermission.setDescription("Access to domain: " + domainRef.getName());
        debugInfo.getInheritedPermissions().add(domainPermission);
      }
    }
  }

  private PolicyInfo convertPolicyToInfo(Policy policy) {
    PolicyInfo policyInfo = new PolicyInfo();
    policyInfo.setPolicy(policy.getEntityReference());

    if (policy.getRules() != null) {
      for (Rule rule : policy.getRules()) {
        RuleInfo ruleInfo = new RuleInfo();
        ruleInfo.setName(rule.getName());
        ruleInfo.setEffect(rule.getEffect().value());

        if (rule.getOperations() != null) {
          ruleInfo.setOperations(
              rule.getOperations().stream()
                  .map(MetadataOperation::value)
                  .collect(Collectors.toList()));
        }

        if (rule.getResources() != null) {
          ruleInfo.setResources(rule.getResources());
        }

        if (rule.getCondition() != null) {
          ruleInfo.setCondition(rule.getCondition());
        }

        policyInfo.getRules().add(ruleInfo);
      }

      // Determine overall policy effect
      boolean hasAllow =
          policyInfo.getRules().stream().anyMatch(r -> "ALLOW".equals(r.getEffect()));
      boolean hasDeny = policyInfo.getRules().stream().anyMatch(r -> "DENY".equals(r.getEffect()));

      if (hasDeny && hasAllow) {
        policyInfo.setEffect("MIXED");
      } else if (hasDeny) {
        policyInfo.setEffect("DENY");
      } else {
        policyInfo.setEffect("ALLOW");
      }
    }

    return policyInfo;
  }

  private void generateSummary(PermissionDebugInfo debugInfo) {
    PermissionSummary summary = new PermissionSummary();

    // Count direct roles
    summary.setDirectRoles(debugInfo.getDirectRoles().size());

    // Count total unique roles
    Set<String> uniqueRoles = new HashSet<>();
    debugInfo.getDirectRoles().forEach(dr -> uniqueRoles.add(dr.getRole().getName()));
    debugInfo
        .getTeamPermissions()
        .forEach(
            tp -> tp.getRolePermissions().forEach(rp -> uniqueRoles.add(rp.getRole().getName())));
    summary.setTotalRoles(uniqueRoles.size());
    summary.setInheritedRoles(summary.getTotalRoles() - summary.getDirectRoles());

    // Count policies and rules
    Set<String> uniquePolicies = new HashSet<>();
    int totalRules = 0;
    Set<String> allowedOps = new HashSet<>();
    Set<String> deniedOps = new HashSet<>();

    // From direct roles
    for (DirectRolePermission drp : debugInfo.getDirectRoles()) {
      for (PolicyInfo pi : drp.getPolicies()) {
        uniquePolicies.add(pi.getPolicy().getName());
        totalRules += pi.getRules().size();
        collectOperations(pi, allowedOps, deniedOps);
      }
    }

    // From teams
    Set<String> uniqueTeams = new HashSet<>();
    int maxDepth = 0;
    for (TeamPermission tp : debugInfo.getTeamPermissions()) {
      uniqueTeams.add(tp.getTeam().getName());
      maxDepth = Math.max(maxDepth, tp.getHierarchyLevel());

      for (RolePermission rp : tp.getRolePermissions()) {
        for (PolicyInfo pi : rp.getPolicies()) {
          uniquePolicies.add(pi.getPolicy().getName());
          totalRules += pi.getRules().size();
          collectOperations(pi, allowedOps, deniedOps);
        }
      }

      for (PolicyInfo pi : tp.getDirectPolicies()) {
        uniquePolicies.add(pi.getPolicy().getName());
        totalRules += pi.getRules().size();
        collectOperations(pi, allowedOps, deniedOps);
      }
    }

    summary.setTotalPolicies(uniquePolicies.size());
    summary.setTotalRules(totalRules);
    summary.setTeamCount(uniqueTeams.size());
    summary.setMaxHierarchyDepth(maxDepth);
    summary.setEffectiveOperations(new ArrayList<>(allowedOps));
    summary.setDeniedOperations(new ArrayList<>(deniedOps));

    debugInfo.setSummary(summary);
  }

  private void collectOperations(PolicyInfo policy, Set<String> allowedOps, Set<String> deniedOps) {
    for (RuleInfo rule : policy.getRules()) {
      if ("ALLOW".equals(rule.getEffect())) {
        allowedOps.addAll(rule.getOperations());
      } else if ("DENY".equals(rule.getEffect())) {
        deniedOps.addAll(rule.getOperations());
      }
    }
  }

  public PermissionEvaluationDebugInfo debugPermissionEvaluation(
      String userName, String resourceType, String resourceIdOrFqn, MetadataOperation operation) {
    long startTime = System.currentTimeMillis();

    User user = userRepository.getByName(null, userName, userRepository.getFields("*"));

    PermissionEvaluationDebugInfo debugInfo = new PermissionEvaluationDebugInfo();
    debugInfo.setUser(user.getEntityReference());
    debugInfo.setResource(resourceType);
    debugInfo.setResourceId(resourceIdOrFqn);
    debugInfo.setOperation(operation);

    // Get the resource if resourceIdOrFqn is provided
    EntityInterface resource = null;
    if (resourceIdOrFqn != null) {
      try {
        EntityRepository<?> repository = Entity.getEntityRepository(resourceType);
        // Try to parse as UUID first
        try {
          UUID resourceId = UUID.fromString(resourceIdOrFqn);
          resource = repository.get(null, resourceId, repository.getFields("*"));
        } catch (IllegalArgumentException e) {
          // Not a UUID, try as FQN
          resource = repository.getByName(null, resourceIdOrFqn, repository.getFields("*"));
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to fetch resource {} with id/fqn {}: {}",
            resourceType,
            resourceIdOrFqn,
            e.getMessage());
      }
    }

    // Create evaluation contexts
    SubjectContext subjectContext = new SubjectContext(user);
    ResourceContext resourceContext =
        resource != null
            ? new ResourceContext(resourceType, resource, Entity.getEntityRepository(resourceType))
            : new ResourceContext(resourceType);
    OperationContext operationContext = new OperationContext(resourceType, operation);

    // Track evaluation steps
    List<PolicyEvaluationStep> evaluationSteps = new ArrayList<>();
    int stepNumber = 1;

    // Evaluate policies with tracking
    boolean finalDecision =
        evaluatePoliciesWithTracking(
            subjectContext,
            resourceContext,
            operationContext,
            operation,
            evaluationSteps,
            stepNumber);

    debugInfo.setAllowed(finalDecision);
    debugInfo.setFinalDecision(finalDecision ? "ALLOWED" : "DENIED");
    debugInfo.setEvaluationSteps(evaluationSteps);

    // Generate summary
    EvaluationSummary summary = new EvaluationSummary();
    summary.setTotalPoliciesEvaluated(
        (int) evaluationSteps.stream().map(s -> s.getPolicy().getName()).distinct().count());
    summary.setTotalRulesEvaluated(evaluationSteps.size());
    summary.setMatchingRules(
        (int) evaluationSteps.stream().filter(PolicyEvaluationStep::isMatched).count());
    summary.setDenyRules(
        (int)
            evaluationSteps.stream()
                .filter(s -> s.isMatched() && "DENY".equals(s.getEffect()))
                .count());
    summary.setAllowRules(
        (int)
            evaluationSteps.stream()
                .filter(s -> s.isMatched() && "ALLOW".equals(s.getEffect()))
                .count());

    if (!finalDecision) {
      if (summary.getDenyRules() > 0) {
        summary.getReasonsForDecision().add("Denied by explicit DENY rule(s)");
      } else {
        summary.getReasonsForDecision().add("No matching ALLOW rules found");
      }
    } else {
      summary.getReasonsForDecision().add("Allowed by matching ALLOW rule(s)");
    }

    summary.setEvaluationTimeMs(System.currentTimeMillis() - startTime);
    debugInfo.setSummary(summary);

    return debugInfo;
  }

  private boolean evaluatePoliciesWithTracking(
      SubjectContext subjectContext,
      ResourceContext resourceContext,
      OperationContext operationContext,
      MetadataOperation operation,
      List<PolicyEvaluationStep> evaluationSteps,
      int startStepNumber) {

    int stepNumber = startStepNumber;

    // Get all policies for the user
    Iterator<SubjectContext.PolicyContext> policyIterator = subjectContext.getPolicies(null);

    boolean hasDenyMatch = false;
    boolean hasAllowMatch = false;

    while (policyIterator.hasNext()) {
      SubjectContext.PolicyContext policyContext = policyIterator.next();
      List<CompiledRule> rules = policyContext.getRules();

      for (CompiledRule compiledRule : rules) {
        // For permission debugging, we're checking a single specific operation
        List<MetadataOperation> operations = operationContext.getOperations(resourceContext);

        // If operations is null or empty, use the single operation from operationContext
        if (operations == null || operations.isEmpty()) {
          operations = List.of(operation);
        }

        for (MetadataOperation op : operations) {
          PolicyEvaluationStep step =
              createEvaluationStep(
                  stepNumber++, policyContext, compiledRule, subjectContext, resourceContext, op);
          evaluationSteps.add(step);

          if (step.isMatched()) {
            if (compiledRule.getEffect() == Rule.Effect.DENY) {
              hasDenyMatch = true;
            } else if (compiledRule.getEffect() == Rule.Effect.ALLOW) {
              hasAllowMatch = true;
            }
          }
        }
      }
    }

    // Deny takes precedence
    if (hasDenyMatch) {
      return false;
    }

    return hasAllowMatch;
  }

  private PolicyEvaluationStep createEvaluationStep(
      int stepNumber,
      SubjectContext.PolicyContext policyContext,
      CompiledRule rule,
      SubjectContext subjectContext,
      ResourceContext resourceContext,
      MetadataOperation operation) {

    PolicyEvaluationStep step = new PolicyEvaluationStep();
    step.setStepNumber(stepNumber);

    // Create policy reference
    EntityReference policyRef = new EntityReference();
    policyRef.setName(policyContext.getPolicyName());
    policyRef.setType(Entity.POLICY);
    step.setPolicy(policyRef);

    step.setRule(rule.getName());
    step.setEffect(rule.getEffect().value());

    // Determine source based on entity type and role
    String entityType = policyContext.getEntityType();
    String entityName = policyContext.getEntityName();
    String roleName = policyContext.getRoleName();

    if (Entity.USER.equals(entityType)) {
      if (roleName != null) {
        step.setSource("DIRECT_ROLE");
        EntityReference roleRef = new EntityReference();
        roleRef.setName(roleName);
        roleRef.setType(Entity.ROLE);
        step.setSourceEntity(roleRef);
      } else {
        step.setSource("USER_POLICY");
        EntityReference userRef = new EntityReference();
        userRef.setName(entityName);
        userRef.setType(Entity.USER);
        step.setSourceEntity(userRef);
      }
    } else if (Entity.TEAM.equals(entityType)) {
      if (roleName != null) {
        step.setSource("TEAM_ROLE");
      } else {
        step.setSource("TEAM_POLICY");
      }
      EntityReference teamRef = new EntityReference();
      teamRef.setName(entityName);
      teamRef.setType(Entity.TEAM);
      step.setSourceEntity(teamRef);
    }

    // Check if rule matches - use the same logic as CompiledRule
    boolean operationMatches = matchOperation(rule, operation);
    boolean resourceMatches = rule.matchResource(resourceContext.getResource());
    boolean conditionMatches = true;

    if (rule.getCondition() != null && !rule.getCondition().isEmpty()) {
      ConditionEvaluation condEval = new ConditionEvaluation();
      condEval.setCondition(rule.getCondition());

      try {
        Expression expression = CompiledRule.parseExpression(rule.getCondition());
        if (expression != null) {
          RuleEvaluator ruleEvaluator =
              new RuleEvaluator(policyContext, subjectContext, resourceContext);
          SimpleEvaluationContext context =
              SimpleEvaluationContext.forReadOnlyDataBinding()
                  .withInstanceMethods()
                  .withRootObject(ruleEvaluator)
                  .build();
          conditionMatches = Boolean.TRUE.equals(expression.getValue(context, Boolean.class));
        }
        condEval.setResult(conditionMatches);
        condEval.setEvaluationDetails(
            conditionMatches ? "Condition evaluated to true" : "Condition evaluated to false");
      } catch (Exception e) {
        conditionMatches = false;
        condEval.setResult(false);
        condEval.setEvaluationDetails("Condition evaluation failed: " + e.getMessage());
      }

      step.getConditionEvaluations().add(condEval);
    }

    boolean matched = operationMatches && resourceMatches && conditionMatches;
    step.setMatched(matched);

    if (!matched) {
      List<String> reasons = new ArrayList<>();
      if (!operationMatches) {
        reasons.add("Operation '" + operation + "' not in rule operations");
      }
      if (!resourceMatches) {
        reasons.add("Resource '" + resourceContext.getResource() + "' not matched by rule");
      }
      if (!conditionMatches) {
        reasons.add("Condition evaluation failed");
      }
      step.setMatchReason("Not matched: " + String.join(", ", reasons));
    } else {
      step.setMatchReason("Matched: operation, resource, and conditions all satisfied");
    }

    return step;
  }

  // Helper method that replicates CompiledRule.matchOperation logic
  private boolean matchOperation(CompiledRule rule, MetadataOperation operation) {
    List<MetadataOperation> operations = rule.getOperations();
    if (operations.contains(MetadataOperation.ALL)) {
      return true; // Match all operations
    }
    if (operations.contains(MetadataOperation.EDIT_ALL)
        && OperationContext.isEditOperation(operation)) {
      return true;
    }
    if (operations.contains(MetadataOperation.VIEW_ALL)
        && OperationContext.isViewOperation(operation)) {
      return true;
    }
    return operations.contains(operation);
  }
}

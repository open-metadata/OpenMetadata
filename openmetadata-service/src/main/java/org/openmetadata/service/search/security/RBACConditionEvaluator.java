package org.openmetadata.service.search.security;

import java.util.*;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.SpelNode;
import org.springframework.expression.spel.ast.MethodReference;
import org.springframework.expression.spel.ast.OpAnd;
import org.springframework.expression.spel.ast.OpOr;
import org.springframework.expression.spel.ast.OperatorNot;
import org.springframework.expression.spel.standard.SpelExpression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

public class RBACConditionEvaluator {

  private final QueryBuilderFactory queryBuilderFactory;
  private final ExpressionParser spelParser = new SpelExpressionParser();
  private final StandardEvaluationContext spelContext;
  private static final Set<MetadataOperation> SEARCH_RELEVANT_OPS =
      Set.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_ALL, MetadataOperation.ALL);

  public RBACConditionEvaluator(QueryBuilderFactory queryBuilderFactory) {
    this.queryBuilderFactory = queryBuilderFactory;
    spelContext = new StandardEvaluationContext();
  }

  public OMQueryBuilder evaluateConditions(SubjectContext subjectContext) {
    User user = subjectContext.user();
    spelContext.setVariable("user", user);

    List<OMQueryBuilder> allowQueries = new ArrayList<>();
    List<OMQueryBuilder> denyQueries = new ArrayList<>();

    for (Iterator<SubjectContext.PolicyContext> it =
            subjectContext.getPolicies(List.of(user.getEntityReference()));
        it.hasNext(); ) {
      SubjectContext.PolicyContext context = it.next();

      for (CompiledRule rule : context.getRules()) {
        boolean isDenyRule = rule.getEffect() == Rule.Effect.DENY;
        Set<MetadataOperation> ruleOperations = new HashSet<>(rule.getOperations());
        ruleOperations.retainAll(SEARCH_RELEVANT_OPS);
        if (ruleOperations.isEmpty()) {
          continue;
        }

        OMQueryBuilder ruleQuery = buildRuleQuery(rule, user);
        if (ruleQuery == null || ruleQuery.isEmpty()) {
          continue;
        }

        if (isDenyRule) {
          denyQueries.add(ruleQuery);
        } else {
          allowQueries.add(ruleQuery);
        }
      }
    }

    OMQueryBuilder finalQuery;

    if (!allowQueries.isEmpty()) {
      OMQueryBuilder finalAllowQuery =
          (allowQueries.size() == 1)
              ? allowQueries.get(0)
              : queryBuilderFactory.boolQuery().should(allowQueries);

      finalQuery = finalAllowQuery;

      if (!denyQueries.isEmpty()) {
        OMQueryBuilder finalDenyQuery =
            (denyQueries.size() == 1)
                ? denyQueries.get(0)
                : queryBuilderFactory.boolQuery().should(denyQueries);

        finalQuery =
            queryBuilderFactory
                .boolQuery()
                .must(Collections.singletonList(finalAllowQuery))
                .mustNot(Collections.singletonList(finalDenyQuery));
      }
    } else if (!denyQueries.isEmpty()) {
      OMQueryBuilder finalDenyQuery =
          (denyQueries.size() == 1)
              ? denyQueries.get(0)
              : queryBuilderFactory.boolQuery().should(denyQueries);

      finalQuery =
          queryBuilderFactory
              .boolQuery()
              .must(queryBuilderFactory.matchAllQuery())
              .mustNot(Collections.singletonList(finalDenyQuery));
    } else {
      finalQuery = queryBuilderFactory.matchAllQuery();
    }

    return finalQuery;
  }

  private OMQueryBuilder buildRuleQuery(CompiledRule rule, User user) {
    ConditionCollector ruleCollector = new ConditionCollector(queryBuilderFactory);
    spelContext.setVariable("user", user);

    if (!rule.getResources().isEmpty() && !rule.getResources().contains("All")) {
      OMQueryBuilder indexFilter = getIndexFilter(rule.getResources());
      ruleCollector.addMust(indexFilter);
    }

    if (rule.getCondition() != null && !rule.getCondition().trim().isEmpty()) {
      SpelExpression parsedExpression =
          (SpelExpression) spelParser.parseExpression(rule.getCondition());
      preprocessExpression(parsedExpression.getAST(), ruleCollector);
    } else {
      ruleCollector.addMust(queryBuilderFactory.matchAllQuery());
    }

    return ruleCollector.buildFinalQuery();
  }

  private void preprocessExpression(SpelNode node, ConditionCollector collector) {
    if (collector.isMatchNothing()) {
      return;
    }

    if (node instanceof OpAnd) {
      for (int i = 0; i < node.getChildCount(); i++) {
        preprocessExpression(node.getChild(i), collector);
        if (collector.isMatchNothing()) {
          return;
        }
      }
    } else if (node instanceof OpOr) {
      List<OMQueryBuilder> orQueries = new ArrayList<>();
      boolean hasTrueCondition = false;
      boolean allMatchNothing = true;

      for (int i = 0; i < node.getChildCount(); i++) {
        ConditionCollector childCollector = new ConditionCollector(queryBuilderFactory);
        preprocessExpression(node.getChild(i), childCollector);

        if (childCollector.isMatchNothing()) {
          continue;
        }

        if (childCollector.isMatchAllQuery()) {
          hasTrueCondition = true;
          break; // Short-circuit since one condition is always true
        }

        OMQueryBuilder childQuery = childCollector.buildFinalQuery();
        if (childQuery != null) {
          allMatchNothing = false;
          orQueries.add(childQuery);
        }
      }

      if (hasTrueCondition) {
        // One of the OR conditions is always true; the entire OR condition is true
        // No need to add any queries for this OR expression
        // Optionally, you can add a match_all query to represent this
        collector.addMust(queryBuilderFactory.matchAllQuery());
      } else if (allMatchNothing) {
        // All OR conditions are impossible; set matchNothing to true
        collector.setMatchNothing(true);
      } else {
        // Combine the collected queries using a should clause
        OMQueryBuilder orQuery = queryBuilderFactory.boolQuery().should(orQueries);
        collector.addMust(orQuery);
      }
    } else if (node instanceof OperatorNot) {
      ConditionCollector subCollector = new ConditionCollector(queryBuilderFactory);
      preprocessExpression(node.getChild(0), subCollector);

      if (subCollector.isMatchAllQuery()) {
        collector.setMatchNothing(true);
      } else if (subCollector.isMatchNothing()) {
        collector.addMust(queryBuilderFactory.matchAllQuery());
      } else {
        OMQueryBuilder subQuery = subCollector.buildFinalQuery();
        if (subQuery != null && !subQuery.isEmpty()) {
          collector.addMustNot(subQuery);
        }
      }
    } else if (node instanceof MethodReference) {
      handleMethodReference(node, collector);
    }
  }

  private void handleMethodReference(SpelNode node, ConditionCollector collector) {
    MethodReference methodRef = (MethodReference) node;
    String methodName = methodRef.getName();

    switch (methodName) {
      case "matchAnyCertification" -> {
        List<String> certificationLabels = extractMethodArguments(methodRef);
        matchAnyCertification(certificationLabels, collector);
      }
      case "matchAnyTag" -> {
        List<String> tags = extractMethodArguments(methodRef);
        matchAnyTag(tags, collector);
      }
      case "matchAllTags" -> {
        List<String> tags = extractMethodArguments(methodRef);
        matchAllTags(tags, collector);
      }
      case "isOwner" -> isOwner((User) spelContext.lookupVariable("user"), collector);
      case "noOwner" -> noOwner(collector);
      case "hasAnyRole" -> {
        List<String> roles = extractMethodArguments(methodRef);
        hasAnyRole(roles, collector);
      }
      case "hasDomain" -> hasDomain(collector);
      case "inAnyTeam" -> {
        List<String> teams = extractMethodArguments(methodRef);
        inAnyTeam(teams, collector);
      }
    }
  }

  private List<String> extractMethodArguments(MethodReference methodRef) {
    List<String> args = new ArrayList<>();
    for (int i = 0; i < methodRef.getChildCount(); i++) {
      SpelNode childNode = methodRef.getChild(i);
      String value = childNode.toStringAST().replace("'", "");
      args.add(value);
    }
    return args;
  }

  public void matchAnyTag(List<String> tags, ConditionCollector collector) {
    List<OMQueryBuilder> tagQueries = new ArrayList<>();
    for (String tag : tags) {
      OMQueryBuilder tagQuery;
      if (tag.startsWith("Tier")) {
        tagQuery = queryBuilderFactory.termQuery("tier.tagFQN", tag);
      } else {
        tagQuery = queryBuilderFactory.termQuery("tags.tagFQN", tag);
      }
      tagQueries.add(tagQuery);
    }
    OMQueryBuilder tagQueryCombined;
    if (tagQueries.size() == 1) {
      tagQueryCombined = tagQueries.get(0);
    } else {
      tagQueryCombined = queryBuilderFactory.boolQuery().should(tagQueries);
    }
    collector.addMust(tagQueryCombined);
  }

  public void matchAllTags(List<String> tags, ConditionCollector collector) {
    for (String tag : tags) {
      OMQueryBuilder tagQuery = queryBuilderFactory.termQuery("tags.tagFQN", tag);
      collector.addMust(tagQuery);
    }
  }

  public void matchAnyCertification(
      List<String> certificationLabels, ConditionCollector collector) {
    List<OMQueryBuilder> certificationQueries = new ArrayList<>();
    for (String certificationLabel : certificationLabels) {
      certificationQueries.add(
          queryBuilderFactory.termQuery("certification.tagLabel.tagFQN", certificationLabel));
    }
    OMQueryBuilder certificationQueriesCombined;
    if (certificationQueries.size() == 1) {
      certificationQueriesCombined = certificationQueries.get(0);
    } else {
      certificationQueriesCombined = queryBuilderFactory.boolQuery().should(certificationQueries);
    }
    collector.addMust(certificationQueriesCombined);
  }

  public void isOwner(User user, ConditionCollector collector) {
    List<OMQueryBuilder> ownerQueries = new ArrayList<>();
    ownerQueries.add(queryBuilderFactory.termQuery("owners.id", user.getId().toString()));

    if (user.getTeams() != null) {
      for (EntityReference team : user.getTeams()) {
        ownerQueries.add(queryBuilderFactory.termQuery("owners.id", team.getId().toString()));
      }
    }

    OMQueryBuilder ownerQuery;
    if (ownerQueries.size() == 1) {
      ownerQuery = ownerQueries.get(0);
    } else {
      ownerQuery = queryBuilderFactory.boolQuery().should(ownerQueries);
    }

    collector.addMust(ownerQuery);
  }

  public void noOwner(ConditionCollector collector) {
    OMQueryBuilder existsQuery = queryBuilderFactory.existsQuery("owners.id");
    collector.addMustNot(existsQuery); // Wrap existsQuery in a List
  }

  public void hasAnyRole(List<String> roles, ConditionCollector collector) {
    User user = (User) spelContext.lookupVariable("user");
    if (user.getRoles() == null || user.getRoles().isEmpty()) {
      collector.setMatchNothing(true);
      return;
    }

    List<String> userRoleNames = user.getRoles().stream().map(EntityReference::getName).toList();
    boolean hasRole = userRoleNames.stream().anyMatch(roles::contains);

    if (hasRole) {
      collector.addMust(queryBuilderFactory.matchAllQuery());
    } else {
      collector.setMatchNothing(true);
    }
  }

  public void hasDomain(ConditionCollector collector) {
    User user = (User) spelContext.lookupVariable("user");
    if (user.getDomain() == null) {
      OMQueryBuilder existsQuery = queryBuilderFactory.existsQuery("domain.id");
      collector.addMustNot(existsQuery); // Wrap existsQuery in a List
    } else {
      String userDomainId = user.getDomain().getId().toString();
      OMQueryBuilder domainQuery = queryBuilderFactory.termQuery("domain.id", userDomainId);
      collector.addMust(domainQuery);
    }
  }

  public void inAnyTeam(List<String> teamNames, ConditionCollector collector) {
    User user = (User) spelContext.lookupVariable("user");
    if (user.getTeams() == null || user.getTeams().isEmpty()) {
      collector.setMatchNothing(true);
      return;
    }
    List<String> userTeamNames = user.getTeams().stream().map(EntityReference::getName).toList();
    boolean inTeam = userTeamNames.stream().anyMatch(teamNames::contains);
    if (inTeam) {
      collector.addMust(queryBuilderFactory.matchAllQuery());
    } else {
      collector.setMatchNothing(true);
    }
  }

  private OMQueryBuilder getIndexFilter(List<String> resources) {
    List<String> indices =
        resources.stream()
            .map(resource -> Entity.getSearchRepository().getIndexOrAliasName(resource))
            .toList();

    return queryBuilderFactory.termsQuery("_index", indices);
  }
}

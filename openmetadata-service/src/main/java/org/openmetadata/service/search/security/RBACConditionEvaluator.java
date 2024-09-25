package org.openmetadata.service.search.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.*;
import java.util.stream.Collectors;
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
  private static final String DOMAIN_ONLY_ACCESS_RULE = "DomainOnlyAccessRule";
  private static final Set<MetadataOperation> SEARCH_RELEVANT_OPS =
      Set.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_ALL);

  public RBACConditionEvaluator(QueryBuilderFactory queryBuilderFactory) {
    this.queryBuilderFactory = queryBuilderFactory;
    spelContext = new StandardEvaluationContext();
  }

  public OMQueryBuilder evaluateConditions(SubjectContext subjectContext) {
    User user = subjectContext.user();
    spelContext.setVariable("user", user);
    ConditionCollector collector = new ConditionCollector(queryBuilderFactory);

    for (Iterator<SubjectContext.PolicyContext> it =
            subjectContext.getPolicies(List.of(user.getEntityReference()));
        it.hasNext(); ) {
      SubjectContext.PolicyContext context = it.next();
      for (CompiledRule rule : context.getRules()) {
        if ((rule.getCondition() != null
                && rule.getOperations().stream().anyMatch(SEARCH_RELEVANT_OPS::contains))
            || rule.getName().equalsIgnoreCase(DOMAIN_ONLY_ACCESS_RULE)) {
          ConditionCollector ruleCollector = new ConditionCollector(queryBuilderFactory);
          if (!rule.getResources().isEmpty() && !rule.getResources().contains("All")) {
            OMQueryBuilder indexFilter = getIndexFilter(rule.getResources());
            ruleCollector.addMust(indexFilter);
          }
          SpelExpression parsedExpression =
              (SpelExpression) spelParser.parseExpression(rule.getCondition());
          preprocessExpression(parsedExpression.getAST(), ruleCollector);
          OMQueryBuilder ruleQuery = ruleCollector.buildFinalQuery();
          if (rule.getEffect().toString().equalsIgnoreCase("DENY")) {
            collector.addMustNot(ruleQuery);
          } else {
            collector.addMust(ruleQuery);
          }
        }
      }
    }

    return collector.buildFinalQuery();
  }

  private void preprocessExpression(SpelNode node, ConditionCollector collector) {
    // Delay this check until after processing necessary expressions
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
      boolean allMatchNothing = true;
      boolean hasTrueCondition = false; // Track if any condition evaluated to true

      for (int i = 0; i < node.getChildCount(); i++) {
        ConditionCollector childCollector = new ConditionCollector(queryBuilderFactory);
        preprocessExpression(node.getChild(i), childCollector);

        if (childCollector.isMatchNothing()) {
          continue; // If this child evaluates to match nothing, skip it
        }

        if (childCollector.isMatchAllQuery()) {
          hasTrueCondition = true; // If any condition evaluates to true, mark it
          break; // Short-circuit: if any condition in OR evaluates to true, the whole OR is true
        }

        OMQueryBuilder childQuery = childCollector.buildFinalQuery();
        if (childQuery != null) {
          allMatchNothing =
              false; // If at least one child query is valid, it’s not all match nothing
          orQueries.add(childQuery);
        }
      }

      if (hasTrueCondition) {
        collector.addMust(queryBuilderFactory.matchAllQuery()); // OR is true, add match_all
      } else if (allMatchNothing) {
        collector.setMatchNothing(true); // OR is false
      } else {
        // Add the valid OR queries to the collector
        for (OMQueryBuilder orQuery : orQueries) {
          collector.addShould(orQuery);
        }
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
          collector.addMustNot(subQuery); // Add must_not without extra nesting
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
      String value = childNode.toStringAST().replace("'", ""); // Remove single quotes
      args.add(value);
    }
    return args;
  }

  public void matchAnyTag(List<String> tags, ConditionCollector collector) {
    for (String tag : tags) {
      OMQueryBuilder tagQuery = queryBuilderFactory.termQuery("tags.tagFQN", tag);
      collector.addShould(tagQuery);
    }
  }

  public void matchAllTags(List<String> tags, ConditionCollector collector) {
    for (String tag : tags) {
      OMQueryBuilder tagQuery = queryBuilderFactory.termQuery("tags.tagFQN", tag);
      collector.addMust(tagQuery); // Add directly to the collector's must clause
    }
  }

  public void isOwner(User user, ConditionCollector collector) {
    List<OMQueryBuilder> ownerQueries = new ArrayList<>();
    ownerQueries.add(queryBuilderFactory.termQuery("owner.id", user.getId().toString()));

    if (user.getTeams() != null) {
      for (EntityReference team : user.getTeams()) {
        ownerQueries.add(queryBuilderFactory.termQuery("owner.id", team.getId().toString()));
      }
    }

    for (OMQueryBuilder ownerQuery : ownerQueries) {
      collector.addShould(ownerQuery); // Add directly to the collector's should clause
    }
  }

  public void noOwner(ConditionCollector collector) {
    OMQueryBuilder existsQuery = queryBuilderFactory.existsQuery("owner.id");
    collector.addMustNot(existsQuery);
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
    if (nullOrEmpty(user.getDomains())) {
      OMQueryBuilder existsQuery = queryBuilderFactory.existsQuery("domain.id");
      collector.addMustNot(existsQuery);
    } else {
      List<String> userIds = user.getDomains().stream().map(ref -> ref.getId().toString()).toList();
      OMQueryBuilder domainQuery = queryBuilderFactory.termsQuery("domain.id", userIds);
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
            .collect(Collectors.toList());

    return queryBuilderFactory.termsQuery("_index", indices);
  }
}

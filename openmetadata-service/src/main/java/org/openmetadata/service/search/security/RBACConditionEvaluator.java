package org.openmetadata.service.search.security;

import java.util.*;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
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
        if (rule.getCondition() != null && rule.getEffect().toString().equalsIgnoreCase("DENY")) {
          ConditionCollector ruleCollector = new ConditionCollector(queryBuilderFactory);
          SpelExpression parsedExpression =
              (SpelExpression) spelParser.parseExpression(rule.getCondition());
          preprocessExpression(parsedExpression.getAST(), ruleCollector);
          collector.addMustNot(ruleCollector.buildFinalQuery());
        } else if (rule.getCondition() != null) {
          ConditionCollector ruleCollector = new ConditionCollector(queryBuilderFactory);
          SpelExpression parsedExpression =
              (SpelExpression) spelParser.parseExpression(rule.getCondition());
          preprocessExpression(parsedExpression.getAST(), ruleCollector);
          collector.addMust(ruleCollector.buildFinalQuery());
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
        collector.setMatchNothing(true); // NOT TRUE == FALSE
      } else if (subCollector.isMatchNothing()) {
        collector.addMust(queryBuilderFactory.matchAllQuery());
      } else {
        OMQueryBuilder subQuery = subCollector.buildFinalQuery();
        if (subQuery != null && !subQuery.isEmpty()) {
          collector.addMustNot(subQuery); // Add to must_not for negation
        }
      }
    } else if (node instanceof MethodReference) {
      handleMethodReference(node, collector);
    }
  }

  private void handleMethodReference(SpelNode node, ConditionCollector collector) {
    MethodReference methodRef = (MethodReference) node;
    String methodName = methodRef.getName();

    if (methodName.equals("matchAnyTag")) {
      List<String> tags = extractMethodArguments(methodRef);
      matchAnyTag(tags, collector);
    } else if (methodName.equals("matchAllTags")) {
      List<String> tags = extractMethodArguments(methodRef);
      matchAllTags(tags, collector);
    } else if (methodName.equals("isOwner")) {
      isOwner((User) spelContext.lookupVariable("user"), collector);
    } else if (methodName.equals("noOwner")) {
      noOwner(collector);
    } else if (methodName.equals("hasAnyRole")) {
      List<String> roles = extractMethodArguments(methodRef);
      hasAnyRole(roles, collector);
    } else if (methodName.equals("hasDomain")) {
      hasDomain(collector);
    } else if (methodName.equals("inAnyTeam")) {
      List<String> teams = extractMethodArguments(methodRef);
      inAnyTeam(teams, collector);
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
    if (user.getDomain() == null) {
      collector.setMatchNothing(true);
      return;
    }
    String userDomainId = user.getDomain().getId().toString();

    OMQueryBuilder domainQuery = queryBuilderFactory.termQuery("domain.id", userDomainId);
    collector.addMust(domainQuery);
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
}

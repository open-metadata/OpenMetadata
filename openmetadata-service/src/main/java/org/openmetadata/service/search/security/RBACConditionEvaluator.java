package org.openmetadata.service.search.security;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.queries.OMQueryBuilder;
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
import org.springframework.expression.spel.support.SimpleEvaluationContext;

public class RBACConditionEvaluator {

  private final ExpressionParser spelParser = new SpelExpressionParser();
  private final SimpleEvaluationContext spelContext;

  public RBACConditionEvaluator() {
    spelContext = SimpleEvaluationContext.forReadOnlyDataBinding().withInstanceMethods().build();
    spelContext.setVariable("matchAnyTag", this);
    spelContext.setVariable("matchAllTags", this);
    spelContext.setVariable("isOwner", this);
    spelContext.setVariable("noOwner", this);
  }

  public OMQueryBuilder evaluateConditions(SubjectContext subjectContext) {
    User user = subjectContext.user();
    ConditionCollector collector = new ConditionCollector();

    // Iterate over policies and collect conditions
    for (Iterator<SubjectContext.PolicyContext> it =
            subjectContext.getPolicies(List.of(user.getEntityReference()));
        it.hasNext(); ) {
      SubjectContext.PolicyContext context = it.next();
      for (CompiledRule rule : context.getRules()) {
        if (rule.getCondition() != null && rule.getEffect().toString().equalsIgnoreCase("DENY")) {
          OMQueryBuilder mustNotCondition = evaluateSpELCondition(rule.getCondition(), user);
          collector.addMustNot(mustNotCondition);
        } else if (rule.getCondition() != null) {
          OMQueryBuilder mustCondition = evaluateSpELCondition(rule.getCondition(), user);
          collector.addMust(mustCondition);
        }
      }
    }

    // Build and return the final query
    return collector.buildFinalQuery();
  }

  // Method to evaluate SpEL condition and collect conditions
  public OMQueryBuilder evaluateSpELCondition(String condition, User user) {
    spelContext.setVariable("user", user);
    SpelExpression parsedExpression = (SpelExpression) spelParser.parseExpression(condition);
    ConditionCollector collector = new ConditionCollector();
    preprocessExpression(parsedExpression.getAST(), collector);
    return collector.buildFinalQuery();
  }

  // Traverse SpEL expression tree and collect conditions (but don't build query yet)
  private void preprocessExpression(SpelNode node, ConditionCollector collector) {
    if (node instanceof OpAnd) {
      for (int i = 0; i < node.getChildCount(); i++) {
        preprocessExpression(node.getChild(i), collector);
      }
    } else if (node instanceof OpOr) {
      for (int i = 0; i < node.getChildCount(); i++) {
        preprocessExpression(node.getChild(i), collector);
      }
    } else if (node instanceof OperatorNot) {
      preprocessExpression(node.getChild(0), collector);
    } else if (node instanceof MethodReference) {
      handleMethodReference(node, collector);
    }
  }

  private void handleMethodReference(SpelNode node, ConditionCollector collector) {
    MethodReference methodRef = (MethodReference) node;
    String methodName = methodRef.getName();

    if (methodName.equals("matchAnyTag")) {
      List<String> tags = extractMethodArguments(methodRef);
      matchAnyTag(tags, collector); // Pass collector
    } else if (methodName.equals("matchAllTags")) {
      List<String> tags = extractMethodArguments(methodRef);
      matchAllTags(tags, collector); // Pass collector
    } else if (methodName.equals("isOwner")) {
      isOwner((User) spelContext.lookupVariable("user"), collector); // Pass collector
    } else if (methodName.equals("noOwner")) {
      noOwner(collector); // Pass collector
    }
  }

  // Handle method references like matchAnyTag, isOwner, etc.
  private List<String> convertArgsToList(List<Object> args) {
    return args.stream().map(Object::toString).toList();
  }

  private List<String> extractMethodArguments(MethodReference methodRef) {
    List<String> args = new ArrayList<>();
    for (int i = 0; i < methodRef.getChildCount(); i++) {
      SpelNode childNode = methodRef.getChild(i);
      args.add(childNode.toString());
    }
    return args;
  }

  public void matchAnyTag(List<String> tags, ConditionCollector collector) {
    List<OMQueryBuilder> tagQueries = new ArrayList<>();

    // Create a term query for each tag
    for (String tag : tags) {
      OMQueryBuilder tagQuery = new ElasticQueryBuilder().termQuery("tags.tagFQN", tag);
      tagQueries.add(tagQuery);
    }

    // Collect these as OR conditions without adding them to the query builder directly
    collector.addShould(tagQueries);
  }

  public void matchAllTags(List<String> tags, ConditionCollector collector) {
    List<OMQueryBuilder> tagQueries = new ArrayList<>();

    // Create a term query for each tag
    for (String tag : tags) {
      OMQueryBuilder tagQuery = new ElasticQueryBuilder().termQuery("tags.tagFQN", tag);
      tagQueries.add(tagQuery);
    }

    // Collect these as AND conditions without adding them to the query builder directly
    collector.addMust(tagQueries);
  }

  public void isOwner(User user, ConditionCollector collector) {
    // Collect the user's ID as an OR condition for ownership
    OMQueryBuilder ownerQuery =
        new ElasticQueryBuilder().termQuery("owner.id", user.getId().toString());

    // Collect this condition
    collector.addMust(ownerQuery);

    // Also collect team ownership conditions
    for (EntityReference team : user.getTeams()) {
      OMQueryBuilder teamQuery =
          new ElasticQueryBuilder().termQuery("owner.id", team.getId().toString());
      collector.addMust(teamQuery);
    }
  }

  public void noOwner(ConditionCollector collector) {
    // Collect the "no owner" condition (field does not exist)
    OMQueryBuilder noOwnerQuery = new ElasticQueryBuilder().existsQuery("owner.id");

    // Add this as a NOT condition
    collector.addMustNot(noOwnerQuery);
  }
}

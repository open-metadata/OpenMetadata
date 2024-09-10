package org.openmetadata.service.search.security;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
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

    // Register methods in the evaluation context
    spelContext.setVariable("matchAnyTag", this);
    spelContext.setVariable("matchAllTags", this);
    spelContext.setVariable("isOwner", this);
    spelContext.setVariable("noOwner", this);
  }

  public OMQueryBuilder evaluateConditions(
      SubjectContext subjectContext, OMQueryBuilder queryBuilder) {
    User user = subjectContext.user();
    Set<String> processedPolicies = new HashSet<>();

    Iterator<SubjectContext.PolicyContext> policies =
        subjectContext.getPolicies(List.of(user.getEntityReference()));

    while (policies.hasNext()) {
      SubjectContext.PolicyContext context = policies.next();
      if (processedPolicies.contains(context.getPolicyName())) {
        continue; // Skip already processed policies
      }
      processedPolicies.add(context.getPolicyName());

      for (CompiledRule rule : context.getRules()) {
        if ((rule.getOperations().contains(MetadataOperation.ALL)
                || rule.getOperations().contains(MetadataOperation.VIEW_ALL)
                || rule.getOperations().contains(MetadataOperation.VIEW_BASIC))
            && rule.getCondition() != null) {
          if (rule.getOperations().contains(MetadataOperation.ALL)
              && rule.getEffect().toString().equalsIgnoreCase("ALLOW")) {
            continue; // Skip allow rules with ALL operations
          }
          if (rule.getEffect().toString().equalsIgnoreCase("DENY")) {
            queryBuilder.mustNot(evaluateSpELCondition(rule.getCondition(), user, queryBuilder));
          } else {
            queryBuilder.must(evaluateSpELCondition(rule.getCondition(), user, queryBuilder));
          }
        }
      }
    }
    return queryBuilder;
  }

  // Main method to evaluate and convert SpEL to Elasticsearch/OpenSearch query
  public OMQueryBuilder evaluateSpELCondition(
      String condition, User user, OMQueryBuilder queryBuilder) {
    spelContext.setVariable("user", user);

    // Parse the expression and walk through the AST
    SpelExpression parsedExpression = (SpelExpression) spelParser.parseExpression(condition);

    // Handle the AST without over-complicating it
    handleExpressionNode(parsedExpression.getAST(), queryBuilder);

    return queryBuilder; // Return the global queryBuilder that has been modified
  }

  private void handleExpressionNode(SpelNode node, OMQueryBuilder queryBuilder) {
    if (node instanceof OperatorNot) {
      SpelNode child = node.getChild(0);
      queryBuilder.mustNot(createSubquery(child)); // Only append the negation here
      return;
    }

    if (node instanceof OpAnd) {
      for (int i = 0; i < node.getChildCount(); i++) {
        SpelNode child = node.getChild(i);
        queryBuilder.must(createSubquery(child)); // AND conditions should be appended here
      }
      return;
    }

    if (node instanceof OpOr) {
      for (int i = 0; i < node.getChildCount(); i++) {
        SpelNode child = node.getChild(i);
        queryBuilder.should(createSubquery(child)); // OR conditions should be appended here
      }
      queryBuilder.minimumShouldMatch(1); // At least one OR condition must match
      return;
    }

    if (node instanceof MethodReference) {
      handleMethodReference(node, queryBuilder); // Handle the method call and modify query
    }
  }

  // Method to create subqueries without adding excessive boolQuery layers
  private OMQueryBuilder createSubquery(SpelNode node) {
    OMQueryBuilder subquery = new ElasticQueryBuilder(); // Or any implementation
    handleExpressionNode(node, subquery); // Recursively build the subquery
    return subquery; // Return the subquery to be appended to the main one
  }

  private void handleMethodReference(SpelNode node, OMQueryBuilder queryBuilder) {
    if (node instanceof MethodReference) {
      MethodReference methodRef = (MethodReference) node;
      String methodName = methodRef.getName();
      List<Object> args = extractMethodArguments(methodRef);

      // Directly invoke the method and modify the queryBuilder in place
      invokeMethod(methodName, args, queryBuilder);
    }
  }

  // Helper method to extract arguments from a method reference node
  private List<Object> extractMethodArguments(MethodReference methodRef) {
    List<Object> args = new ArrayList<>();
    for (int i = 0; i < methodRef.getChildCount(); i++) {
      SpelNode childNode = methodRef.getChild(i);
      Object value = spelParser.parseExpression(childNode.toString()).getValue(spelContext);
      args.add(value);
    }
    return args;
  }

  // Invoke methods dynamically based on method name
  private void invokeMethod(String methodName, List<Object> args, OMQueryBuilder queryBuilder) {
    switch (methodName) {
      case "matchAnyTag":
        if (!args.isEmpty()) {
          matchAnyTag(convertArgsToList(args), queryBuilder);
        }
        break;
      case "matchAllTags":
        if (!args.isEmpty()) {
          matchAllTags(convertArgsToList(args), queryBuilder);
        }
        break;
      case "isOwner":
        isOwner((User) spelContext.lookupVariable("user"), queryBuilder);
        break;
      case "noOwner":
        noOwner(queryBuilder);
        break;
      default:
        throw new IllegalArgumentException("Unsupported method: " + methodName);
    }
  }

  private List<String> convertArgsToList(List<Object> args) {
    return args.stream().map(Object::toString).toList();
  }

  // Ensure that the methods append conditions directly to the passed queryBuilder
  public void matchAnyTag(List<String> tags, OMQueryBuilder queryBuilder) {
    for (String tag : tags) {
      queryBuilder.should(queryBuilder.termQuery("tags.tagFQN", tag));
    }
    queryBuilder.minimumShouldMatch(1);
  }

  public void matchAllTags(List<String> tags, OMQueryBuilder queryBuilder) {
    for (String tag : tags) {
      queryBuilder.must(queryBuilder.boolQuery().termQuery("tags.tagFQN", tag));
    }
  }

  public void isOwner(User user, OMQueryBuilder queryBuilder) {
    queryBuilder.should(queryBuilder.boolQuery().termQuery("owner.id", user.getId().toString()));
    for (EntityReference team : user.getTeams()) {
      queryBuilder.should(queryBuilder.boolQuery().termQuery("owner.id", team.getId().toString()));
    }
  }

  public void noOwner(OMQueryBuilder queryBuilder) {
    queryBuilder.mustNot(queryBuilder.boolQuery().existsQuery("owner.id"));
  }
}

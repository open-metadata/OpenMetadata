package org.openmetadata.service.search;

import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

public class RBACConditionEvaluator {

  private static final Pattern FUNCTION_PATTERN = Pattern.compile("([a-zA-Z]+)\\((.*)\\)");

  public QueryBuilder evaluateConditions(SubjectContext subjectContext) {
    BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery();
    User user = subjectContext.user();
    Set<String> processedPolicies = new HashSet<>();

    Iterator<SubjectContext.PolicyContext> policies =
        subjectContext.getPolicies(List.of(user.getEntityReference()));
    while (policies.hasNext()) {
      SubjectContext.PolicyContext context = policies.next();
      String policyName = context.getPolicyName();
      if (processedPolicies.contains(policyName)) {
        continue;
      }
      processedPolicies.add(policyName);

      for (CompiledRule rule : context.getRules()) {
        if ((rule.getOperations().contains(MetadataOperation.ALL)
                || rule.getOperations().contains(MetadataOperation.VIEW_ALL)
                || rule.getOperations().contains(MetadataOperation.VIEW_BASIC))
            && rule.getCondition() != null) {

          // Skip allow rules with ALL operations
          if (rule.getOperations().contains(MetadataOperation.ALL)
              && rule.getEffect().toString().equalsIgnoreCase("ALLOW")) {
            continue;
          }
          if (rule.getEffect().toString().equalsIgnoreCase("DENY")) {
            queryBuilder.mustNot(evaluateComplexCondition(user, rule.getCondition()));
          } else {
            queryBuilder.must(evaluateComplexCondition(user, rule.getCondition()));
          }
        }
      }
    }
    return queryBuilder;
  }

  private QueryBuilder evaluateComplexCondition(User user, String condition) {
    condition = condition.trim();
    return parseLogicalCondition(user, condition);
  }

  private QueryBuilder parseLogicalCondition(User user, String condition) {
    if (condition.startsWith("(") && condition.endsWith(")")) {
      return parseLogicalCondition(user, condition.substring(1, condition.length() - 1).trim());
    }

    // handle OR (`||`) first
    List<String> orParts = splitByOperator(condition, "||");
    if (orParts.size() > 1) {
      BoolQueryBuilder orQuery = QueryBuilders.boolQuery();
      for (String orPart : orParts) {
        orQuery.should(parseLogicalCondition(user, orPart.trim()));
      }
      orQuery.minimumShouldMatch(1); // At least one OR condition must match
      return orQuery;
    }

    // Then handle AND (`&&`)
    List<String> andParts = splitByOperator(condition, "&&");
    if (andParts.size() > 1) {
      BoolQueryBuilder andQuery = QueryBuilders.boolQuery();
      for (String andPart : andParts) {
        andQuery.must(parseLogicalCondition(user, andPart.trim()));
      }
      return andQuery;
    }

    return evaluateRuleCondition(user, condition);
  }

  private List<String> splitByOperator(String condition, String operator) {
    List<String> parts = new ArrayList<>();
    int parenthesesDepth = 0;
    int lastIndex = 0;

    for (int i = 0; i < condition.length(); i++) {
      char c = condition.charAt(i);
      if (c == '(') parenthesesDepth++;
      if (c == ')') parenthesesDepth--;

      if (parenthesesDepth == 0 && condition.startsWith(operator, i)) {
        parts.add(condition.substring(lastIndex, i).trim());
        lastIndex = i + operator.length();
      }
    }
    parts.add(condition.substring(lastIndex).trim());
    return parts;
  }

  private QueryBuilder evaluateRuleCondition(User user, String condition) {
    boolean isNegated = false;
    if (condition.startsWith("!")) {
      isNegated = true;
      condition = condition.substring(1).trim(); // Handle negation
    }

    Matcher matcher = FUNCTION_PATTERN.matcher(condition);
    if (matcher.find()) {
      String functionName = matcher.group(1);
      String arguments = matcher.group(2);

      List<String> argsList = Arrays.asList(arguments.replace("'", "").split(",\\s*"));

      QueryBuilder query =
          switch (functionName) {
            case "isOwner" -> isOwner(user);
            case "noOwner" -> noOwner();
            case "matchAllTags" -> matchAllTags(argsList);
            case "matchAnyTag" -> matchAnyTag(argsList);
            case "matchTeam" -> matchTeam(user.getTeams());
            default -> throw new IllegalArgumentException("Unsupported condition: " + functionName);
          };

      return isNegated ? QueryBuilders.boolQuery().mustNot(query) : query;
    } else {
      throw new IllegalArgumentException("Invalid condition format: " + condition);
    }
  }

  private QueryBuilder isOwner(User user) {
    List<EntityReference> userTeams = user.getTeams();
    BoolQueryBuilder ownerQuery = QueryBuilders.boolQuery();

    if (userTeams != null) {
      for (EntityReference team : userTeams) {
        if (team.getId() != null) {
          ownerQuery.should(QueryBuilders.termQuery("owner.id", team.getId().toString()));
        }
      }
    }
    ownerQuery.should(QueryBuilders.termQuery("owner.id", user.getId().toString()));
    return ownerQuery;
  }

  private QueryBuilder noOwner() {
    return QueryBuilders.boolQuery().mustNot(QueryBuilders.existsQuery("owner.id"));
  }

  private QueryBuilder matchAllTags(List<String> tags) {
    BoolQueryBuilder tagQuery = QueryBuilders.boolQuery();
    for (String tag : tags) {
      tagQuery.must(QueryBuilders.termQuery("tags.tagFQN", tag));
    }
    return tagQuery;
  }

  private QueryBuilder matchAnyTag(List<String> tags) {
    BoolQueryBuilder tagQuery = QueryBuilders.boolQuery();
    for (String tag : tags) {
      tagQuery.should(QueryBuilders.termQuery("tags.tagFQN", tag));
    }
    tagQuery.minimumShouldMatch(1);
    return tagQuery;
  }

  private QueryBuilder matchTeam(List<EntityReference> teams) {
    BoolQueryBuilder teamQuery = QueryBuilders.boolQuery();
    for (EntityReference team : teams) {
      teamQuery.should(QueryBuilders.termQuery("owner.id", team.getId()));
    }
    teamQuery.minimumShouldMatch(1);
    return teamQuery;
  }
}

package org.openmetadata.service.search;

import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

public class RBACConditionEvaluator {

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
          if (rule.getOperations().contains(MetadataOperation.ALL)
              && rule.getEffect().toString().equalsIgnoreCase("ALLOW")) {
            continue; // Skip allow rules with ALL operations
          }
          if (rule.getEffect().toString().equalsIgnoreCase("DENY")) {
            queryBuilder.mustNot(evaluateRuleCondition(user, rule));
          } else {
            queryBuilder.must(evaluateRuleCondition(user, rule));
          }
        }
      }
    }
    return queryBuilder;
  }

  // Evaluate individual rule condition and return the corresponding Elasticsearch query
  private QueryBuilder evaluateRuleCondition(User user, Rule rule) {
    // Extract function name and arguments from the rule condition string
    String condition = rule.getCondition();
    Pattern pattern = Pattern.compile("([a-zA-Z]+)\\((.*)\\)");
    Matcher matcher = pattern.matcher(condition);

    if (matcher.find()) {
      String functionName = matcher.group(1);
      String arguments = matcher.group(2);

      // Parse arguments as a list, assuming they are comma-separated and enclosed in single quotes
      List<String> argsList = Arrays.asList(arguments.replaceAll("'", "").split(",\\s*"));

      // Based on the function name, call the corresponding query builder method
      return switch (functionName) {
        case "isOwner" -> isOwner(user);
        case "noOwner" -> noOwner();
        case "matchAllTags" -> matchAllTags(argsList);
        case "matchAnyTag" -> matchAnyTag(argsList);
        case "matchTeam" -> matchTeam(user.getTeams());
        default -> throw new IllegalArgumentException("Unsupported condition: " + functionName);
      };
    } else {
      throw new IllegalArgumentException("Invalid condition format: " + condition);
    }
  }

  private QueryBuilder isOwner(User user) {
    List<EntityReference> userTeams = user.getTeams();
    BoolQueryBuilder ownerQuery = QueryBuilders.boolQuery();

    // Ensure userTeams is not null or empty
    if (userTeams != null) {
      for (EntityReference team : userTeams) {
        if (team.getId() != null) {
          ownerQuery.should(QueryBuilders.termQuery("owner.id", team.getId().toString()));
        }
      }
    }

    // Ensure the user ID is not null
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

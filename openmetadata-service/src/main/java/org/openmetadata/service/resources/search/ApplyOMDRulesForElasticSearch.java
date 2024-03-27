package org.openmetadata.service.resources.search;

import static org.openmetadata.service.Entity.*;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import java.io.IOException;
import java.util.*;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.tags.ClassificationResource;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.springframework.expression.spel.SpelNode;
import org.springframework.expression.spel.ast.*;
import org.springframework.expression.spel.standard.SpelExpression;

public class ApplyOMDRulesForElasticSearch {
  Map<String, String> indexToRuleMap;
  Map<String, String> ruleToIndexMap;
  User loggedInUser;
  List<Classification> tagCategoryList;

  public ApplyOMDRulesForElasticSearch() {
    indexToRuleMap = new HashMap<>();
    indexToRuleMap.put("topic_search_index", TOPIC);
    indexToRuleMap.put("dashboard_search_index", DASHBOARD);
    indexToRuleMap.put("pipeline_search_index", PIPELINE);
    indexToRuleMap.put("mlmodel_search_index", MLMODEL);
    indexToRuleMap.put("table_search_index", TABLE);
    indexToRuleMap.put("user_search_index", USER);
    indexToRuleMap.put("team_search_index", TEAM);
    indexToRuleMap.put("glossary_search_index", GLOSSARY);
    indexToRuleMap.put("glossary_term_search_index", GLOSSARY_TERM);
    indexToRuleMap.put("tag_search_index", TAG);
  }

  public SearchSourceBuilder applyForQuery(
      UriInfo uriInfo, SecurityContext securityContext, SearchSourceBuilder searchSourceBuilder, String index)
      throws IOException {

    // get loggedInUser
    loggedInUser = getLoggedInUser(uriInfo, securityContext);
    if (loggedInUser.getIsAdmin()) return searchSourceBuilder;

    tagCategoryList = getListOfAllTags();

    // base query
    BoolQueryBuilder baseQueryBuilder = QueryBuilders.boolQuery();
    // baseQueryBuilder.must(searchSourceBuilder.query()).must(QueryBuilders.termQuery("deleted", deleted));

    // Extract and Apply rules
    SubjectContext subjectContext = getSubjectContext(securityContext);
    Iterator<SubjectContext.PolicyContext> policies = subjectContext.getPolicies(subjectContext.user().getOwner());

    // For Apply both 'Deny' and 'Allow' rules
    boolean anyRuleApplied = false;
    while (policies.hasNext()) {
      SubjectContext.PolicyContext context = policies.next();
      for (CompiledRule rule : context.getRules()) {
        if ((rule.getResources().contains(indexToRuleMap.get(index))
                || rule.getResources().toString().toLowerCase().contains("all"))
            && (rule.getOperations().contains(MetadataOperation.ALL)
                || rule.getOperations().contains(MetadataOperation.VIEW_ALL))) {
          // Check Conditions
          if (rule.getCondition() == null) {
            if (rule.getEffect().equals(Rule.Effect.DENY)) {
              baseQueryBuilder.mustNot(searchSourceBuilder.query()); // 'MustNot' because of DENY rule
            } else {
              baseQueryBuilder.should(searchSourceBuilder.query()); // 'should' because of Allow rule
            }
          } else {
            SpelExpression ruleExpression = (SpelExpression) rule.getExpression();
            var rootAst = ruleExpression.getAST();
            BoolQueryBuilder boolQueryBuilder = createQueryBuilderBasedOnRule(rootAst);
            if (rule.getEffect().equals(Rule.Effect.DENY)) {
              baseQueryBuilder.mustNot(boolQueryBuilder); // 'MustNot' because of DENY rule
            } else {
              baseQueryBuilder.should(boolQueryBuilder); // 'should' because of Allow rule
            }
          }
          anyRuleApplied = true;
        }
      } // End of for
    } // End of while

    // If there is no rule applied to query, we return an empty result
    if (!anyRuleApplied) {
      return searchSourceBuilder.query(
          QueryBuilders.boolQuery().must(searchSourceBuilder.query()).must(QueryBuilders.queryStringQuery("")));
    }

    /*
        // For Apply just 'Deny' Rules
        while (policies.hasNext()) {
          SubjectContext.PolicyContext context = policies.next();
          for (CompiledRule rule : context.getRules()) {
            if ((rule.getResources().contains(indexToRuleMap.get(index))
                    || rule.getResources().toString().toLowerCase().contains("all"))
                    && (rule.getOperations().contains(MetadataOperation.ALL)
                    || rule.getOperations().contains(MetadataOperation.VIEW_ALL))
                    && rule.getEffect().equals(Rule.Effect.DENY)) {
              // Check Conditions
              if (rule.getCondition() == null) {
                baseQueryBuilder.mustNot(searchSourceBuilder.query()); // 'MustNot' because of DENY rule
              } else {
                SpelExpression ruleExpression = (SpelExpression) rule.getExpression();
                var rootAst = ruleExpression.getAST();
                BoolQueryBuilder boolQueryBuilder = createQueryBuilderBasedOnRule(rootAst);
                baseQueryBuilder.mustNot(boolQueryBuilder); // 'MustNot' because of DENY rule
              }
            }
          } // End of for
        } // End of while
    */

    // Combine searchSourceBuilder.query() with new Query that enforce policy rules
    searchSourceBuilder.query(QueryBuilders.boolQuery().must(searchSourceBuilder.query()).must(baseQueryBuilder));
    return searchSourceBuilder;
  }

  private BoolQueryBuilder createQueryBuilderBasedOnRule(SpelNode ast) throws IOException {
    try {
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
      var keyword = ast2keyword(ast);

      if (ast.getChildCount() == 0) {
        if (keyword.contains("isOwner"))
          return boolQueryBuilder.must(QueryBuilders.termQuery("owner.name", loggedInUser.getName()));
        else if (keyword.contains("noOwner")) return boolQueryBuilder.mustNot(QueryBuilders.existsQuery("owner.name"));
        else if (keyword.contains("matchTeam"))
          // Note: rule like: <Table, ViewAll, Deny, MatchTeam()> throw exception in OMD. Elastic search work properly,
          // but OMD prevent access to resources that owned by other teams
          return boolQueryBuilder.must(QueryBuilders.termsQuery("owner.name", getTeamForLoggedInUser()));
        else if (isKeywordContainTier(keyword)) // Tier
        return boolQueryBuilder.must(QueryBuilders.termQuery("tier.tagFQN", keyword.replace("'", "")));
        else if (isKeywordContainTags(keyword)) // Tags
        return boolQueryBuilder.must(QueryBuilders.termQuery("tags.tagFQN", keyword.replace("'", "")));
        else throw new Exception("Unsupported Elastic Query!");

      } else if (ast.getChildCount() == 1) {
        if (keyword.contains("NOT")) return boolQueryBuilder.mustNot(createQueryBuilderBasedOnRule(ast.getChild(0)));
        if (keyword.contains("matchAllTags"))
          return boolQueryBuilder.must(createQueryBuilderBasedOnRule(ast.getChild(0)));
        else throw new Exception("Unsupported Elastic Query!");

      } else { // if(ast.getChildCount() >= 2)
        List<BoolQueryBuilder> boolQueryBuilderArrayList = new ArrayList<>();
        for (int i = 0; i < ast.getChildCount(); i++)
          boolQueryBuilderArrayList.add(createQueryBuilderBasedOnRule(ast.getChild(i)));

        if (keyword.contains("and"))
          for (var currentQuery : boolQueryBuilderArrayList) {
            boolQueryBuilder.must(currentQuery);
          }
        else if (keyword.contains("or"))
          for (var currentQuery : boolQueryBuilderArrayList) {
            boolQueryBuilder.should(currentQuery);
          }
        else if (keyword.contains("matchAllTags"))
          for (var currentQuery : boolQueryBuilderArrayList) {
            boolQueryBuilder.must(currentQuery);
          }
        else if (keyword.contains("matchAnyTag"))
          for (var currentQuery : boolQueryBuilderArrayList) {
            boolQueryBuilder.should(currentQuery);
          }
        else throw new Exception("Unsupported Elastic Query!");

        return boolQueryBuilder;
      }
    } catch (Exception ex) {
      throw new IOException(ex.getMessage());
    }
  }

  private String ast2keyword(SpelNode ast) throws Exception {
    if (ast instanceof MethodReference) return ((MethodReference) ast).getName();
    else if (ast instanceof PropertyOrFieldReference) return ((PropertyOrFieldReference) ast).getName();
    else if (ast instanceof StringLiteral) return ((StringLiteral) ast).getOriginalValue();
    else if (ast instanceof Operator) return ((Operator) ast).getOperatorName();
    else if (ast instanceof OperatorNot) return "NOT";
    else throw new Exception("Unsupported Elastic Keyword!");
  }

  private User getLoggedInUser(UriInfo uriInfo, SecurityContext securityContext) throws IOException {
    var servicesList = CollectionRegistry.getInstance().getCollectionMap();
    var userService = servicesList.get("/v1/users");
    var loggedInUser =
        ((UserResource) userService.getResource())
            .getCurrentLoggedInUser(uriInfo, securityContext, "profile,teams,roles");
    return loggedInUser;
  }

  private List<String> getTeamForLoggedInUser() {
    List<String> teamList = new ArrayList<>();
    for (var currentTeam : loggedInUser.getTeams()) {
      teamList.add(currentTeam.getName());
    }
    return teamList;
  }

  private boolean isKeywordContainTier(String keyword) {
    keyword = keyword.replace("'", "");
    var splitArray = keyword.trim().toLowerCase().split("\\.");
    if (splitArray.length > 0 && splitArray[0].equals("tier")) return true;
    return false;
  }

  private boolean isKeywordContainTags(String keyword) {
    for (var currentTag : tagCategoryList) {
      if (keyword.contains(currentTag.getName())) return true;
    }
    return false;
  }

  private List<Classification> getListOfAllTags() {
    var servicesList = CollectionRegistry.getInstance().getCollectionMap();
    var classificationService = servicesList.get("/v1/classifications");
    var classificationRepository = ((ClassificationResource) classificationService.getResource()).getRepository();
    var classificationList =
        classificationRepository.listAll(classificationRepository.getFields(""), new ListFilter(null));
    return classificationList;
  }
}

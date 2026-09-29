package org.openmetadata.service.search.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.ServiceAttributeResolver;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.SpelNode;
import org.springframework.expression.spel.ast.MethodReference;
import org.springframework.expression.spel.ast.OpAnd;
import org.springframework.expression.spel.ast.OpOr;
import org.springframework.expression.spel.ast.OperatorNot;
import org.springframework.expression.spel.ast.StringLiteral;
import org.springframework.expression.spel.standard.SpelExpression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

@Slf4j
public class RBACConditionEvaluator {

  private final QueryBuilderFactory queryBuilderFactory;
  private final ExpressionParser spelParser = new SpelExpressionParser();
  private final Cache<String, SpelExpression> expressionCache =
      Caffeine.newBuilder().maximumSize(512).build();
  private final StandardEvaluationContext spelContext;
  private static final Set<MetadataOperation> SEARCH_RELEVANT_OPS =
      Set.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_ALL, MetadataOperation.ALL);

  /**
   * Function names already reported by {@link #warnUntranslatedFunction}. Conditions that ship in
   * the product hit that path — {@code TeamOnlyPolicy} carries {@code !matchTeam()} on {@code All}
   * operations — and the ElasticSearch path has no compiled-query cache, so warning per call would
   * emit a line on every search request from every affected user. Capped because the names come
   * from user-authored policy conditions.
   */
  private static final Set<String> WARNED_UNTRANSLATED_FUNCTIONS = ConcurrentHashMap.newKeySet();

  private static final int MAX_WARNED_UNTRANSLATED_FUNCTIONS = 128;

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
      SpelExpression parsedExpression = parseCondition(rule.getCondition());
      preprocessExpression(parsedExpression.getAST(), ruleCollector);
    } else {
      ruleCollector.addMust(queryBuilderFactory.matchAllQuery());
    }

    return ruleCollector.buildFinalQuery();
  }

  SpelExpression parseCondition(String condition) {
    return expressionCache.get(
        condition, value -> (SpelExpression) spelParser.parseExpression(value));
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
      case "isReviewer" -> isReviewer((User) spelContext.lookupVariable("user"), collector);
      case "hasAnyRole" -> {
        List<String> roles = extractMethodArguments(methodRef);
        hasAnyRole(roles, collector);
      }
      case "hasDomain" -> hasDomain(collector);
      case "inAnyTeam" -> {
        List<String> teams = extractMethodArguments(methodRef);
        inAnyTeam(teams, collector);
      }
      case "matchAnyServiceTag" -> matchAnyServiceAttribute(
          extractMethodArguments(methodRef),
          ServiceAttributeResolver::serviceIdsForTags,
          collector);
      case "matchAnyServiceName" -> matchAnyServiceAttribute(
          extractMethodArguments(methodRef),
          ServiceAttributeResolver::serviceIdsForNames,
          collector);
      case "matchAnyServiceEnvironment" -> matchAnyServiceAttribute(
          extractMethodArguments(methodRef),
          ServiceAttributeResolver::serviceIdsForEnvironments,
          collector);
      case "matchAnyServiceType" -> matchAnyServiceType(
          extractMethodArguments(methodRef), collector);
      default -> warnUntranslatedFunction(methodName);
    }
  }

  /**
   * A {@code @Function} with no case above contributes no clause, and the resulting query is wrong
   * in a way nothing else reports: a scoped Allow rule widens to every document in its indices, a
   * scoped Deny hides those indices outright, and an {@code All}-scoped rule is dropped entirely.
   * Warn so adding a policy function without a search translation is at least visible.
   */
  private void warnUntranslatedFunction(String methodName) {
    if (WARNED_UNTRANSLATED_FUNCTIONS.size() >= MAX_WARNED_UNTRANSLATED_FUNCTIONS
        || !WARNED_UNTRANSLATED_FUNCTIONS.add(methodName)) {
      return;
    }
    LOG.warn(
        "No search translation for policy condition function '{}'. Its clause is omitted from the "
            + "RBAC search filter, so search results may not match the authorization decision "
            + "for this rule. This is logged once per function name.",
        methodName);
  }

  private List<String> extractMethodArguments(MethodReference methodRef) {
    List<String> args = new ArrayList<>();
    for (int i = 0; i < methodRef.getChildCount(); i++) {
      args.add(literalArgumentValue(methodRef.getChild(i)));
    }
    return args;
  }

  /**
   * Reads a condition argument as the value the SpEL parser resolved, not as its source text. The
   * previous approach stripped every {@code '} from {@code toStringAST()}, which mangled any
   * argument whose own content contains an apostrophe — {@code 'Business Glossary.Men''s Wear'}
   * became {@code Business Glossary.Mens Wear}. The REST evaluator receives the un-mangled literal
   * from SpEL, so a mangled argument here makes the search filter disagree with the authorization
   * decision on the very same rule.
   */
  private String literalArgumentValue(SpelNode node) {
    if (node instanceof StringLiteral stringLiteral) {
      return String.valueOf(stringLiteral.getLiteralValue().getValue());
    }
    return node.toStringAST();
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

  /**
   * Matches every asset ingested by a service that {@code resolveServiceIds} maps {@code arguments}
   * to, plus the service documents themselves so a Deny hides a service alongside its assets —
   * mirroring {@code ResourceContext} treating a service as its own service.
   *
   * <p>No arguments, or arguments matching no service, means the condition is provably false for
   * every document, and that must be said explicitly rather than by emitting {@code
   * terms(service.id, [])}. An empty terms clause is indistinguishable from a real one to {@link
   * ConditionCollector} — it is neither {@code isEmpty}, {@code isMatchNone} nor {@code isMatchAll}
   * — so the OR and NOT short-circuits never fire, and the correctness of the resulting query rests
   * on undocumented empty-terms behaviour in two client libraries. {@code setMatchNothing} is what
   * {@code hasAnyRole} and {@code inAnyTeam} already use for the same "decided in Java" situation.
   */
  private void matchAnyServiceAttribute(
      List<String> arguments,
      Function<List<String>, Set<String>> resolveServiceIds,
      ConditionCollector collector) {
    if (arguments.isEmpty()) {
      collector.setMatchNothing(true);
      return;
    }
    Set<String> serviceIds = resolveServiceIds.apply(arguments);
    if (serviceIds.isEmpty()) {
      collector.setMatchNothing(true);
      return;
    }
    List<String> ids = List.copyOf(serviceIds);
    collector.addMust(
        queryBuilderFactory
            .boolQuery()
            .should(
                List.of(
                    queryBuilderFactory.termsQuery("service.id", ids),
                    queryBuilderFactory.termsQuery("id.keyword", ids))));
  }

  /**
   * {@code serviceType} is indexed on most asset documents and on the service document, and its
   * mapping carries a lowercase normalizer that is applied to the query term too — matching the
   * case-insensitive comparison the REST evaluator makes.
   *
   * <p>It is not enough on its own. Six indexes — {@code ingestion_pipeline}, {@code query},
   * {@code query_cost_record}, {@code test_case}, {@code test_case_result} and
   * {@code test_case_resolution_status} — index {@code service} without {@code serviceType}, so a
   * type-only clause would leave those documents visible under a Deny the REST path enforces. The
   * resolved service ids are OR'd in to cover them; the two clauses are redundant everywhere else,
   * which is harmless.
   */
  private void matchAnyServiceType(List<String> serviceTypes, ConditionCollector collector) {
    if (serviceTypes.isEmpty()) {
      collector.setMatchNothing(true);
      return;
    }
    List<OMQueryBuilder> clauses = new ArrayList<>();
    clauses.add(queryBuilderFactory.termsQuery("serviceType", serviceTypes));
    Set<String> serviceIds = ServiceAttributeResolver.serviceIdsForTypes(serviceTypes);
    if (!serviceIds.isEmpty()) {
      List<String> ids = List.copyOf(serviceIds);
      clauses.add(queryBuilderFactory.termsQuery("service.id", ids));
      clauses.add(queryBuilderFactory.termsQuery("id.keyword", ids));
    }
    collector.addMust(queryBuilderFactory.boolQuery().should(clauses));
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
    ownerQueries.add(
        queryBuilderFactory.nestedQuery(
            "owners", queryBuilderFactory.termQuery("owners.id", user.getId().toString())));

    if (user.getTeams() != null) {
      for (EntityReference team : user.getTeams()) {
        ownerQueries.add(
            queryBuilderFactory.nestedQuery(
                "owners", queryBuilderFactory.termQuery("owners.id", team.getId().toString())));
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
    OMQueryBuilder existsQuery =
        queryBuilderFactory.nestedQuery("owners", queryBuilderFactory.existsQuery("owners.id"));
    collector.addMustNot(existsQuery);
  }

  public void isReviewer(User user, ConditionCollector collector) {
    List<OMQueryBuilder> reviewerQueries = new ArrayList<>();
    // Reviewer is the user
    reviewerQueries.add(queryBuilderFactory.termQuery("reviewers.id", user.getId().toString()));

    // Reviewer could also be any of the user's teams
    if (user.getTeams() != null) {
      for (EntityReference team : user.getTeams()) {
        reviewerQueries.add(queryBuilderFactory.termQuery("reviewers.id", team.getId().toString()));
      }
    }

    OMQueryBuilder reviewerQuery;
    if (reviewerQueries.size() == 1) {
      reviewerQuery = reviewerQueries.get(0);
    } else {
      reviewerQuery = queryBuilderFactory.boolQuery().should(reviewerQueries);
    }

    collector.addMust(reviewerQuery);
  }

  public void hasAnyRole(List<String> roles, ConditionCollector collector) {
    User user = (User) spelContext.lookupVariable("user");
    boolean hasRole = roles.stream().anyMatch(role -> SubjectContext.hasRole(user, role));

    if (hasRole) {
      collector.addMust(queryBuilderFactory.matchAllQuery());
    } else {
      collector.setMatchNothing(true);
    }
  }

  public void hasDomain(ConditionCollector collector) {
    User user = (User) spelContext.lookupVariable("user");
    if (user == null || nullOrEmpty(user.getDomains())) {
      // No user domains: only domainless entities, and never any Domain entity itself.
      collector.addMustNot(queryBuilderFactory.existsQuery("domains.id"));
      collector.addMustNot(queryBuilderFactory.termQuery("entityType", Entity.DOMAIN));
    } else {
      List<OMQueryBuilder> domainQueries = new ArrayList<>();
      List<String> userDomainIds = new ArrayList<>();
      for (EntityReference domain : user.getDomains()) {
        String domainId = domain.getId().toString();
        domainQueries.add(queryBuilderFactory.termQuery("domains.id", domainId));
        userDomainIds.add(domainId);
      }
      // A Domain entity is not itself domain-tagged, so the domains.id clauses never match a Domain
      // document. Match the user's own domains by their id so the Domain index search does not leak
      // other domains' names to a domain-restricted user.
      domainQueries.add(queryBuilderFactory.termsQuery("id.keyword", userDomainIds));
      // Domainless entities stay visible, but a Domain document must not slip through here.
      domainQueries.add(
          queryBuilderFactory
              .boolQuery()
              .mustNot(
                  List.of(
                      queryBuilderFactory.existsQuery("domains.id"),
                      queryBuilderFactory.termQuery("entityType", Entity.DOMAIN))));
      collector.addMust(queryBuilderFactory.boolQuery().should(domainQueries));
    }
  }

  public void inAnyTeam(List<String> teamNames, ConditionCollector collector) {
    User user = (User) spelContext.lookupVariable("user");
    if (user.getTeams() == null || user.getTeams().isEmpty()) {
      collector.setMatchNothing(true);
      return;
    }
    boolean inTeam =
        teamNames.stream()
            .anyMatch(
                teamName ->
                    user.getTeams().stream()
                        .anyMatch(
                            userTeam ->
                                userTeam.getName().equals(teamName)
                                    || SubjectContext.isInTeam(teamName, userTeam)));
    if (inTeam) {
      collector.addMust(queryBuilderFactory.matchAllQuery());
    } else {
      collector.setMatchNothing(true);
    }
  }

  private OMQueryBuilder getIndexFilter(List<String> resources) {
    var searchRepository = Entity.getSearchRepository();
    List<String> indices = new ArrayList<>();
    for (String resource : resources) {
      if (searchRepository == null) {
        LOG.warn(
            "SearchRepository is not initialized while building RBAC index filter for resource [{}]; falling back to resource name",
            resource);
        indices.add(resource.toLowerCase());
        continue;
      }
      indices.add(searchRepository.getIndexOrAliasName(resource));
      for (String childAlias : searchRepository.getChildIndexAliases(resource)) {
        indices.add(searchRepository.getIndexOrAliasName(childAlias));
      }
    }
    return queryBuilderFactory.termsQuery("_index", indices);
  }
}

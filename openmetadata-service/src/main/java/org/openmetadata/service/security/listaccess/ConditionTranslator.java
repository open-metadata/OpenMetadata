package org.openmetadata.service.security.listaccess;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.SecurityUtil.sameIdentifier;
import static org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason.TEAM_SET_TOO_LARGE;
import static org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason.UNTRANSLATED_CONDITION;
import static org.openmetadata.service.security.listaccess.RowPredicate.FALSE;
import static org.openmetadata.service.security.listaccess.RowPredicate.TRUE;
import static org.openmetadata.service.security.listaccess.RowPredicate.unknown;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.listaccess.RowPredicate.NoDomain;
import org.openmetadata.service.security.listaccess.RowPredicate.NoOwner;
import org.openmetadata.service.security.listaccess.RowPredicate.TaggedAll;
import org.openmetadata.service.security.listaccess.RowPredicate.TaggedAny;
import org.openmetadata.service.security.listaccess.TeamTree.TeamSubtree;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.SpelNode;
import org.springframework.expression.spel.ast.BooleanLiteral;
import org.springframework.expression.spel.ast.MethodReference;
import org.springframework.expression.spel.ast.OpAnd;
import org.springframework.expression.spel.ast.OpOr;
import org.springframework.expression.spel.ast.OperatorNot;
import org.springframework.expression.spel.ast.StringLiteral;
import org.springframework.expression.spel.standard.SpelExpression;

/**
 * Turns the condition of one rule into a row predicate for one caller and one listed type. Facts
 * about the caller fold to constants and facts about the row become leaves, each with the meaning
 * its {@code RuleEvaluator} function gives it. A condition or function without a translation
 * becomes an approximation, so the SQL stays a superset and the per-row check decides.
 */
@Slf4j
final class ConditionTranslator {
  private final Caller caller;
  private final TeamTree teams;
  private final String listedType;

  ConditionTranslator(Caller caller, TeamTree teams, String listedType) {
    this.caller = caller;
    this.teams = teams;
    this.listedType = listedType;
  }

  RowPredicate translate(CompiledRule rule, PolicyRules policy) {
    RowPredicate translated = TRUE;
    if (!nullOrEmpty(rule.getCondition())) {
      translated =
          syntaxTree(rule).map(tree -> node(tree, policy)).orElse(unknown(UNTRANSLATED_CONDITION));
    }
    return translated;
  }

  private static Optional<SpelNode> syntaxTree(CompiledRule rule) {
    Optional<SpelNode> tree = Optional.empty();
    try {
      Expression expression = rule.getExpression();
      if (expression instanceof SpelExpression spel) {
        tree = Optional.of(spel.getAST());
      }
    } catch (IllegalArgumentException e) {
      LOG.warn("Condition of rule {} does not parse, so each row is checked", rule.getName(), e);
    }
    return tree;
  }

  private RowPredicate node(SpelNode node, PolicyRules policy) {
    return switch (node) {
      case OpAnd and -> RowPredicate.and(children(and, policy));
      case OpOr or -> RowPredicate.or(children(or, policy));
      case OperatorNot not -> RowPredicate.not(node(not.getChild(0), policy));
      case BooleanLiteral literal -> constant(
          Boolean.TRUE.equals(literal.getLiteralValue().getValue()));
      case MethodReference call -> call(call, policy);
      default -> unknown(UNTRANSLATED_CONDITION);
    };
  }

  private List<RowPredicate> children(SpelNode node, PolicyRules policy) {
    List<RowPredicate> children = new ArrayList<>();
    for (int i = 0; i < node.getChildCount(); i++) {
      children.add(node(node.getChild(i), policy));
    }
    return children;
  }

  private RowPredicate call(MethodReference call, PolicyRules policy) {
    Optional<List<String>> arguments = stringArguments(call);
    return ConditionFunction.named(call.getName())
        .flatMap(function -> arguments.map(values -> function(function, values, policy)))
        .orElse(unknown(UNTRANSLATED_CONDITION));
  }

  private static Optional<List<String>> stringArguments(MethodReference call) {
    List<String> arguments = new ArrayList<>();
    for (int i = 0; i < call.getChildCount(); i++) {
      if (!(call.getChild(i) instanceof StringLiteral literal)) {
        return Optional.empty();
      }
      arguments.add(String.valueOf(literal.getLiteralValue().getValue()));
    }
    return Optional.of(arguments);
  }

  private RowPredicate function(
      ConditionFunction function, List<String> arguments, PolicyRules policy) {
    return switch (function) {
      case NO_OWNER -> new NoOwner();
      case IS_OWNER -> RowPredicate.ownedBy(caller.selfAndDirectTeams());
      case IS_REVIEWER -> RowPredicate.reviewedBy(caller.selfAndDirectTeams());
      case HAS_DOMAIN -> hasDomain();
      case NO_DOMAIN -> new NoDomain();
      case MATCH_ANY_TAG -> arguments.isEmpty() ? FALSE : new TaggedAny(Set.copyOf(arguments));
      case MATCH_ALL_TAGS -> arguments.isEmpty()
          ? unknown(UNTRANSLATED_CONDITION)
          : new TaggedAll(Set.copyOf(arguments));
      case MATCH_TEAM -> matchTeam(policy);
      case IN_ANY_TEAM -> constant(arguments.stream().anyMatch(caller::isUnderTeam));
      case HAS_ANY_ROLE -> constant(arguments.stream().anyMatch(caller::hasAnyRole));
      case IS_ADMIN_USER, IS_BOT_USER -> readsRowOnlyOf(Entity.USER);
      case IS_TASK_FILER, IS_TASK_ASSIGNEE, IS_TASK_REVIEWER -> readsRowOnlyOf(Entity.TASK);
      case IS_IMPERSONATED -> constant(caller.impersonatedBy() != null);
      case IMPERSONATED_BY -> constant(
          arguments.stream().anyMatch(bot -> sameIdentifier(caller.impersonatedBy(), bot)));
    };
  }

  /**
   * A row with no domain is open to everyone, and a row with domains needs one of the caller's
   * domains or a sub-domain of one (SubjectContext.hasDomains).
   */
  private RowPredicate hasDomain() {
    Set<String> domains = caller.domainFqns();
    return domains.isEmpty()
        ? new NoDomain()
        : RowPredicate.or(new NoDomain(), RowPredicate.inDomains(domains));
  }

  /** True only for a policy that reached the caller through a team the caller sits under. */
  private RowPredicate matchTeam(PolicyRules policy) {
    boolean applies = policy.attachedToTeam() && caller.isUnderTeam(policy.attachedToName());
    return applies ? ownersUnder(teams.subtreeOf(policy.attachedToName())) : FALSE;
  }

  private static RowPredicate ownersUnder(TeamSubtree subtree) {
    return subtree.complete()
        ? RowPredicate.ownerUnderTeams(subtree.teams())
        : unknown(TEAM_SET_TOO_LARGE);
  }

  /** A function that reads a row of {@code type} and answers false for every other type. */
  private RowPredicate readsRowOnlyOf(String type) {
    return type.equals(listedType) ? unknown(UNTRANSLATED_CONDITION) : FALSE;
  }

  private static RowPredicate constant(boolean value) {
    return value ? TRUE : FALSE;
  }

  /** The {@code RuleEvaluator} functions this translator gives a meaning to. */
  enum ConditionFunction {
    NO_OWNER("noOwner"),
    IS_OWNER("isOwner"),
    IS_REVIEWER("isReviewer"),
    HAS_DOMAIN("hasDomain"),
    NO_DOMAIN("noDomain"),
    MATCH_ANY_TAG("matchAnyTag"),
    MATCH_ALL_TAGS("matchAllTags"),
    MATCH_TEAM("matchTeam"),
    IN_ANY_TEAM("inAnyTeam"),
    HAS_ANY_ROLE("hasAnyRole"),
    IS_ADMIN_USER("isAdminUser"),
    IS_BOT_USER("isBotUser"),
    IS_TASK_FILER("isTaskFiler"),
    IS_TASK_ASSIGNEE("isTaskAssignee"),
    IS_TASK_REVIEWER("isTaskReviewer"),
    IS_IMPERSONATED("isImpersonated"),
    IMPERSONATED_BY("impersonatedBy");

    private final String functionName;

    ConditionFunction(String functionName) {
      this.functionName = functionName;
    }

    String functionName() {
      return functionName;
    }

    static Optional<ConditionFunction> named(String name) {
      return Arrays.stream(values())
          .filter(function -> function.functionName.equals(name))
          .findFirst();
    }
  }
}

/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.springframework.expression.ParseException;
import org.springframework.expression.spel.SpelNode;
import org.springframework.expression.spel.ast.MethodReference;
import org.springframework.expression.spel.ast.StringLiteral;
import org.springframework.expression.spel.standard.SpelExpressionParser;

/**
 * Utility for updating SpEL condition strings in policy rules when referenced entities (tags,
 * roles, teams, services) are renamed or deleted.
 *
 * <p>Conditions are rewritten through the SpEL AST, so an entity name is always handled as one
 * string literal whatever characters it contains. Only calls whose arguments are all string
 * literals are rewritten, and nothing outside those calls' own text changes.
 *
 * <p>A call whose arguments all name deleted entities becomes {@code false}, the value it evaluates
 * to once those entities are gone: {@code isOwner() && matchAnyTag('PII.Sensitive')} becomes {@code
 * isOwner() && false}. See
 * ADR:2026-10-30-deleted-policy-condition-references-become-false.
 */
@Slf4j
public final class PolicyConditionUpdater {

  private static final String MATCH_ALL_TAGS = "matchAllTags";

  public static final Set<String> TAG_FUNCTIONS =
      Set.of("matchAnyTag", MATCH_ALL_TAGS, "matchAnyCertification", "matchAnyServiceTag");
  public static final Set<String> ROLE_FUNCTIONS = Set.of("hasAnyRole");
  public static final Set<String> TEAM_FUNCTIONS = Set.of("inAnyTeam");
  public static final Set<String> SERVICE_FUNCTIONS = Set.of("matchAnyServiceName");

  /** What a call evaluates to once the entities it needs to match are gone. */
  private static final String NEVER_MATCHES = "false";

  private static final SpelExpressionParser CONDITION_PARSER = new SpelExpressionParser();

  private static final int MAX_REWRITE_RETRIES = 5;
  private static final int POLICY_PAGE_SIZE = 1000;

  /**
   * A call to one of the target functions, located in the condition text. {@code start} is the
   * first character of the function name and {@code end} is just past its closing parenthesis.
   */
  record FunctionCall(String name, int start, int end, List<String> args) {}

  private PolicyConditionUpdater() {}

  /**
   * Replace oldName with newName in arguments of targetFunctions within the condition string. Only
   * exact argument matches are replaced (not substrings).
   */
  public static String renameInCondition(
      String condition, String oldName, String newName, Set<String> targetFunctions) {
    return rewriteCalls(
        condition,
        targetFunctions,
        call -> renamedCall(call, arg -> arg.equals(oldName) ? newName : arg));
  }

  /**
   * Replace oldPrefix with newPrefix in arguments of targetFunctions. Used for classification and
   * glossary renames where child FQNs change prefix (e.g., {@code PersonalData.Tag → PD.Tag}).
   */
  public static String renamePrefixInCondition(
      String condition, String oldPrefix, String newPrefix, Set<String> targetFunctions) {
    return rewriteCalls(
        condition,
        targetFunctions,
        call ->
            renamedCall(
                call,
                arg ->
                    isAtOrUnder(arg, oldPrefix)
                        ? newPrefix + arg.substring(oldPrefix.length())
                        : arg));
  }

  /**
   * Remove all arguments matching the prefix (exact match or starts with prefix + ".") from
   * targetFunctions. Used when a classification or glossary is deleted, removing all child
   * references.
   */
  public static String removeByPrefixFromCondition(
      String condition, String prefix, Set<String> targetFunctions) {
    return rewriteCalls(
        condition,
        targetFunctions,
        call -> callWithoutDeleted(call, arg -> isAtOrUnder(arg, prefix)));
  }

  /** Remove deletedName from arguments of targetFunctions within the condition string. */
  public static String removeFromCondition(
      String condition, String deletedName, Set<String> targetFunctions) {
    return rewriteCalls(
        condition, targetFunctions, call -> callWithoutDeleted(call, deletedName::equals));
  }

  /**
   * Find all non-deleted policies, apply conditionRewriter to each rule's condition, and persist
   * any changes. Each changed policy is written with an optimistic content-based compare-and-swap
   * (re-read, re-apply, retry on conflict) so concurrent tag/glossary renames touching overlapping
   * policies cannot clobber each other's rewrites.
   */
  public static void updateAllPolicyConditions(UnaryOperator<String> conditionRewriter) {
    try {
      @SuppressWarnings("unchecked")
      EntityRepository<Policy> policyRepo =
          (EntityRepository<Policy>) Entity.getEntityRepository(Entity.POLICY);
      boolean anyChanged = rewriteMatchingPolicies(policyRepo, conditionRewriter);
      if (anyChanged) {
        SubjectCache.invalidateAll();
      }
    } catch (Exception e) {
      LOG.error("Failed to update policy conditions", e);
    }
  }

  /**
   * Page through every non-deleted policy (no fixed cap) and rewrite each one whose conditions
   * reference the renamed/deleted entity.
   *
   * <p>The paging read is a plain {@code listAfter} with {@link Fields#EMPTY_FIELDS} and takes no
   * locks. {@link #conditionsWouldChange} is an in-memory check on the already-loaded policy and
   * gates {@link #rewriteSinglePolicy}, which holds the only locking read
   * ({@code findJsonByIdForUpdate}). So a rename locks the policies that actually name the renamed
   * entity -- usually none or one -- not a row per policy in the catalog. Those locks are held
   * until the enclosing entity transaction commits, because the callers run inside it, so two
   * writers racing on the <em>same</em> policy still serialise. That is the bound worth knowing
   * before widening these hooks.
   */
  private static boolean rewriteMatchingPolicies(
      EntityRepository<Policy> policyRepo, UnaryOperator<String> conditionRewriter) {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    boolean anyChanged = false;
    String after = null;
    do {
      ResultList<Policy> page =
          policyRepo.listAfter(null, Fields.EMPTY_FIELDS, filter, POLICY_PAGE_SIZE, after);
      for (Policy policy : page.getData()) {
        if (conditionsWouldChange(policy, conditionRewriter)
            && rewriteSinglePolicy(policyRepo, policy.getId(), conditionRewriter)) {
          anyChanged = true;
        }
      }
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);
    return anyChanged;
  }

  /** Cheap, non-mutating pre-check: would the rewriter change any of this policy's conditions? */
  private static boolean conditionsWouldChange(
      Policy policy, UnaryOperator<String> conditionRewriter) {
    boolean wouldChange = false;
    for (Rule rule : policy.getRules()) {
      String condition = rule.getCondition();
      if (condition != null && !condition.equals(conditionRewriter.apply(condition))) {
        wouldChange = true;
        break;
      }
    }
    return wouldChange;
  }

  /**
   * Re-read the policy's current row with a {@code FOR UPDATE} lock, re-apply the rewriter to that
   * fresh copy, and persist it with a content-based compare-and-swap. The locking read is essential:
   * this runs inside the enclosing rename/delete transaction, so under MySQL's default REPEATABLE
   * READ a plain re-read would return the transaction's stale snapshot and the CAS could never
   * converge. {@code FOR UPDATE} returns the latest committed row and serializes conflicting
   * writers. On a lost-update conflict it retries up to {@link #MAX_REWRITE_RETRIES} times. Avoids
   * the EntityUpdater path so automated rewrites neither bump the version nor create version
   * history.
   */
  private static boolean rewriteSinglePolicy(
      EntityRepository<Policy> policyRepo, UUID policyId, UnaryOperator<String> conditionRewriter) {
    EntityDAO<Policy> dao = policyRepo.getDao();
    boolean changed = false;
    boolean retryable = true;
    int attempt = 0;
    while (attempt < MAX_REWRITE_RETRIES && retryable && !changed) {
      attempt++;
      String currentJson = dao.findJsonByIdForUpdate(policyId, Include.NON_DELETED);
      Policy policy = currentJson == null ? null : JsonUtils.readValue(currentJson, Policy.class);
      if (policy == null || !rewritePolicyConditions(policy, conditionRewriter)) {
        retryable = false;
      } else {
        changed = casWritePolicy(dao, policy, currentJson);
      }
    }
    if (retryable && !changed) {
      LOG.warn(
          "Gave up rewriting conditions for policy {} after {} attempts due to concurrent modifications",
          policyId,
          MAX_REWRITE_RETRIES);
    }
    return changed;
  }

  /**
   * Persist the rewritten policy only if its stored row still matches {@code expectedJson}. On
   * success, drop every cache variant for the policy so the next read rebuilds from the fresh row
   * (the DAO write skips EntityUpdater's cache invalidation).
   */
  private static boolean casWritePolicy(EntityDAO<Policy> dao, Policy policy, String expectedJson) {
    boolean written = dao.updateIfMatches(policy, expectedJson) == 1;
    if (written) {
      EntityRepository.invalidateCacheForEntity(
          Entity.POLICY, policy.getId(), policy.getFullyQualifiedName());
      LOG.info("Updated policy conditions for '{}'", policy.getFullyQualifiedName());
    }
    return written;
  }

  private static boolean rewritePolicyConditions(
      Policy policy, UnaryOperator<String> conditionRewriter) {
    boolean changed = false;
    for (Rule rule : policy.getRules()) {
      String oldCondition = rule.getCondition();
      if (oldCondition == null) {
        continue;
      }
      String newCondition = conditionRewriter.apply(oldCondition);
      if (!oldCondition.equals(newCondition)) {
        rule.setCondition(newCondition);
        changed = true;
        LOG.info(
            "Policy '{}' rule '{}': condition '{}' → '{}'",
            policy.getFullyQualifiedName(),
            rule.getName(),
            oldCondition,
            newCondition);
      }
    }
    return changed;
  }

  /**
   * Apply callRewriter to every call of targetFunctions in the condition. Replacements run from the
   * last call to the first so earlier offsets stay valid; calls never overlap because their
   * arguments are string literals.
   */
  static String rewriteCalls(
      String condition,
      Set<String> targetFunctions,
      Function<FunctionCall, Optional<String>> callRewriter) {
    if (condition == null) {
      return null;
    }
    StringBuilder rewritten = new StringBuilder(condition);
    for (FunctionCall call : findCalls(condition, targetFunctions).reversed()) {
      callRewriter
          .apply(call)
          .ifPresent(replacement -> rewritten.replace(call.start(), call.end(), replacement));
    }
    return rewritten.toString();
  }

  /** Every call of targetFunctions whose arguments are all string literals, in text order. */
  static List<FunctionCall> findCalls(String condition, Set<String> targetFunctions) {
    List<FunctionCall> calls = new ArrayList<>();
    try {
      collectCalls(
          CONDITION_PARSER.parseRaw(condition).getAST(), condition, targetFunctions, calls);
    } catch (ParseException e) {
      LOG.warn("Leaving policy condition '{}' unchanged: it does not parse", condition, e);
    }
    calls.sort(Comparator.comparingInt(FunctionCall::start));
    return calls;
  }

  private static void collectCalls(
      SpelNode node, String condition, Set<String> targetFunctions, List<FunctionCall> calls) {
    // The SpEL AST exposes children only as SpelNode, so the node kind is a runtime type check.
    if (node instanceof MethodReference method && targetFunctions.contains(method.getName())) {
      List<StringLiteral> literals = literalArguments(method);
      if (!literals.isEmpty()) {
        calls.add(toFunctionCall(method, literals, condition));
      }
    }
    for (int i = 0; i < node.getChildCount(); i++) {
      collectCalls(node.getChild(i), condition, targetFunctions, calls);
    }
  }

  /**
   * The call's arguments if every one is a string literal, otherwise none. A computed argument is
   * not an entity name, so such a call is left as written.
   */
  private static List<StringLiteral> literalArguments(MethodReference method) {
    List<StringLiteral> literals = new ArrayList<>();
    for (int i = 0; i < method.getChildCount(); i++) {
      // Same SpelNode-typed children as collectCalls; only literal arguments are entity names.
      if (method.getChild(i) instanceof StringLiteral literal) {
        literals.add(literal);
      }
    }
    return literals.size() == method.getChildCount() ? literals : List.of();
  }

  /**
   * A MethodReference spans only the function name, so the call ends at the first {@code )} after
   * its last argument -- nothing but whitespace can sit between a literal and that parenthesis.
   */
  private static FunctionCall toFunctionCall(
      MethodReference method, List<StringLiteral> literals, String condition) {
    int end = condition.indexOf(')', literals.getLast().getEndPosition()) + 1;
    List<String> args =
        literals.stream().map(literal -> (String) literal.getLiteralValue().getValue()).toList();
    return new FunctionCall(method.getName(), method.getStartPosition(), end, args);
  }

  private static Optional<String> renamedCall(
      FunctionCall call, UnaryOperator<String> argRewriter) {
    List<String> renamed = call.args().stream().map(argRewriter).toList();
    return renamed.equals(call.args())
        ? Optional.empty()
        : Optional.of(renderCall(call.name(), renamed));
  }

  /**
   * The call without its deleted arguments. Any-of functions keep matching the survivors; with
   * none left, or for matchAllTags, which can no longer be satisfied, the call is {@code false}.
   */
  private static Optional<String> callWithoutDeleted(
      FunctionCall call, Predicate<String> isDeleted) {
    List<String> kept = call.args().stream().filter(isDeleted.negate()).toList();
    boolean anyDeleted = kept.size() < call.args().size();
    boolean neverMatches = kept.isEmpty() || MATCH_ALL_TAGS.equals(call.name());
    Optional<String> rewritten = Optional.empty();
    if (anyDeleted) {
      rewritten = Optional.of(neverMatches ? NEVER_MATCHES : renderCall(call.name(), kept));
    }
    return rewritten;
  }

  private static boolean isAtOrUnder(String fqn, String prefix) {
    return fqn.equals(prefix) || fqn.startsWith(prefix + ".");
  }

  private static String renderCall(String functionName, List<String> args) {
    return args.stream()
        .map(PolicyConditionUpdater::quoteSpelLiteral)
        .collect(Collectors.joining(", ", functionName + "(", ")"));
  }

  /** Renders a value as a SpEL string literal, re-escaping any quote it contains. */
  private static String quoteSpelLiteral(String value) {
    return "'" + value.replace("'", "''") + "'";
  }
}

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
import java.util.List;
import java.util.Set;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Utility for updating SpEL condition strings in policy rules when referenced entities (tags,
 * roles, teams) are renamed or deleted.
 */
@Slf4j
public final class PolicyConditionUpdater {

  public static final Set<String> TAG_FUNCTIONS =
      Set.of("matchAnyTag", "matchAllTags", "matchAnyCertification");
  public static final Set<String> ROLE_FUNCTIONS = Set.of("hasAnyRole");
  public static final Set<String> TEAM_FUNCTIONS = Set.of("inAnyTeam");

  private static final Pattern SINGLE_QUOTED_ARG = Pattern.compile("'([^']*)'");

  private PolicyConditionUpdater() {}

  /**
   * Replace oldName with newName in arguments of targetFunctions within the condition string. Only
   * exact argument matches are replaced (not substrings).
   */
  public static String renameInCondition(
      String condition, String oldName, String newName, Set<String> targetFunctions) {
    if (condition == null) {
      return null;
    }
    String result = condition;
    for (String function : targetFunctions) {
      result = rewriteFunctionArgs(result, function, arg -> arg.equals(oldName) ? newName : arg);
    }
    return result;
  }

  /**
   * Replace oldPrefix with newPrefix in arguments of targetFunctions. Used for classification and
   * glossary renames where child FQNs change prefix (e.g., {@code PersonalData.Tag → PD.Tag}).
   */
  public static String renamePrefixInCondition(
      String condition, String oldPrefix, String newPrefix, Set<String> targetFunctions) {
    if (condition == null) {
      return null;
    }
    String result = condition;
    for (String function : targetFunctions) {
      result =
          rewriteFunctionArgs(
              result,
              function,
              arg -> {
                if (arg.equals(oldPrefix) || arg.startsWith(oldPrefix + ".")) {
                  return newPrefix + arg.substring(oldPrefix.length());
                }
                return arg;
              });
    }
    return result;
  }

  /**
   * Remove all arguments matching the prefix (exact match or starts with prefix + ".") from
   * targetFunctions. Used when a classification or glossary is deleted, removing all child
   * references.
   */
  public static String removeByPrefixFromCondition(
      String condition, String prefix, Set<String> targetFunctions) {
    if (condition == null) {
      return null;
    }
    String result = condition;
    for (String function : targetFunctions) {
      result = removeFunctionArgByPrefix(result, function, prefix);
    }
    return result.trim().isEmpty() ? null : result;
  }

  /**
   * Remove deletedName from arguments of targetFunctions within the condition string. Returns null
   * if the entire condition becomes empty after removal.
   */
  public static String removeFromCondition(
      String condition, String deletedName, Set<String> targetFunctions) {
    if (condition == null) {
      return null;
    }
    String result = condition;
    for (String function : targetFunctions) {
      result = removeFunctionArg(result, function, deletedName);
    }
    return result.trim().isEmpty() ? null : result;
  }

  /**
   * Find all non-deleted policies, apply conditionRewriter to each rule's condition, and persist
   * any changes.
   */
  public static void updateAllPolicyConditions(UnaryOperator<String> conditionRewriter) {
    try {
      @SuppressWarnings("unchecked")
      EntityRepository<Policy> policyRepo =
          (EntityRepository<Policy>) Entity.getEntityRepository(Entity.POLICY);
      ListFilter filter = new ListFilter(Include.NON_DELETED);
      ResultList<Policy> policies =
          policyRepo.listAfter(null, Fields.EMPTY_FIELDS, filter, 10000, null);

      boolean anyChanged = false;
      for (Policy policy : policies.getData()) {
        if (rewritePolicyConditions(policy, conditionRewriter)) {
          // Direct DAO update to avoid creating version history entries for automated rewrites.
          policyRepo.getDao().update(policy);
          // DAO.update skips EntityUpdater.invalidateCachesAfterStore, so the cached policy
          // still has the pre-rewrite condition embedded. Drop every cache variant for this
          // policy so the next read rebuilds from the freshly-updated row.
          EntityRepository.invalidateCacheForEntity(
              Entity.POLICY, policy.getId(), policy.getFullyQualifiedName());
          anyChanged = true;
          LOG.info("Updated policy conditions for '{}'", policy.getFullyQualifiedName());
        }
      }
      if (anyChanged) {
        SubjectCache.invalidateAll();
      }
    } catch (Exception e) {
      LOG.error("Failed to update policy conditions", e);
    }
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
   * Rewrite arguments of a specific function call within a condition string. The argRewriter
   * transforms each argument value (without quotes).
   */
  static String rewriteFunctionArgs(
      String condition, String functionName, UnaryOperator<String> argRewriter) {
    Pattern functionPattern =
        Pattern.compile("(" + Pattern.quote(functionName) + "\\s*\\()([^)]*)(\\))");
    Matcher matcher = functionPattern.matcher(condition);
    StringBuilder result = new StringBuilder();

    while (matcher.find()) {
      String prefix = matcher.group(1);
      String argsStr = matcher.group(2);
      String suffix = matcher.group(3);

      List<String> rewrittenArgs = new ArrayList<>();
      Matcher argMatcher = SINGLE_QUOTED_ARG.matcher(argsStr);
      while (argMatcher.find()) {
        String argValue = argMatcher.group(1);
        rewrittenArgs.add("'" + argRewriter.apply(argValue) + "'");
      }
      matcher.appendReplacement(
          result, Matcher.quoteReplacement(prefix + String.join(", ", rewrittenArgs) + suffix));
    }
    matcher.appendTail(result);
    return result.toString();
  }

  /**
   * Remove a specific argument from a function call. If the function has no remaining arguments,
   * the entire function call is removed and dangling boolean operators are cleaned up.
   */
  static String removeFunctionArg(String condition, String functionName, String argToRemove) {
    Pattern functionPattern = Pattern.compile(Pattern.quote(functionName) + "\\s*\\([^)]*\\)");
    Matcher matcher = functionPattern.matcher(condition);
    StringBuilder result = new StringBuilder();

    while (matcher.find()) {
      String functionCall = matcher.group();
      List<String> args = extractArgs(functionCall);
      args.removeIf(arg -> arg.equals(argToRemove));

      String replacement;
      if (args.isEmpty()) {
        replacement = "";
      } else {
        String argsStr =
            args.stream().map(a -> "'" + a + "'").reduce((a, b) -> a + ", " + b).orElse("");
        replacement = functionName + "(" + argsStr + ")";
      }
      matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
    }
    matcher.appendTail(result);
    return cleanupDanglingOperators(result.toString());
  }

  /**
   * Remove arguments matching a prefix (exact or starts with prefix + ".") from a function call.
   */
  static String removeFunctionArgByPrefix(String condition, String functionName, String prefix) {
    Pattern functionPattern = Pattern.compile(Pattern.quote(functionName) + "\\s*\\([^)]*\\)");
    Matcher matcher = functionPattern.matcher(condition);
    StringBuilder result = new StringBuilder();

    while (matcher.find()) {
      String functionCall = matcher.group();
      List<String> args = extractArgs(functionCall);
      args.removeIf(arg -> arg.equals(prefix) || arg.startsWith(prefix + "."));

      String replacement;
      if (args.isEmpty()) {
        replacement = "";
      } else {
        String argsStr =
            args.stream().map(a -> "'" + a + "'").reduce((a, b) -> a + ", " + b).orElse("");
        replacement = functionName + "(" + argsStr + ")";
      }
      matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
    }
    matcher.appendTail(result);
    return cleanupDanglingOperators(result.toString());
  }

  /** Extract unquoted argument values from a function call string. */
  static List<String> extractArgs(String functionCall) {
    List<String> args = new ArrayList<>();
    Matcher argMatcher = SINGLE_QUOTED_ARG.matcher(functionCall);
    while (argMatcher.find()) {
      args.add(argMatcher.group(1));
    }
    return args;
  }

  /**
   * Remove dangling boolean operators left after removing a function call. Handles patterns like
   * {@code && remaining}, {@code remaining &&}, {@code || remaining}, {@code remaining ||}.
   */
  static String cleanupDanglingOperators(String expression) {
    String result = expression.trim();
    String previous;
    do {
      previous = result;
      // Collapse consecutive operators: 'X &&  && Y' or 'X ||  || Y'
      result = result.replaceAll("(&&|\\|\\|)\\s+(&&|\\|\\|)", "$1");
      // Remove leading operators: '&& X' or '|| X'
      result = result.replaceAll("^\\s*(&&|\\|\\|)\\s*", "");
      // Remove trailing operators: 'X &&' or 'X ||'
      result = result.replaceAll("\\s*(&&|\\|\\|)\\s*$", "");
      result = result.trim();
    } while (!result.equals(previous));
    return result;
  }

  /**
   * Simplify boolean expressions containing 'true' literals. Handles: {@code true && X → X},
   * {@code X && true → X}, {@code true || X → true}, {@code X || true → true}.
   */
  static String simplifyBooleanExpression(String expression) {
    String result = expression.trim();
    if (result.isEmpty()) {
      return "true";
    }
    String previous;
    do {
      previous = result;
      // Remove 'true &&' from the left side
      result = result.replaceAll("^true\\s*&&\\s*", "");
      // Remove '&& true' from the right side
      result = result.replaceAll("\\s*&&\\s*true$", "");
      // 'true || anything' collapses to 'true'
      if (result.matches("true\\s*\\|\\|.*")) {
        result = "true";
      }
      // 'anything || true' collapses to 'true'
      if (result.matches(".*\\|\\|\\s*true")) {
        result = "true";
      }
      result = result.trim();
    } while (!result.equals(previous));
    return result.isEmpty() ? "true" : result;
  }
}

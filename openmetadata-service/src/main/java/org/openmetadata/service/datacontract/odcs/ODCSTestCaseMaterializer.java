/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.datacontract.odcs;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.UnsupportedOutcome;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;

/**
 * Creates, or updates, the test cases {@link ODCSQualityRuleMapper} described. A test case with the
 * same name may already exist on the table. When the contract already owns it, or an earlier ODCS
 * import created it, it is updated in place. When it belongs to someone else it is not written: it
 * is linked if it already runs the same test with the same parameters, and the rule is skipped
 * otherwise. Once linked it is the contract's own, so later imports keep it in step with the rule.
 */
@Slf4j
public final class ODCSTestCaseMaterializer {
  private static final String TEST_DEFINITION_FIELD = "testDefinition";

  /** Authorizes writing one test case before it is persisted; throws when the caller may not. */
  @FunctionalInterface
  public interface WriteGuard {
    void authorize(TestCase testCase, boolean overwritesExisting);
  }

  /**
   * @param ownedTestCaseIds test cases the contract already links, which the import may update
   */
  public record Request(
      List<TestCaseOutcome> outcomes, Set<UUID> ownedTestCaseIds, WriteGuard guard, String user) {}

  /** Test cases to link to the contract, and the rules whose test case could not be written. */
  public record Result(List<EntityReference> testCases, List<UnsupportedOutcome> skipped) {}

  private final TestCaseRepository repository;
  private final TestCaseMapper mapper = new TestCaseMapper();

  public ODCSTestCaseMaterializer(TestCaseRepository repository) {
    this.repository = repository;
  }

  /**
   * Writes the test cases only once the caller is authorized for all of them, so an import the
   * caller may not complete leaves nothing behind. A test case OpenMetadata rejects is skipped with
   * the reason; the others are still written.
   */
  public Result materialize(Request request) {
    List<Step> planned =
        request.outcomes().stream().map(outcome -> plan(outcome, request)).toList();
    planned.stream()
        .filter(Write.class::isInstance)
        .map(Write.class::cast)
        .forEach(write -> request.guard().authorize(write.testCase(), write.overwritesExisting()));
    List<Step> settled =
        planned.stream()
            .map(step -> step instanceof Write write ? persist(write, request.user()) : step)
            .toList();
    return new Result(
        settled.stream()
            .filter(Linked.class::isInstance)
            .map(step -> ((Linked) step).testCase())
            .toList(),
        settled.stream()
            .filter(Skip.class::isInstance)
            .map(step -> ((Skip) step).outcome())
            .toList());
  }

  /** What becomes of one rule's test case, decided before anything is written. */
  private sealed interface Step permits Write, Linked, Skip {}

  private record Write(TestCaseOutcome outcome, TestCase testCase, boolean overwritesExisting)
      implements Step {}

  private record Linked(EntityReference testCase) implements Step {}

  private record Skip(UnsupportedOutcome outcome) implements Step {}

  private Step plan(TestCaseOutcome outcome, Request request) {
    TestCase testCase = mapper.createToEntity(outcome.testCase(), request.user());
    repository.setFullyQualifiedName(testCase);
    TestCase existing = findExisting(testCase.getFullyQualifiedName());
    return isOwnedBySomeoneElse(existing, request)
        ? linkIfSameTest(existing, testCase)
            .<Step>map(Linked::new)
            .orElseGet(() -> new Skip(nameTakenOutcome(outcome)))
        : write(outcome, testCase, existing);
  }

  /** Re-importing a rule rewrites its test, not the review status the test case has reached. */
  private static Write write(TestCaseOutcome outcome, TestCase testCase, TestCase existing) {
    if (existing != null) {
      testCase.setEntityStatus(existing.getEntityStatus());
    }
    return new Write(outcome, testCase, existing != null);
  }

  private Step persist(Write write, String user) {
    Step settled;
    try {
      repository.prepareInternal(write.testCase(), write.overwritesExisting());
      settled =
          new Linked(
              repository
                  .createOrUpdate(null, write.testCase(), user)
                  .getEntity()
                  .getEntityReference());
    } catch (IllegalArgumentException | BadRequestException | EntityNotFoundException e) {
      LOG.debug("Test case for ODCS rule '{}' was rejected", write.outcome().rule().getName(), e);
      settled = new Skip(new UnsupportedOutcome(write.outcome().rule(), rejectedReason(e)));
    }
    return settled;
  }

  private TestCase findExisting(String fullyQualifiedName) {
    return repository
        .getByNameOrNull(
            null,
            fullyQualifiedName,
            repository.getFields(TEST_DEFINITION_FIELD),
            Include.NON_DELETED,
            false)
        .orElse(null);
  }

  private static boolean isOwnedBySomeoneElse(TestCase existing, Request request) {
    return existing != null
        && !request.ownedTestCaseIds().contains(existing.getId())
        && !existing.getName().startsWith(ODCSTestCaseNames.GENERATED_PREFIX);
  }

  private static Optional<EntityReference> linkIfSameTest(TestCase existing, TestCase wanted) {
    String existingDefinition = existing.getTestDefinition().getFullyQualifiedName();
    String wantedDefinition = wanted.getTestDefinition().getFullyQualifiedName();
    boolean sameTest =
        existingDefinition.equalsIgnoreCase(wantedDefinition)
            && parameters(existing).equals(parameters(wanted));
    return sameTest ? Optional.of(existing.getEntityReference()) : Optional.empty();
  }

  private static Map<String, String> parameters(TestCase testCase) {
    return listOrEmpty(testCase.getParameterValues()).stream()
        .filter(parameter -> parameter.getName() != null && parameter.getValue() != null)
        .collect(
            Collectors.toMap(
                TestCaseParameterValue::getName,
                TestCaseParameterValue::getValue,
                (first, second) -> second));
  }

  private static UnsupportedOutcome nameTakenOutcome(TestCaseOutcome outcome) {
    return new UnsupportedOutcome(
        outcome.rule(),
        String.format(
            "A test case named '%s' with a different test or parameters already exists there"
                + " and was left unchanged.",
            outcome.testCase().getName()));
  }

  private static String rejectedReason(RuntimeException e) {
    return "OpenMetadata rejected the test case: " + e.getMessage();
  }
}

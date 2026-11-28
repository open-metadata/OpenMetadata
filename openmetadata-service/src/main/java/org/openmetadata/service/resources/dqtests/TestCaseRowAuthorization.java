package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import jakarta.ws.rs.core.SecurityContext;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.RowDecisionGate;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;

/**
 * Keeps the rows of a test case result or incident listing that their item endpoint would return.
 * Such a listing is authorized with no test case in scope, which a condition on the test case, such
 * as hasDomain(), cannot refuse, so each row is checked as its item endpoint checks it, once per
 * test case on a page (ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read). The page
 * is not refilled and its total still counts every row.
 */
final class TestCaseRowAuthorization {
  private record Grant(String resource, List<MetadataOperation> operations) {}

  /** The contexts a test case's results and incidents are authorized on. */
  record TestCaseContexts(
      ResourceContextInterface testCase, ResourceContextInterface testedEntity) {
    static TestCaseContexts of(String testCaseFQN) {
      TestCase testCase = Entity.getEntityByName(Entity.TEST_CASE, testCaseFQN, "", Include.ALL);
      return new TestCaseContexts(
          TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build(),
          TestCaseResourceContext.builder()
              .entityLink(MessageParser.EntityLink.parse(testCase.getEntityLink()))
              .build());
    }
  }

  private final ViewPermissionFilter viewPermissionFilter;
  private final List<Grant> grants;
  private final Function<String, List<AuthRequest>> requestsForTestCase;

  /**
   * @param unscopedRequests the item endpoint's requests with no resource, read only for the
   *     resources and operations a row can be granted on
   * @param requestsForTestCase the item endpoint's requests for the test case a row belongs to
   */
  TestCaseRowAuthorization(
      Authorizer authorizer,
      List<AuthRequest> unscopedRequests,
      Function<String, List<AuthRequest>> requestsForTestCase) {
    this.viewPermissionFilter = new ViewPermissionFilter(authorizer);
    this.grants =
        unscopedRequests.stream()
            .map(AuthRequest::operationContext)
            .map(
                operation ->
                    new Grant(operation.getResource(), List.copyOf(operation.getOperations(null))))
            .toList();
    this.requestsForTestCase = requestsForTestCase;
  }

  <R> List<R> readable(
      SecurityContext securityContext, List<R> rows, Function<R, String> testCaseFQN) {
    List<R> readable = rows;
    if (!nullOrEmpty(rows) && rowsMayDiffer(securityContext)) {
      Map<String, Boolean> readableByTestCase = new HashMap<>();
      readable =
          rows.stream()
              .filter(
                  row ->
                      readableByTestCase.computeIfAbsent(
                          testCaseFQN.apply(row),
                          fqn ->
                              viewPermissionFilter.isPermittedAny(
                                  securityContext, () -> requestsForTestCase.apply(fqn))))
              .toList();
    }
    return readable;
  }

  /** The row if its item endpoint would return it, otherwise null. */
  <R> R readableOrNull(SecurityContext securityContext, R row, Function<R, String> testCaseFQN) {
    List<R> kept = row == null ? List.of() : readable(securityContext, List.of(row), testCaseFQN);
    return kept.isEmpty() ? null : kept.getFirst();
  }

  /**
   * Whether some row could be refused. {@code AuthorizationLogic.ANY} refuses a row on an explicit
   * deny of any one of its grants, so a grant that may be refused is enough to check the rows.
   */
  private boolean rowsMayDiffer(SecurityContext securityContext) {
    SubjectContext subject = getSubjectContext(securityContext);
    return grants.stream()
        .anyMatch(
            grant -> RowDecisionGate.mayDiffer(subject, grant.resource(), grant.operations()));
  }
}

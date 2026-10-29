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

package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.resources.rdf.RdfQueryResourceContext;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Shared assertions for the RDF MCP tools' authorization and admission-guard behavior. */
final class RdfToolAuthorization {

  private static final int PRINCIPAL_CONCURRENCY = 2;

  private RdfToolAuthorization() {}

  static CatalogSecurityContext caller(final String name) {
    return new CatalogSecurityContext(() -> name, "https", "JWT", Set.of());
  }

  /**
   * Makes every caller resolve to an administrator or to a plain user, as the tools see it through
   * {@link DefaultAuthorizer#getSubjectContext}. The caller closes the returned mock.
   */
  static MockedStatic<DefaultAuthorizer> resolvingCallersAs(final boolean administrator) {
    final MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class);
    resolveCallersAs(subjects, administrator);
    return subjects;
  }

  static void resolveCallersAs(
      final MockedStatic<DefaultAuthorizer> subjects, final boolean administrator) {
    final SubjectContext subject =
        new SubjectContext(new User().withName("caller").withIsAdmin(administrator), null, null);
    subjects
        .when(() -> DefaultAuthorizer.getSubjectContext(any(SecurityContext.class)))
        .thenReturn(subject);
  }

  static Authorizer denyingAuthorizer() {
    final Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("not allowed"))
        .when(authorizer)
        .authorize(any(), any(OperationContext.class), any());
    return authorizer;
  }

  static void assertSparqlGrantRequested(
      final Authorizer authorizer, final CatalogSecurityContext caller) {
    final ArgumentCaptor<OperationContext> operation =
        ArgumentCaptor.forClass(OperationContext.class);
    verify(authorizer)
        .authorize(eq(caller), operation.capture(), same(RdfQueryResourceContext.INSTANCE));
    assertEquals(
        List.of(MetadataOperation.EXECUTE_SPARQL_QUERY), operation.getValue().getOperations(null));
  }

  /**
   * Holds every concurrency slot the principal may use in the shared admission guard, so any
   * further read by the same principal is rejected with a capacity error unless it bypasses the
   * guard.
   */
  static GuardSaturation saturateGuardFor(final String principal) throws InterruptedException {
    final CountDownLatch release = new CountDownLatch(1);
    final CountDownLatch started = new CountDownLatch(PRINCIPAL_CONCURRENCY);
    for (int slot = 0; slot < PRINCIPAL_CONCURRENCY; slot++) {
      Thread.startVirtualThread(() -> holdSlot(principal, started, release));
    }
    assertTrue(started.await(5, TimeUnit.SECONDS), "guard slots were not occupied");
    return new GuardSaturation(release);
  }

  private static void holdSlot(
      final String principal, final CountDownLatch started, final CountDownLatch release) {
    SparqlQueryExecutionGuard.shared()
        .execute(
            principal,
            () -> {
              started.countDown();
              awaitQuietly(release);
              return null;
            });
  }

  private static void awaitQuietly(final CountDownLatch latch) {
    try {
      latch.await(30, TimeUnit.SECONDS);
    } catch (final InterruptedException exception) {
      Thread.currentThread().interrupt();
    }
  }

  record GuardSaturation(CountDownLatch release) implements AutoCloseable {
    @Override
    public void close() {
      release.countDown();
    }
  }
}

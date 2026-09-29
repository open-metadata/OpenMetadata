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

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

abstract class RdfMcpTool<T> implements TypedMcpTool<T> {

  private final Supplier<RdfRepository> repositorySupplier;

  protected RdfMcpTool() {
    this(RdfRepository::getInstanceOrNull);
  }

  protected RdfMcpTool(Supplier<RdfRepository> repositorySupplier) {
    this.repositorySupplier = Objects.requireNonNull(repositorySupplier);
  }

  protected final RdfRepository repository() {
    RdfRepository repository = repositorySupplier.get();
    if (repository == null || !repository.isEnabled()) {
      throw new RdfNotEnabledException();
    }
    return repository;
  }

  @Override
  public final T execute(
      final Authorizer authorizer,
      final CatalogSecurityContext securityContext,
      final Map<String, Object> params)
      throws IOException {
    authorizer.authorizeAdmin(securityContext);
    return executeAuthorized(securityContext, params);
  }

  /**
   * Runs a triplestore read under the shared admission guard (global and per-principal concurrency
   * plus a hard timeout).
   *
   * <p>Only {@code SparqlQueryTool} was guarded originally, leaving the expensive surfaces open:
   * {@code EntityNeighborhoodTool} emits up to fourteen UNION branches of unbounded {@code ?s ?p ?o}
   * at depth 3, and a {@code DESCRIBE} can walk an arbitrary subgraph.
   */
  protected final <R> R guardedRead(
      final CatalogSecurityContext securityContext, final Supplier<R> read) {
    return SparqlQueryExecutionGuard.shared().execute(guardKey(securityContext), read);
  }

  /**
   * Per-principal key for the admission guard, tolerating a context with no principal.
   *
   * <p>{@link CommonUtils#principal} dereferences the principal directly, so a context without one
   * throws NPE inside the guard. Unauthenticated callers share one stripe: rate-limited together
   * rather than each getting a private allowance.
   */
  private static String guardKey(final CatalogSecurityContext securityContext) {
    return securityContext == null || securityContext.getUserPrincipal() == null
        ? "anonymous"
        : securityContext.getUserPrincipal().getName();
  }

  protected abstract T executeAuthorized(
      final CatalogSecurityContext securityContext, final Map<String, Object> params)
      throws IOException;

  @Override
  public final T execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        getClass().getSimpleName() + " does not enforce write limits.");
  }
}

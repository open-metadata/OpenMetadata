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

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

abstract class RdfMcpTool<T> implements McpTool<T> {

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
      throw new IllegalStateException("RDF repository is not enabled on this OpenMetadata server");
    }
    return repository;
  }

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

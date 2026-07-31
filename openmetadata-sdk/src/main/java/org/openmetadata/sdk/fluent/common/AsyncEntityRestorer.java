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
package org.openmetadata.sdk.fluent.common;

import org.openmetadata.sdk.models.AsyncJobResponse;
import org.openmetadata.sdk.services.EntityServiceBase;

/**
 * Generic fluent async restore builder. Returned by {@link EntityRestorer#async()}.
 * Calls {@link EntityServiceBase#restoreServerAsync(String)} which issues
 * {@code PUT /restore?async=true} and returns the 202 Accepted response carrying the
 * job id (issue #4003). The {@code <T>} parameter is preserved for symmetry with
 * {@link EntityRestorer} so call sites that already have an
 * {@code EntityRestorer<Dashboard>} reference can switch to the async variant without
 * losing the type-level context, even though the response itself is type-erased.
 */
public class AsyncEntityRestorer<T> {
  private final EntityServiceBase<T> service;
  private final String id;

  public AsyncEntityRestorer(EntityServiceBase<T> service, String id) {
    this.service = service;
    this.id = id;
  }

  public AsyncJobResponse execute() {
    return service.restoreServerAsync(id);
  }
}

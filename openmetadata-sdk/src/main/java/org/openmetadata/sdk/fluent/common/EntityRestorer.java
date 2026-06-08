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

import org.openmetadata.sdk.services.EntityServiceBase;

/**
 * Generic fluent restore builder used by every entity-type fluent class that exposes a
 * {@code restore()} entry point (Tables, Dashboards, Pipelines, Topics, Containers,
 * Glossaries, Domains, …). Replaces the per-entity {@code TableRestorer} /
 * {@code DatabaseRestorer} duplicates so adding restore support to a new fluent only
 * requires wiring it to its service — no new class per type.
 *
 * <p>Sync: {@code execute()} runs the synchronous restore and returns the restored
 * entity. Async: {@code async().execute()} switches to the server-side async path
 * ({@code PUT /restore?async=true}) and returns an
 * {@link org.openmetadata.sdk.models.AsyncJobResponse} with a job id (issue #4003).
 */
public class EntityRestorer<T> {
  private final EntityServiceBase<T> service;
  private final String id;

  public EntityRestorer(EntityServiceBase<T> service, String id) {
    this.service = service;
    this.id = id;
  }

  public AsyncEntityRestorer<T> async() {
    return new AsyncEntityRestorer<>(service, id);
  }

  public T execute() {
    return service.restore(id);
  }
}

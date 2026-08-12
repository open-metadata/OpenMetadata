/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.util;

import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ReadBundleContext;
import org.openmetadata.service.resources.filters.ETagRequestFilter;
import org.openmetadata.service.security.ActivePersonaContext;
import org.openmetadata.service.security.ImpersonationContext;

/**
 * Clears the ThreadLocal state that is scoped to a single unit of work.
 *
 * <p>These ThreadLocals are caches and request context, not pending work, so dropping them can only
 * cost a re-read. They were originally cleared only by the JAX-RS response filter, which meant any
 * pool that never serves an HTTP request — the Quartz change-event consumer, Flowable's async job
 * executor — accumulated them for the life of the process and served indefinitely stale reads.
 *
 * <p>Deliberately excluded: {@code LineageUtil.DEFERRED_LINEAGE_ES} and {@code
 * SearchRepository.DEFERRED_SEARCH_WRITES}. Those hold pending <em>writes</em>, so clearing them
 * would silently drop search and lineage updates rather than merely forcing a re-read.
 */
public final class PerRequestContextCleaner {

  private PerRequestContextCleaner() {}

  public static void clear() {
    ImpersonationContext.clear();
    ActivePersonaContext.clear();
    ETagRequestFilter.clearIfMatchHeader();
    RequestEntityCache.clear();
    ReadBundleContext.clear();
    Entity.clearRepositoryThreadLocals();
  }
}

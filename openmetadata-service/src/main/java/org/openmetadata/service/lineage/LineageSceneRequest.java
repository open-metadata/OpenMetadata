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

package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

record LineageSceneRequest(
    String focusFqn,
    String entityType,
    LineageLens lens,
    LineageBand band,
    int upstreamDepth,
    int downstreamDepth,
    int size,
    Query queryFilter,
    boolean includeDeleted,
    SecurityContext securityContext,
    SubjectContext subjectContext) {

  LineageSceneRequest {
    lens = lens == null ? LineageLens.SERVICE : lens;
    band = band == null ? LineageBand.ASSET : band;
  }

  boolean hasFocus() {
    return !nullOrEmpty(focusFqn);
  }

  boolean requiresEntityAuthorization() {
    return subjectContext != null && !subjectContext.isAdmin();
  }

  boolean canUseSharedRootCache() {
    return !hasFocus() && !requiresEntityAuthorization();
  }

  Include include() {
    return includeDeleted ? Include.DELETED : Include.NON_DELETED;
  }

  String queryFilterJson() {
    return queryFilter == null ? "" : LineageSceneQuery.queryJson(queryFilter);
  }

  LineageSceneCache.Key cacheKey() {
    return new LineageSceneCache.Key(
        lens, band, upstreamDepth, downstreamDepth, size, queryFilterJson(), includeDeleted);
  }
}

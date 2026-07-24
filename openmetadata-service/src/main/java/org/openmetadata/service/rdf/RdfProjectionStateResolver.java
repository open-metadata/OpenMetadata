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

package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO.AppExtensionTimeSeries;

@Slf4j
public final class RdfProjectionStateResolver {
  static final String RDF_INDEX_APP = "RdfIndexApp";
  private final AppExtensionTimeSeries runStore;

  public RdfProjectionStateResolver(final AppExtensionTimeSeries runStore) {
    this.runStore = runStore;
  }

  public RdfProjectionState resolve() {
    final List<String> latestRuns =
        runStore.listAppExtensionByName(
            RDF_INDEX_APP, 1, 0, AppExtension.ExtensionType.STATUS.toString());
    RdfProjectionState state = RdfProjectionState.REBUILDING;
    if (!nullOrEmpty(latestRuns)) {
      state = parse(latestRuns.getFirst());
    }
    return applyRuntimeHealth(state);
  }

  private static RdfProjectionState applyRuntimeHealth(final RdfProjectionState persistedState) {
    return persistedState == RdfProjectionState.READY && RdfProjectionHealth.isDegraded()
        ? RdfProjectionState.DEGRADED
        : persistedState;
  }

  private static RdfProjectionState parse(final String runJson) {
    RdfProjectionState state;
    try {
      final AppRunRecord run = JsonUtils.readValue(runJson, AppRunRecord.class);
      state = fromStatus(run == null ? null : run.getStatus());
    } catch (JsonParsingException exception) {
      LOG.warn("RDF projection run state is malformed", exception);
      state = RdfProjectionState.DEGRADED;
    }
    return state;
  }

  static RdfProjectionState fromStatus(final AppRunRecord.Status status) {
    return switch (status) {
      case SUCCESS, COMPLETED -> RdfProjectionState.READY;
      case FAILED, ACTIVE_ERROR, STOPPED -> RdfProjectionState.DEGRADED;
      case null -> RdfProjectionState.REBUILDING;
      case STARTED, RUNNING, ACTIVE, STOP_IN_PROGRESS, PENDING -> RdfProjectionState.REBUILDING;
    };
  }
}

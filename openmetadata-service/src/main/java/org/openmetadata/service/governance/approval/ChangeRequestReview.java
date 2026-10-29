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

package org.openmetadata.service.governance.approval;

import java.util.List;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.governance.changeRequest.ChangeDecision;

/**
 * What a reviewer resolving a change request task decided: the revision they reviewed and, when
 * they decided change by change, their decision on each.
 */
public record ChangeRequestReview(Integer revision, List<ChangeDecision> changeDecisions) {
  public static ChangeRequestReview of(ResolveTask resolve) {
    return new ChangeRequestReview(
        resolve.getChangeRequestRevision(), resolve.getChangeDecisions());
  }

  public static ChangeRequestReview ofRevision(Integer revision) {
    return new ChangeRequestReview(revision, null);
  }

  public boolean perChange() {
    return changeDecisions != null && !changeDecisions.isEmpty();
  }
}

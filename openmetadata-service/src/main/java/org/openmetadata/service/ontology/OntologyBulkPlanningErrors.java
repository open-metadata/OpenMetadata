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

package org.openmetadata.service.ontology;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.api.data.OntologyBulkRowError;

final class OntologyBulkPlanningErrors {
  private OntologyBulkPlanningErrors() {}

  static OntologyBulkRowError error(
      final int rowNumber,
      final OntologyBulkErrorCode code,
      final String message,
      final UUID termId,
      final UUID relationshipId) {
    return new OntologyBulkRowError()
        .withRowNumber(rowNumber)
        .withCode(code)
        .withMessage(message)
        .withTermId(termId)
        .withRelationshipId(relationshipId);
  }

  static boolean add(final List<OntologyBulkRowError> errors, final OntologyBulkRowError error) {
    final boolean wasAdded = errors.size() < OntologyBulkPlan.MAXIMUM_REPORTED_ERRORS;
    if (wasAdded) {
      errors.add(error);
    }
    return wasAdded;
  }
}

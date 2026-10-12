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
import org.openmetadata.schema.api.data.OntologyBulkOperation;
import org.openmetadata.schema.api.data.OntologyBulkRowError;
import org.openmetadata.schema.type.OntologyChangeOperation;

record OntologyBulkPlan(
    OntologyBulkOperation operation,
    int totalRows,
    int validRows,
    int invalidRows,
    int unchangedRows,
    Counts counts,
    List<OntologyChangeOperation> operations,
    List<OntologyBulkRowError> errors,
    boolean errorsTruncated) {
  static final int MAXIMUM_REPORTED_ERRORS = 1000;

  OntologyBulkPlan {
    operations = List.copyOf(operations);
    errors = List.copyOf(errors);
  }

  record Counts(int creates, int updates, int findReplaces, int retypes) {
    static Counts empty() {
      return new Counts(0, 0, 0, 0);
    }
  }
}

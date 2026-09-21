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

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.data.OntologyBulkRowError;
import org.openmetadata.schema.type.OntologyChangeOperation;

final class OntologyBulkCsvAccumulator {
  private final List<OntologyChangeOperation> operations = new ArrayList<>();
  private final List<OntologyBulkRowError> errors = new ArrayList<>();
  private int invalidRows;
  private int creates;
  private int updates;
  private int unchangedRows;
  private boolean errorsTruncated;

  private OntologyBulkCsvAccumulator() {}

  static OntologyBulkCsvAccumulator empty() {
    return new OntologyBulkCsvAccumulator();
  }

  void add(final OntologyBulkCsvAction action, final OntologyChangeOperation operation) {
    operations.add(operation);
    switch (action) {
      case CREATE -> creates++;
      case UPDATE -> updates++;
    }
  }

  void addError(final OntologyBulkRowError error) {
    invalidRows++;
    final boolean wasAdded = OntologyBulkPlanningErrors.add(errors, error);
    errorsTruncated = !wasAdded || errorsTruncated;
  }

  List<OntologyChangeOperation> operations() {
    return operations;
  }

  List<OntologyBulkRowError> errors() {
    return errors;
  }

  int invalidRows() {
    return invalidRows;
  }

  void invalidRows(final int value) {
    invalidRows = value;
  }

  int creates() {
    return creates;
  }

  int updates() {
    return updates;
  }

  int unchangedRows() {
    return unchangedRows;
  }

  void addUnchanged() {
    unchangedRows++;
  }

  boolean errorsTruncated() {
    return errorsTruncated;
  }
}

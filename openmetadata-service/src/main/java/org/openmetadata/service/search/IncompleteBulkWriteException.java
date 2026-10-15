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
package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * A bulk write the engine accepted but whose items it partly rejected. The caller decides what to
 * retry: a failed document id is not always an entity id (a column document's is derived from the
 * column name), so retrying the id itself could not rebuild it.
 */
public class IncompleteBulkWriteException extends IOException {
  private final List<String> failedDocumentIds;

  public IncompleteBulkWriteException(
      final String indexName, final Map<String, String> reasonsByDocumentId) {
    super(
        String.format(
            "%d document(s) were not written to %s: %s",
            reasonsByDocumentId.size(), indexName, reasonsByDocumentId));
    this.failedDocumentIds = List.copyOf(reasonsByDocumentId.keySet());
  }

  public List<String> failedDocumentIds() {
    return failedDocumentIds;
  }
}

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

/**
 * An update-by-query or delete-by-query that left matched documents unwritten. The documents were
 * recorded for repair before this was thrown.
 */
public class IncompleteSearchUpdateException extends IOException {
  public IncompleteSearchUpdateException(final String message) {
    super(message);
  }
}

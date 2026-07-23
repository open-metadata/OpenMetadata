/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

public enum Outcome {
  /** Indexed, retrievable, and (when probed) the ramped value is searchable. */
  OK,
  /** Indexed and present in _source, but the value was dropped from the term index (e.g. a keyword
   * field's {@code ignore_above}), so it cannot be found by an exact-match query on that field. */
  DEGRADED_UNSEARCHABLE,
  /** The index refused the document: the write (PUT) failed and nothing was indexed. The cause is
   * NOT classified here — see {@link ShapeResult#detail()} for the raw engine error, which may be a
   * size / total_fields / nested_objects / depth / parse limit or anything else. */
  REJECTED,
  /** Unexpected: the PUT succeeded but the document was not retrievable by id afterwards. */
  ERROR_OTHER
}

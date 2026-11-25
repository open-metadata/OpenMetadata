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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;

/** The time-series rows the quality evidence of the graph is read from, newest per FQN. */
public interface RdfQualityEvidenceSource {
  Map<String, TableProfile> latestTableProfiles(List<String> tableFqns);

  Map<String, ColumnProfile> latestColumnProfiles(List<String> columnFqns);

  /** The tags stored for each column of {@code table}, by column FQN, read from tag storage. */
  Map<String, List<TagLabel>> columnTags(Table table);

  Map<String, TestCaseResult> latestTestCaseResults(List<String> testCaseFqns);

  /** The latest incident status of each test case, resolved or not. */
  Map<String, TestCaseResolutionStatus> latestIncidentStatuses(List<String> testCaseFqns);

  /** The live table, with its columns and tags, that a test case's entity link names. */
  Optional<Table> liveTable(String tableFqn);
}

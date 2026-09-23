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

package org.openmetadata.service.resources.services.ingestionpipelines.run;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;

/** Narrows a test suite run to one test case. */
public class TestCaseScoper implements SourceConfigScoper {

  static final String TEST_CASES = "testCases";

  // The test suite source filters on the test case name, not its FQN - an FQN would run nothing.
  // Names are unique within the test case's table suite, which is the suite this scope runs.
  @Override
  public Map<String, Object> sourceConfigOverride(EntityInterface testCase) {
    return Map.of(TEST_CASES, List.of(testCase.getName()));
  }
}

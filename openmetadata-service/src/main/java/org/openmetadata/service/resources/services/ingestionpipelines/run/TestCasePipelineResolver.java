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
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * A test case is owned by its table's test suite: every test case has exactly one, and its test
 * case names are unique, which a run scoped by name relies on. A bundle suite may hold same-named
 * test cases of other tables, so it is not a suite a single test case can be run through.
 */
public class TestCasePipelineResolver implements RunnablePipelineResolver {

  @Override
  public Set<PipelineType> pipelineTypes() {
    return Set.of(PipelineType.TEST_SUITE);
  }

  @Override
  public String entityFields() {
    return "testSuite";
  }

  @Override
  public List<IngestionPipeline> pipelinesOwning(
      EntityInterface testCase, PipelineType pipelineType) {
    TestSuite testSuite =
        Entity.getEntity(((TestCase) testCase).getTestSuite(), "pipelines", Include.NON_DELETED);
    return RunnablePipelineResolver.pipelinesOfType(testSuite.getPipelines(), pipelineType);
  }
}

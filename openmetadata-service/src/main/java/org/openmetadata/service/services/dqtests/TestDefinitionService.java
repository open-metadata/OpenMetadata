/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.services.dqtests;

import java.io.IOException;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestDefinitionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.dqtests.TestDefinitionMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.TEST_DEFINITION)
public class TestDefinitionService
    extends EntityBaseService<TestDefinition, TestDefinitionRepository> {

  public static final String FIELDS = "owners";

  @Getter private final TestDefinitionMapper mapper;

  @Inject
  public TestDefinitionService(
      TestDefinitionRepository repository,
      Authorizer authorizer,
      TestDefinitionMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.TEST_DEFINITION, TestDefinition.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  public void initialize() throws IOException {
    List<TestDefinition> testDefinitions =
        repository.getEntitiesFromSeedData(".*json/data/tests/.*\\.json$");
    for (TestDefinition testDefinition : testDefinitions) {
      repository.initializeEntity(testDefinition);
    }
  }

  public static class TestDefinitionList extends ResultList<TestDefinition> {
    /* Required for serde */
  }
}

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

package org.openmetadata.service.services.connections;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.TestConnectionDefinitionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.TEST_CONNECTION_DEFINITION)
public class TestConnectionDefinitionService
    extends EntityBaseService<TestConnectionDefinition, TestConnectionDefinitionRepository> {

  public static final String FIELDS = "owners";

  @Inject
  public TestConnectionDefinitionService(
      TestConnectionDefinitionRepository repository, Authorizer authorizer, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.TEST_CONNECTION_DEFINITION, TestConnectionDefinition.class),
        repository,
        authorizer,
        limits);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    List<TestConnectionDefinition> testConnectionDefinitions =
        repository.getEntitiesFromSeedData(".*json/data/testConnections/.*\\.json$");

    for (TestConnectionDefinition testConnectionDefinition : testConnectionDefinitions) {
      repository.prepareInternal(testConnectionDefinition, true);
      testConnectionDefinition.setId(UUID.randomUUID());
      testConnectionDefinition.setUpdatedBy(ADMIN_USER_NAME);
      testConnectionDefinition.setUpdatedAt(System.currentTimeMillis());
      repository.createOrUpdate(null, testConnectionDefinition, ADMIN_USER_NAME);
    }
  }

  public static class TestConnectionDefinitionList extends ResultList<TestConnectionDefinition> {
    /* Required for serde */
  }
}

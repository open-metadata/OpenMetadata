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

import jakarta.ws.rs.core.UriInfo;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.TEST_CASE)
public class TestCaseService extends EntityBaseService<TestCase, TestCaseRepository> {

  static final String FIELDS =
      "owners,reviewers,entityStatus,testSuite,testDefinition,testSuites,incidentId,domains,tags,followers";

  @Getter private final TestCaseMapper mapper;

  @Inject
  public TestCaseService(
      TestCaseRepository repository, Authorizer authorizer, TestCaseMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.TEST_CASE, TestCase.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public TestCase addHref(UriInfo uriInfo, TestCase test) {
    super.addHref(uriInfo, test);
    Entity.withHref(uriInfo, test.getTestSuite());
    Entity.withHref(uriInfo, test.getTestDefinition());
    return test;
  }

  public static class TestCaseList extends ResultList<TestCase> {
    /* Required for serde */
  }
}

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

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
public class TestCaseResultService {

  @Getter private final TestCaseResultRepository repository;
  private final Authorizer authorizer;

  @Inject
  public TestCaseResultService(TestCaseResultRepository repository, Authorizer authorizer) {
    this.repository = repository;
    this.authorizer = authorizer;
  }

  public ResultList<TestCaseResult> getTestCaseResults(String fqn, Long startTs, Long endTs) {
    return repository.getTestCaseResults(fqn, startTs, endTs);
  }

  public Response addTestCaseResult(
      String updatedBy, UriInfo uriInfo, String fqn, TestCaseResult testCaseResult) {
    return repository.addTestCaseResult(updatedBy, uriInfo, fqn, testCaseResult);
  }

  public RestUtil.PatchResponse<TestCaseResult> patchTestCaseResults(
      String fqn, Long timestamp, JsonPatch patch, String updatedBy) {
    return repository.patchTestCaseResults(fqn, timestamp, patch, updatedBy);
  }

  public RestUtil.DeleteResponse<TestCaseResult> deleteTestCaseResult(String fqn, Long timestamp) {
    return repository.deleteTestCaseResult(fqn, timestamp);
  }

  public TestCaseResult listLastTestCaseResult(String testCaseFQN) {
    return repository.listLastTestCaseResult(testCaseFQN);
  }
}

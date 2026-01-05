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
import jakarta.ws.rs.core.SecurityContext;
import java.beans.IntrospectionException;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestCaseResolutionStatusRepository;
import org.openmetadata.service.resources.dqtests.TestCaseResolutionStatusMapper;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PatchResponse;

@Slf4j
@Singleton
public class TestCaseResolutionStatusService {

  @Getter private final TestCaseResolutionStatusRepository repository;

  @Getter
  private final TestCaseResolutionStatusMapper mapper = new TestCaseResolutionStatusMapper();

  private final Authorizer authorizer;

  @Inject
  public TestCaseResolutionStatusService(
      TestCaseResolutionStatusRepository repository, Authorizer authorizer) {
    this.repository = repository;
    this.authorizer = authorizer;
  }

  public void authorizeRequests(
      SecurityContext securityContext,
      List<AuthRequest> authRequests,
      AuthorizationLogic authorizationLogic) {
    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);
  }

  public ResultList<TestCaseResolutionStatus> list(
      String offset, Long startTs, Long endTs, int limitParam, ListFilter filter, Boolean latest) {
    return repository.list(offset, startTs, endTs, limitParam, filter, latest);
  }

  public ResultList<TestCaseResolutionStatus> listTestCaseResolutionStatusesForStateId(
      UUID stateId) {
    return repository.listTestCaseResolutionStatusesForStateId(stateId);
  }

  public TestCaseResolutionStatus getById(UUID id) {
    return repository.getById(id);
  }

  public Response create(TestCaseResolutionStatus entity, String recordFQN) {
    entity = repository.createNewRecord(entity, recordFQN);
    return Response.ok(entity).build();
  }

  public Response patch(UUID id, JsonPatch patch, String user)
      throws IntrospectionException, InvocationTargetException, IllegalAccessException {
    PatchResponse<TestCaseResolutionStatus> response = repository.patch(id, patch, user);
    return response.toResponse();
  }

  public ResultList<TestCaseResolutionStatus> listFromSearchWithOffset(
      Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException {
    return repository.listFromSearchWithOffset(
        fields, searchListFilter, limit, offset, searchSortFilter, q, queryString);
  }

  public ResultList<TestCaseResolutionStatus> listLatestFromSearch(
      Fields fields, SearchListFilter searchListFilter, String groupBy, String q)
      throws IOException {
    return repository.listLatestFromSearch(fields, searchListFilter, groupBy, q);
  }
}

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

package org.openmetadata.service.services.teams;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.USER)
public class UserService extends AbstractEntityService<User> {

  @Getter private final UserMapper mapper;
  private final UserRepository userRepository;

  @Inject
  public UserService(
      UserRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      UserMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.USER);
    this.userRepository = repository;
    this.mapper = mapper;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    userRepository.initializeUsers(config);
  }

  public User getLoggedInUser(
      UriInfo uriInfo,
      CatalogSecurityContext securityContext,
      String name,
      String email,
      Fields fields) {
    return userRepository.getLoggedInUserByNameAndEmail(uriInfo, name, email, fields);
  }

  public List<EntityReference> getGroupTeams(
      UriInfo uriInfo, CatalogSecurityContext securityContext, String email) {
    return userRepository.getGroupTeams(uriInfo, securityContext, email);
  }

  public ResultList<EntityReference> getUserAssets(UUID id, int limit, int offset) {
    return userRepository.getUserAssets(id, limit, offset);
  }

  public ResultList<EntityReference> getUserAssetsByName(String name, int limit, int offset) {
    return userRepository.getUserAssetsByName(name, limit, offset);
  }

  public boolean checkEmailAlreadyExists(String email) {
    return userRepository.checkEmailAlreadyExists(email);
  }

  public RestUtil.PutResponse<User> updateVote(
      SecurityContext securityContext, UUID id, org.openmetadata.schema.api.VoteRequest request) {
    return userRepository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public void validateTeamAddition(UUID userId, UUID teamId) {
    userRepository.validateTeamAddition(userId, teamId);
  }

  public boolean isTeamJoinable(String teamId) {
    return userRepository.isTeamJoinable(teamId);
  }
}

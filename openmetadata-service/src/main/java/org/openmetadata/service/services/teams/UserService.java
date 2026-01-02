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

import static org.openmetadata.common.utils.CommonUtil.listOf;

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
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.teams.UserMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.USER)
public class UserService extends EntityBaseService<User, UserRepository> {

  public static final String FIELDS =
      "profile,roles,teams,follows,owns,domains,personas,defaultPersona,personaPreferences";
  public static final String USER_PROTECTED_FIELDS = "authenticationMechanism";

  @Getter private final UserMapper mapper;

  @Inject
  public UserService(
      UserRepository repository, Authorizer authorizer, UserMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.USER, User.class), repository, authorizer, limits);
    this.mapper = mapper;
    allowedFields.remove(USER_PROTECTED_FIELDS);
  }

  @Override
  public User addHref(UriInfo uriInfo, User user) {
    super.addHref(uriInfo, user);
    Entity.withHref(uriInfo, user.getTeams());
    Entity.withHref(uriInfo, user.getRoles());
    Entity.withHref(uriInfo, user.getPersonas());
    Entity.withHref(uriInfo, user.getInheritedRoles());
    Entity.withHref(uriInfo, user.getOwns());
    Entity.withHref(uriInfo, user.getFollows());
    return user;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("profile,roles,teams,follows,owns", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_TEAMS);
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    repository.initializeUsers(config);
  }

  public User getLoggedInUser(
      UriInfo uriInfo,
      CatalogSecurityContext securityContext,
      String name,
      String email,
      Fields fields) {
    return repository.getLoggedInUserByNameAndEmail(uriInfo, name, email, fields);
  }

  public List<EntityReference> getGroupTeams(
      UriInfo uriInfo, CatalogSecurityContext securityContext, String email) {
    return repository.getGroupTeams(uriInfo, securityContext, email);
  }

  public ResultList<EntityReference> getUserAssets(UUID id, int limit, int offset) {
    return repository.getUserAssets(id, limit, offset);
  }

  public ResultList<EntityReference> getUserAssetsByName(String name, int limit, int offset) {
    return repository.getUserAssetsByName(name, limit, offset);
  }

  public boolean checkEmailAlreadyExists(String email) {
    return repository.checkEmailAlreadyExists(email);
  }

  public RestUtil.PutResponse<User> updateVote(
      SecurityContext securityContext, UUID id, org.openmetadata.schema.api.VoteRequest request) {
    return repository.updateVote(securityContext.getUserPrincipal().getName(), id, request);
  }

  public void validateTeamAddition(UUID userId, UUID teamId) {
    repository.validateTeamAddition(userId, teamId);
  }

  public boolean isTeamJoinable(String teamId) {
    return repository.isTeamJoinable(teamId);
  }

  public static class UserList extends ResultList<User> {
    /* Required for serde */
  }
}

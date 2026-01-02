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
import java.util.Map;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.TeamHierarchy;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.resources.teams.TeamMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.TEAM)
public class TeamService extends AbstractEntityService<Team> {

  public static final String FIELDS =
      "owners,profile,users,owns,defaultRoles,parents,children,policies,userCount,childrenCount,domains";

  @Getter private final TeamMapper mapper;
  private final TeamRepository teamRepository;

  @Inject
  public TeamService(
      TeamRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TeamMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.TEAM);
    this.teamRepository = repository;
    this.mapper = mapper;
  }

  public Team addHref(UriInfo uriInfo, Team team) {
    Entity.withHref(uriInfo, team.getOwners());
    Entity.withHref(uriInfo, team.getFollowers());
    Entity.withHref(uriInfo, team.getExperts());
    Entity.withHref(uriInfo, team.getReviewers());
    Entity.withHref(uriInfo, team.getChildren());
    Entity.withHref(uriInfo, team.getDomains());
    Entity.withHref(uriInfo, team.getDataProducts());
    Entity.withHref(uriInfo, team.getUsers());
    Entity.withHref(uriInfo, team.getDefaultRoles());
    Entity.withHref(uriInfo, team.getOwns());
    Entity.withHref(uriInfo, team.getParents());
    Entity.withHref(uriInfo, team.getPolicies());
    return team;
  }

  public static class TeamList extends ResultList<Team> {}

  public static class TeamHierarchyList extends ResultList<TeamHierarchy> {}

  public List<TeamHierarchy> listHierarchy(ListFilter filter, int limit, Boolean isJoinable) {
    return teamRepository.listHierarchy(filter, limit, isJoinable);
  }

  public BulkOperationResult bulkAddAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return teamRepository.bulkAddAssets(name, request);
  }

  public BulkOperationResult bulkRemoveAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return teamRepository.bulkRemoveAssets(name, request);
  }

  public ResultList<EntityReference> getTeamAssets(UUID id, int limit, int offset) {
    return teamRepository.getTeamAssets(id, limit, offset);
  }

  public ResultList<EntityReference> getTeamAssetsByName(String fqn, int limit, int offset) {
    return teamRepository.getTeamAssetsByName(fqn, limit, offset);
  }

  public RestUtil.PutResponse<Team> updateTeamUsers(
      SecurityContext securityContext, UUID teamId, List<EntityReference> users) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_USERS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(teamId));
    return teamRepository.updateTeamUsers(
        securityContext.getUserPrincipal().getName(), teamId, users);
  }

  public RestUtil.PutResponse<Team> deleteTeamUser(
      SecurityContext securityContext, UUID teamId, UUID userId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_USERS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(teamId));
    return teamRepository.deleteTeamUser(
        securityContext.getUserPrincipal().getName(), teamId, userId);
  }

  public Map<String, Integer> getAllTeamsWithAssetsCount() {
    return teamRepository.getAllTeamsWithAssetsCount();
  }

  public void initOrganization() {
    teamRepository.initOrganization();
  }
}

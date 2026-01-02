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
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.teams.TeamMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.TEAM)
public class TeamService extends EntityBaseService<Team, TeamRepository> {

  public static final String FIELDS =
      "owners,profile,users,owns,defaultRoles,parents,children,policies,userCount,childrenCount,domains";

  @Getter private final TeamMapper mapper;

  @Inject
  public TeamService(
      TeamRepository repository, Authorizer authorizer, TeamMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.TEAM, Team.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public Team addHref(UriInfo uriInfo, Team team) {
    super.addHref(uriInfo, team);
    Entity.withHref(uriInfo, team.getFollowers());
    Entity.withHref(uriInfo, team.getExperts());
    Entity.withHref(uriInfo, team.getReviewers());
    Entity.withHref(uriInfo, team.getChildren());
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
    return repository.listHierarchy(filter, limit, isJoinable);
  }

  public BulkOperationResult bulkAddAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkAddAssets(name, request);
  }

  public BulkOperationResult bulkRemoveAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkRemoveAssets(name, request);
  }

  public ResultList<EntityReference> getTeamAssets(UUID id, int limit, int offset) {
    return repository.getTeamAssets(id, limit, offset);
  }

  public ResultList<EntityReference> getTeamAssetsByName(String fqn, int limit, int offset) {
    return repository.getTeamAssetsByName(fqn, limit, offset);
  }

  public RestUtil.PutResponse<Team> updateTeamUsers(
      SecurityContext securityContext, UUID teamId, List<EntityReference> users) {
    authorizeEditUsers(securityContext, teamId);
    return repository.updateTeamUsers(securityContext.getUserPrincipal().getName(), teamId, users);
  }

  public RestUtil.PutResponse<Team> deleteTeamUser(
      SecurityContext securityContext, UUID teamId, UUID userId) {
    authorizeEditUsers(securityContext, teamId);
    return repository.deleteTeamUser(securityContext.getUserPrincipal().getName(), teamId, userId);
  }

  public Map<String, Integer> getAllTeamsWithAssetsCount() {
    return repository.getAllTeamsWithAssetsCount();
  }

  public void initOrganization() {
    repository.initOrganization();
  }

  public ResultList<Team> listTeams(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fieldsParam,
      ListFilter filter,
      int limitParam,
      String before,
      String after) {
    authorizeViewBasic(securityContext, filter);
    org.openmetadata.service.util.EntityUtil.addDomainQueryParam(
        securityContext, filter, Entity.TEAM);
    org.openmetadata.service.util.EntityUtil.Fields fields = getFields(fieldsParam);
    ResultList<Team> resultList;
    if (before != null) {
      resultList = repository.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      resultList = repository.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return resultList;
  }

  private void authorizeEditAll(SecurityContext securityContext, String name) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
  }

  private void authorizeEditUsers(SecurityContext securityContext, UUID teamId) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_USERS);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(teamId));
  }

  private void authorizeViewBasic(SecurityContext securityContext, ListFilter filter) {
    OperationContext operationContext =
        new OperationContext(Entity.TEAM, MetadataOperation.VIEW_BASIC);
    org.openmetadata.service.security.policyevaluator.ResourceContext resourceContext =
        filter.getResourceContext(Entity.TEAM);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }
}

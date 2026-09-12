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
package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.listOrEmptyMutable;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addEntityReferences;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.BUSINESS_UNIT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DEPARTMENT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DIVISION;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.GROUP;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.ORGANIZATION;
import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.Entity.POLICY;
import static org.openmetadata.service.Entity.ROLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_GROUP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.DELETE_ORGANIZATION;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_GROUP_TEAM_CHILDREN_UPDATE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_GROUP_TEAM_UPDATE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.UNEXPECTED_PARENT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidChild;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParent;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParentCount;
import static org.openmetadata.service.util.EntityUtil.Fields;
import static org.openmetadata.service.util.EntityUtil.RelationIncludes;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.TeamHierarchy;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvErrorType;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityPageReader;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.teams.TeamResource;
import org.openmetadata.service.search.DefaultInheritedFieldEntitySearch;
import org.openmetadata.service.search.EntityBuilderConstant;
import org.openmetadata.service.search.InheritedFieldEntitySearch;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldResult;
import org.openmetadata.service.search.QueryFilterBuilder;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.tasks.TaskAssigneeCleanup;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository()
public class TeamRepository implements EntityPolicy<Team> {

  static final String PARENTS_FIELD = "parents";

  static final String USERS_FIELD = "users";

  private static final String OWNS_ENTITY_TYPE_PARAM = "ownsEntityType";

  static final String TEAM_UPDATE_FIELDS =
      "profile,users,defaultRoles,defaultPersona,parents,children,policies,teamType,email,domains";

  static final String TEAM_PATCH_FIELDS =
      "profile,users,defaultRoles,defaultPersona,parents,children,policies,teamType,email,domains";

  private static final String DEFAULT_ROLES = "defaultRoles";

  private static final String DEFAULT_PERSONA = "defaultPersona";

  private Team organization = null;

  private InheritedFieldEntitySearch inheritedFieldEntitySearch;

  public TeamRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                TeamResource.COLLECTION_PATH,
                TEAM,
                Team.class,
                Entity.getCollectionDAO().teamDAO()),
            new EntityPolicyContext.WriteFields(TEAM_PATCH_FIELDS, TEAM_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setQuoteFqn(true);
    context().options().setSupportsSearch(true);
    this.fieldLoading().register("users", this::fetchAndSetUsers);
    this.fieldLoading().register("defaultRoles", this::fetchAndSetDefaultRoles);
    this.fieldLoading().register("defaultPersona", this::fetchAndSetDefaultPersona);
    this.fieldLoading().register("parents", this::fetchAndSetParents);
    this.fieldLoading().register("policies", this::fetchAndSetPolicies);
    this.fieldLoading().register("childrenCount", this::fetchAndSetChildrenCount);
    this.fieldLoading().register("userCount", this::fetchAndSetUserCount);
    this.fieldLoading().register("owns", this::fetchAndSetOwns);
    if (context().dependencies().search() != null) {
      inheritedFieldEntitySearch =
          new DefaultInheritedFieldEntitySearch(context().dependencies().search());
    }
  }

  @Override
  public void setFields(Team team, Fields fields, RelationIncludes relationIncludes) {
    team.setUsers(fields.contains("users") ? getUsers(team) : team.getUsers());
    team.setOwns(fields.contains("owns") ? getOwns(team) : team.getOwns());
    team.setDefaultRoles(
        fields.contains(DEFAULT_ROLES) ? getDefaultRoles(team) : team.getDefaultRoles());
    team.setInheritedRoles(
        fields.contains(DEFAULT_ROLES) ? getInheritedRoles(team) : team.getInheritedRoles());
    team.setDefaultPersona(
        fields.contains(DEFAULT_PERSONA) ? getDefaultPersona(team) : team.getDefaultPersona());
    team.setParents(fields.contains(PARENTS_FIELD) ? getParents(team) : team.getParents());
    team.setPolicies(fields.contains("policies") ? getPolicies(team) : team.getPolicies());
    team.setChildrenCount(
        fields.contains("childrenCount") ? getChildrenCount(team) : team.getChildrenCount());
    team.setUserCount(
        fields.contains("userCount") ? getUserCount(team.getId()) : team.getUserCount());
    team.setDomains(fields.contains(FIELD_DOMAINS) ? getDomains(team.getId()) : team.getDomains());
  }

  @Override
  public void clearFields(Team team, Fields fields) {
    team.setProfile(fields.contains("profile") ? team.getProfile() : null);
    team.setUsers(fields.contains("users") ? team.getUsers() : null);
    team.setOwns(fields.contains("owns") ? team.getOwns() : null);
    team.setDefaultRoles(fields.contains(DEFAULT_ROLES) ? team.getDefaultRoles() : null);
    team.setInheritedRoles(fields.contains(DEFAULT_ROLES) ? team.getInheritedRoles() : null);
    team.setDefaultPersona(fields.contains(DEFAULT_PERSONA) ? team.getDefaultPersona() : null);
    team.setParents(fields.contains(PARENTS_FIELD) ? team.getParents() : null);
    team.setPolicies(fields.contains("policies") ? team.getPolicies() : null);
    if (!fields.contains("childrenCount")) {
      team.setChildrenCount(0);
    }
    if (!fields.contains("userCount")) {
      team.setUserCount(0);
    }
  }

  private void fetchAndSetUsers(List<Team> teams, Fields fields) {
    if (!fields.contains("users") || teams == null || teams.isEmpty()) {
      return;
    }
    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();
    List<CollectionDAO.EntityRelationshipObject> userRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(teamIds, Relationship.HAS.ordinal(), TEAM, Entity.USER);
    Map<UUID, EntityReference> userRefsById =
        batchResolveRefs(
            Entity.USER, userRecords.stream().map(r -> UUID.fromString(r.getToId())).toList());
    Map<UUID, List<EntityReference>> teamToUsers = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : userRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      EntityReference userRef = userRefsById.get(UUID.fromString(record.getToId()));
      if (userRef != null) {
        teamToUsers.computeIfAbsent(teamId, k -> new ArrayList<>()).add(userRef);
      }
    }
    for (Team team : teams) {
      List<EntityReference> userRefs = teamToUsers.get(team.getId());
      team.setUsers(userRefs != null ? userRefs : new ArrayList<>());
    }
  }

  private void fetchAndSetDefaultRoles(List<Team> teams, Fields fields) {
    if (!fields.contains(DEFAULT_ROLES) || teams == null || teams.isEmpty()) {
      return;
    }
    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();
    List<CollectionDAO.EntityRelationshipObject> roleRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(teamIds, Relationship.HAS.ordinal(), TEAM, Entity.ROLE);
    Map<UUID, EntityReference> roleRefsById =
        batchResolveRefs(
            Entity.ROLE, roleRecords.stream().map(r -> UUID.fromString(r.getToId())).toList());
    Map<UUID, List<EntityReference>> teamToRoles = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : roleRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      EntityReference roleRef = roleRefsById.get(UUID.fromString(record.getToId()));
      if (roleRef != null) {
        teamToRoles.computeIfAbsent(teamId, k -> new ArrayList<>()).add(roleRef);
      }
    }
    for (Team team : teams) {
      List<EntityReference> roleRefs = teamToRoles.get(team.getId());
      team.setDefaultRoles(roleRefs != null ? roleRefs : new ArrayList<>());
      team.setInheritedRoles(getInheritedRoles(team));
    }
  }

  private void fetchAndSetDefaultPersona(List<Team> teams, Fields fields) {
    if (!fields.contains(DEFAULT_PERSONA) || teams == null || teams.isEmpty()) {
      return;
    }
    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();
    List<CollectionDAO.EntityRelationshipObject> personaRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(teamIds, Relationship.HAS.ordinal(), TEAM, Entity.PERSONA);
    Map<UUID, EntityReference> personaRefsById =
        batchResolveRefs(
            Entity.PERSONA,
            personaRecords.stream().map(r -> UUID.fromString(r.getToId())).toList());
    Map<UUID, EntityReference> teamToPersona = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : personaRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      EntityReference personaRef = personaRefsById.get(UUID.fromString(record.getToId()));
      if (personaRef != null && !Boolean.TRUE.equals(personaRef.getDeleted())) {
        teamToPersona.put(teamId, personaRef);
      }
    }
    for (Team team : teams) {
      team.setDefaultPersona(teamToPersona.get(team.getId()));
    }
  }

  private void fetchAndSetParents(List<Team> teams, Fields fields) {
    if (!fields.contains(PARENTS_FIELD) || teams == null || teams.isEmpty()) {
      return;
    }
    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();
    List<CollectionDAO.EntityRelationshipObject> parentRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(teamIds, Relationship.PARENT_OF.ordinal(), TEAM, TEAM);
    Map<UUID, EntityReference> parentRefsById =
        batchResolveRefs(
            TEAM, parentRecords.stream().map(r -> UUID.fromString(r.getFromId())).toList());
    Map<UUID, List<EntityReference>> teamToParents = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : parentRecords) {
      UUID teamId = UUID.fromString(record.getToId());
      EntityReference parentRef = parentRefsById.get(UUID.fromString(record.getFromId()));
      if (parentRef != null) {
        teamToParents.computeIfAbsent(teamId, k -> new ArrayList<>()).add(parentRef);
      }
    }
    for (Team team : teams) {
      List<EntityReference> parentRefs = teamToParents.get(team.getId());
      if (parentRefs == null || parentRefs.isEmpty()) {
        if (organization != null && !team.getId().equals(organization.getId())) {
          team.setParents(new ArrayList<>(List.of(organization.getEntityReference())));
        } else {
          team.setParents(new ArrayList<>());
        }
      } else {
        team.setParents(parentRefs);
      }
    }
  }

  private void fetchAndSetPolicies(List<Team> teams, Fields fields) {
    if (!fields.contains("policies") || teams == null || teams.isEmpty()) {
      return;
    }
    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();
    List<CollectionDAO.EntityRelationshipObject> policyRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(teamIds, Relationship.HAS.ordinal(), TEAM, POLICY);
    Map<UUID, EntityReference> policyRefsById =
        batchResolveRefs(
            POLICY, policyRecords.stream().map(r -> UUID.fromString(r.getToId())).toList());
    Map<UUID, List<EntityReference>> teamToPolicies = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : policyRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      EntityReference policyRef = policyRefsById.get(UUID.fromString(record.getToId()));
      if (policyRef != null) {
        teamToPolicies.computeIfAbsent(teamId, k -> new ArrayList<>()).add(policyRef);
      }
    }
    for (Team team : teams) {
      List<EntityReference> policyRefs = teamToPolicies.get(team.getId());
      team.setPolicies(policyRefs != null ? policyRefs : new ArrayList<>());
    }
  }

  private void fetchAndSetChildrenCount(List<Team> teams, Fields fields) {
    if (!fields.contains("childrenCount") || teams == null || teams.isEmpty()) {
      return;
    }
    List<String> nonOrgTeamIds = new ArrayList<>();
    for (Team team : teams) {
      if (isOrganizationTeam(team)) {
        team.setChildrenCount(
            context()
                .dependencies()
                .daos()
                .teamDAO()
                .countLiveTeamsUnderOrganization(team.getId()));
      } else {
        nonOrgTeamIds.add(team.getId().toString());
      }
    }
    Map<UUID, List<UUID>> childrenByParent = batchChildTeamsByParent(nonOrgTeamIds);
    for (Team team : teams) {
      if (!isOrganizationTeam(team)) {
        team.setChildrenCount(childrenByParent.getOrDefault(team.getId(), List.of()).size());
      }
    }
  }

  private void fetchAndSetUserCount(List<Team> teams, Fields fields) {
    if (!fields.contains("userCount") || teams == null || teams.isEmpty()) {
      return;
    }
    List<UUID> rootIds = teams.stream().map(Team::getId).distinct().collect(Collectors.toList());
    Map<UUID, List<UUID>> childrenMap = new HashMap<>();
    Set<UUID> subtreeTeamIds = discoverSubtreeTeams(rootIds, childrenMap);
    Map<UUID, Set<UUID>> directUsers = batchFetchDirectUsers(subtreeTeamIds);
    for (Team team : teams) {
      team.setUserCount(countSubtreeUsers(team.getId(), childrenMap, directUsers));
    }
  }

  private boolean isOrganizationTeam(Team team) {
    return organization != null && team.getId().equals(organization.getId());
  }

  private Set<UUID> discoverSubtreeTeams(List<UUID> rootIds, Map<UUID, List<UUID>> childrenMap) {
    Set<UUID> visited = new HashSet<>();
    List<UUID> frontier = new ArrayList<>(rootIds);
    while (!frontier.isEmpty()) {
      visited.addAll(frontier);
      Map<UUID, List<UUID>> levelChildren = fetchChildTeams(frontier);
      childrenMap.putAll(levelChildren);
      frontier = nextFrontier(levelChildren, visited);
    }
    return visited;
  }

  private List<UUID> nextFrontier(Map<UUID, List<UUID>> levelChildren, Set<UUID> visited) {
    return levelChildren.values().stream()
        .flatMap(List::stream)
        .distinct()
        .filter(id -> !visited.contains(id))
        .collect(Collectors.toList());
  }

  private Map<UUID, List<UUID>> fetchChildTeams(List<UUID> teamIds) {
    Map<UUID, List<UUID>> result = new HashMap<>();
    List<String> nonOrgIds = new ArrayList<>();
    for (UUID teamId : teamIds) {
      if (organization != null && teamId.equals(organization.getId())) {
        result.put(teamId, getLiveOrganizationChildIds(teamId));
      } else {
        nonOrgIds.add(teamId.toString());
      }
    }
    result.putAll(batchChildTeamsByParent(nonOrgIds));
    return result;
  }

  private Map<UUID, List<UUID>> batchChildTeamsByParent(List<String> parentIds) {
    Map<UUID, List<UUID>> result = new HashMap<>();
    if (nullOrEmpty(parentIds)) {
      return result;
    }
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(parentIds, TEAM, TEAM, Relationship.PARENT_OF.ordinal(), ALL);
    Set<UUID> liveChildren = nonDeletedToIds(records, TEAM);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID childId = UUID.fromString(record.getToId());
      if (liveChildren.contains(childId)) {
        result
            .computeIfAbsent(UUID.fromString(record.getFromId()), k -> new ArrayList<>())
            .add(childId);
      }
    }
    return result;
  }

  private Set<UUID> nonDeletedToIds(
      List<CollectionDAO.EntityRelationshipObject> records, String entityType) {
    List<UUID> toIds =
        records.stream()
            .map(r -> UUID.fromString(r.getToId()))
            .distinct()
            .collect(Collectors.toList());
    Set<UUID> live = new HashSet<>();
    if (!toIds.isEmpty()) {
      Entity.getEntityReferencesByIds(entityType, toIds, NON_DELETED)
          .forEach(ref -> live.add(ref.getId()));
    }
    return live;
  }

  private Map<UUID, Set<UUID>> batchFetchDirectUsers(Set<UUID> teamIds) {
    Map<UUID, Set<UUID>> directUsers = new HashMap<>();
    if (nullOrEmpty(teamIds)) {
      return directUsers;
    }
    List<String> ids = teamIds.stream().map(UUID::toString).collect(Collectors.toList());
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(ids, TEAM, Entity.USER, Relationship.HAS.ordinal(), ALL);
    Set<UUID> liveUsers = nonDeletedToIds(records, Entity.USER);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID userId = UUID.fromString(record.getToId());
      if (liveUsers.contains(userId)) {
        directUsers
            .computeIfAbsent(UUID.fromString(record.getFromId()), k -> new HashSet<>())
            .add(userId);
      }
    }
    return directUsers;
  }

  private int countSubtreeUsers(
      UUID rootId, Map<UUID, List<UUID>> childrenMap, Map<UUID, Set<UUID>> directUsers) {
    Set<UUID> users = new HashSet<>();
    Set<UUID> visited = new HashSet<>();
    Deque<UUID> stack = new ArrayDeque<>();
    stack.push(rootId);
    while (!stack.isEmpty()) {
      UUID teamId = stack.pop();
      if (visited.add(teamId)) {
        users.addAll(directUsers.getOrDefault(teamId, Set.of()));
        childrenMap.getOrDefault(teamId, List.of()).forEach(stack::push);
      }
    }
    return users.size();
  }

  private void fetchAndSetOwns(List<Team> teams, Fields fields) {
    fetchAndSetOwns(teams, fields, null);
  }

  private void fetchAndSetOwns(List<Team> teams, Fields fields, ListFilter filter) {
    if (!fields.contains("owns") || teams == null || teams.isEmpty()) {
      return;
    }
    List<String> teamIds = teams.stream().map(Team::getId).map(UUID::toString).distinct().toList();
    String ownsEntityType = filter == null ? null : filter.getQueryParam(OWNS_ENTITY_TYPE_PARAM);
    List<CollectionDAO.EntityRelationshipObject> ownsRecords =
        nullOrEmpty(ownsEntityType)
            ? context()
                .dependencies()
                .daos()
                .relationshipDAO()
                .findToBatchAllTypes(teamIds, Relationship.OWNS.ordinal(), Include.ALL)
            : context()
                .dependencies()
                .daos()
                .relationshipDAO()
                .findToBatch(teamIds, Relationship.OWNS.ordinal(), ownsEntityType, Include.ALL);
    Map<UUID, List<EntityReference>> teamToOwns = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : ownsRecords) {
      UUID teamId = UUID.fromString(record.getFromId());
      try {
        EntityReference ownedRef =
            Entity.getEntityReferenceById(
                record.getToEntity(), UUID.fromString(record.getToId()), Include.ALL);
        teamToOwns.computeIfAbsent(teamId, k -> new ArrayList<>()).add(ownedRef);
      } catch (Exception e) {
        LOG.warn("Failed to get entity reference for owned entity: {}", record.getToId(), e);
      }
    }
    for (Team team : teams) {
      List<EntityReference> ownsRefs = teamToOwns.get(team.getId());
      team.setOwns(ownsRefs != null ? ownsRefs : new ArrayList<>());
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Team> teams) {
    EntityPolicy.super.setFieldsInBulk(fields, teams);
    fetchAndSetTeamChildren(teams, fields);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<Team> teams, ListFilter filter) {
    if (fields.contains("owns")
        && filter != null
        && !nullOrEmpty(filter.getQueryParam(OWNS_ENTITY_TYPE_PARAM))) {
      fieldLoading().populate(teams, fields, Set.of("owns"));
      fetchAndSetOwns(teams, fields, filter);
      setInheritedFields(teams, fields);
      for (Team team : teams) {
        clearFieldsInternal(team, fields);
      }
      fetchAndSetTeamChildren(teams, fields);
      return;
    }
    setFieldsInBulk(fields, teams);
  }

  private void fetchAndSetTeamChildren(List<Team> teams, Fields fields) {
    if (!fields.contains(FIELD_CHILDREN) || nullOrEmpty(teams)) {
      return;
    }
    // Common child hydration follows CONTAINS; teams use PARENT_OF and implicit Organization
    // membership.
    Map<UUID, List<UUID>> children = fetchChildTeams(teams.stream().map(Team::getId).toList());
    Map<UUID, EntityReference> references =
        batchResolveRefs(TEAM, children.values().stream().flatMap(List::stream).toList());
    for (Team team : teams) {
      team.setChildren(
          children.getOrDefault(team.getId(), List.of()).stream().map(references::get).toList());
    }
  }

  private List<EntityReference> getDomains(UUID teamId) {
    // Team does not have domain. 'domains' is the field for user as team can belong to multiple
    // domains
    return relationships()
        .from(
            new EntityRelationshipReader.Selection(teamId, TEAM, Relationship.HAS, Entity.DOMAIN),
            Include.NON_DELETED);
  }

  @Override
  public void storeDomains(Team entity, List<EntityReference> exclude) {
    for (EntityReference domainRef : listOrEmpty(entity.getDomains())) {
      // Add relationship domain --- has ---> entity
      LOG.info(
          "Adding domain {} for user {}:{}",
          domainRef.getFullyQualifiedName(),
          context().schema().entityType(),
          entity.getId());
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  domainRef.getId(),
                  entity.getId(),
                  Entity.DOMAIN,
                  context().schema().entityType(),
                  Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public void restorePatchAttributes(Team original, Team updated) {
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withInheritedRoles(original.getInheritedRoles());
  }

  @Override
  public void prepare(Team team, boolean update) {
    // Validate parents
    populateParents(team);
    // Validate children
    populateChildren(team);
    // Validate hierarchy for circular dependency
    validateHierarchy(team);
    referenceValidation().users(team.getUsers());
    if (!update) {
      validateDirectUserAddition(team, team.getUsers());
    }
    referenceValidation().roles(team.getDefaultRoles());
    referenceValidation().policies(team.getPolicies());
    validateDefaultPersona(team);
  }

  public BulkOperationResult bulkAddAssets(String teamName, BulkAssets request, String userName) {
    Team team = getByName(null, teamName, fieldPolicy().parse("id,teamType"));
    validateAllRefUsers(request.getAssets());
    validateDirectUserAddition(team, request.getAssets());
    return bulkAssetsOperation(team.getId(), TEAM, Relationship.HAS, request, true, userName);
  }

  public BulkOperationResult bulkRemoveAssets(
      String teamName, BulkAssets request, String userName) {
    Team team = getByName(null, teamName, fieldPolicy().parse("id"));
    validateAllRefUsers(request.getAssets());
    return bulkAssetsOperation(team.getId(), TEAM, Relationship.HAS, request, false, userName);
  }

  private void validateAllRefUsers(List<EntityReference> refs) {
    if (nullOrEmpty(refs)) {
      return;
    }
    for (EntityReference asset : refs) {
      if (!Objects.equals(asset.getType(), Entity.USER)) {
        throw new IllegalArgumentException("Only users can be added to a Team");
      }
    }
  }

  public ResultList<EntityReference> getTeamAssets(UUID teamId, int limit, int offset) {
    Team team =
        reads()
            .byId(
                teamId,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse("id,fullyQualifiedName"),
                    RelationIncludes.fromInclude(Include.NON_DELETED),
                    false));
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search is unavailable for team assets. Returning empty list.");
      return new ResultList<>(new ArrayList<>(), null, null, 0);
    }
    InheritedFieldQuery query = InheritedFieldQuery.forTeam(team.getId().toString(), offset, limit);
    InheritedFieldResult result =
        inheritedFieldEntitySearch.getEntitiesForField(
            query,
            () -> {
              LOG.warn(
                  "Search fallback for team {} assets. Returning empty list.",
                  team.getFullyQualifiedName());
              return new InheritedFieldResult(new ArrayList<>(), 0);
            });
    return new ResultList<>(result.entities(), null, null, result.total());
  }

  public ResultList<EntityReference> getTeamAssetsByName(String teamName, int limit, int offset) {
    Team team = getByName(null, teamName, fieldPolicy().parse("id,fullyQualifiedName"));
    return getTeamAssets(team.getId(), limit, offset);
  }

  public Map<String, Integer> getAllTeamsWithAssetsCount() {
    if (inheritedFieldEntitySearch == null) {
      LOG.warn("Search unavailable for team asset counts");
      return new HashMap<>();
    }
    List<Team> allTeams =
        collections().all(fieldPolicy().parse("id,fullyQualifiedName"), new ListFilter(null));
    // Build team ID -> FQN mapping
    Map<String, String> teamIdToFqn = new HashMap<>();
    for (Team team : allTeams) {
      teamIdToFqn.put(team.getId().toString(), team.getFullyQualifiedName());
    }
    // Single ES aggregation query filtered by owners.type=team (excludes users)
    String queryFilter = QueryFilterBuilder.buildTeamAssetsCountFilter();
    Map<String, Integer> ownerIdCounts =
        inheritedFieldEntitySearch.getAggregatedCountsByField(
            "owners.id", queryFilter, EntityBuilderConstant.MAX_AGGREGATE_SIZE);
    // Map team IDs to FQNs
    Map<String, Integer> teamAssetCounts = new LinkedHashMap<>();
    for (Team team : allTeams) {
      teamAssetCounts.put(team.getFullyQualifiedName(), 0);
    }
    for (Map.Entry<String, Integer> entry : ownerIdCounts.entrySet()) {
      String teamFqn = teamIdToFqn.get(entry.getKey());
      if (teamFqn != null) {
        teamAssetCounts.put(teamFqn, entry.getValue());
      }
    }
    return teamAssetCounts;
  }

  @Override
  public void storeEntity(Team team, boolean update) {
    persistence().store(team, update);
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of(
        "users", "defaultRoles", "defaultPersona", "parents", "policies", "inheritedRoles");
  }

  @Override
  public void storeEntities(List<Team> entities) {
    persistence().insertMany(entities);
  }

  /**
   * Used during CSV import to clear relationships before re-establishing them.
   * Only clears relationships that ARE in the CSV and will be re-added by storeRelationships().
   * Relationships NOT in CSV (e.g., users, policies) are preserved to avoid data loss.
   */
  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Team> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Team::getId).toList();
    deleteFromMany(ids, Entity.TEAM, Relationship.HAS, Entity.ROLE);
    deleteFromMany(ids, Entity.TEAM, Relationship.HAS, Entity.PERSONA);
    deleteToMany(ids, Entity.TEAM, Relationship.PARENT_OF, Entity.TEAM);
    deleteFromMany(ids, Entity.TEAM, Relationship.PARENT_OF, Entity.TEAM);
  }

  @Override
  public void storeRelationships(Team team) {
    for (EntityReference user : listOrEmpty(team.getUsers())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  team.getId(), user.getId(), TEAM, Entity.USER, Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    for (EntityReference defaultRole : listOrEmpty(team.getDefaultRoles())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  team.getId(), defaultRole.getId(), TEAM, Entity.ROLE, Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    for (EntityReference parent : listOrEmpty(team.getParents())) {
      if (parent.getId().equals(organization.getId())) {
        // When the parent is the default parent - organization, don't store the
        continue;
        // relationship
      }
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  parent.getId(), team.getId(), TEAM, TEAM, Relationship.PARENT_OF),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    for (EntityReference child : listOrEmpty(team.getChildren())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  team.getId(), child.getId(), TEAM, TEAM, Relationship.PARENT_OF),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    for (EntityReference policy : listOrEmpty(team.getPolicies())) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  team.getId(), policy.getId(), TEAM, POLICY, Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    if (team.getDefaultPersona() != null) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  team.getId(),
                  team.getDefaultPersona().getId(),
                  TEAM,
                  Entity.PERSONA,
                  Relationship.HAS),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
  }

  @Override
  public void setInheritedFields(Team team, Fields fields) {
    // If user does not have domain, then inherit it from parent Team
    // TODO have default team when a user belongs to multiple teams
    if (fields.contains(FIELD_DOMAINS)) {
      Set<EntityReference> combinedParent = new TreeSet<>(EntityUtil.compareEntityReferenceById);
      List<EntityReference> parents =
          !fields.contains(PARENTS_FIELD) ? getParents(team) : team.getParents();
      if (!nullOrEmpty(parents)) {
        for (EntityReference parentRef : parents) {
          Team parentTeam = Entity.getEntity(TEAM, parentRef.getId(), "domains", ALL);
          combinedParent.addAll(parentTeam.getDomains());
        }
      }
      team.setDomains(
          EntityUtil.mergedInheritedEntityRefs(
              team.getDomains(), combinedParent.stream().toList()));
    }
  }

  @Override
  public EntityUpdater<Team> getUpdater(
      Team original, Team updated, EntityOperation operation, ChangeSource changeSource) {
    return new TeamUpdater(original, updated, operation).mutation();
  }

  @Override
  public void preDelete(Team entity, String deletedBy) {
    if (entity.getId().equals(organization.getId())) {
      throw new IllegalArgumentException(DELETE_ORGANIZATION);
    }
  }

  @Override
  public void postDelete(Team entity, boolean hardDelete) {
    EntityPolicy.super.postDelete(entity, hardDelete);
    PolicyConditionUpdater.updateAllPolicyConditions(
        condition ->
            PolicyConditionUpdater.removeFromCondition(
                condition, entity.getName(), PolicyConditionUpdater.TEAM_FUNCTIONS));
  }

  @Override
  public void entitySpecificCleanup(Team team) {
    // When a team is deleted, if the children team don't have another parent, set Organization as
    // the parent
    for (EntityReference child : listOrEmpty(team.getChildren())) {
      Team childTeam = lookup().byId(child.getId(), NON_DELETED);
      getParents(childTeam);
      if (childTeam.getParents().size() == 1) {
        // Only parent is being deleted, move the parent to Organization
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    organization.getId(), childTeam.getId(), TEAM, TEAM, Relationship.PARENT_OF),
                EntityRelationshipWriter.Value.EMPTY,
                false);
        LOG.info("Moving parent of team {} to organization", childTeam.getId());
      }
    }
  }

  @Override
  public String exportToCsv(String parentTeam, String user, boolean recursive) throws IOException {
    return exportToCsv(parentTeam, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String parentTeam, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    // Validate team name
    Team team = getByName(null, parentTeam, Fields.EMPTY_FIELDS);
    return new TeamCsv(team, user).exportCsv(callback);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    return importFromCsv(name, csv, dryRun, user, recursive, (CsvImportProgressCallback) null);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    // Validate team name
    Team team = getByName(null, name, Fields.EMPTY_FIELDS);
    TeamCsv teamCsv = new TeamCsv(team, user);
    return teamCsv.importCsv(csv, dryRun, callback);
  }

  private List<EntityReference> getInheritedRoles(Team team) {
    return SubjectContext.getRolesForTeams(getParentsForInheritedRoles(team));
  }

  public void entitySpecificCleanup(User entityInterface) {
    TaskAssigneeCleanup.removeAssignee(entityInterface.getId(), TEAM);
  }

  private TeamHierarchy getTeamHierarchy(Team team) {
    return new TeamHierarchy()
        .withId(team.getId())
        .withTeamType(team.getTeamType())
        .withName(team.getName())
        .withDisplayName(team.getDisplayName())
        .withHref(team.getHref())
        .withFullyQualifiedName(team.getFullyQualifiedName())
        .withIsJoinable(team.getIsJoinable())
        .withChildren(new ArrayList<>())
        .withDescription(team.getDescription());
  }

  public List<TeamHierarchy> listHierarchy(ListFilter filter, int limit, Boolean isJoinable) {
    Fields fields = fieldPolicy().parse(PARENTS_FIELD);
    ResultList<Team> resultList =
        pages().after(new EntityPageReader.Projection(null, fields, filter), limit, null);
    List<Team> allTeams = resultList.getData();
    List<Team> joinableTeams =
        allTeams.stream()
            .filter(Boolean.TRUE.equals(isJoinable) ? Team::getIsJoinable : t -> true)
            .filter(t -> !t.getName().equals(ORGANIZATION_NAME))
            .toList();
    Map<UUID, TeamHierarchy> hierarchyMap = new HashMap<>();
    for (Team team : joinableTeams) {
      if (!hierarchyMap.containsKey(team.getId())) {
        hierarchyMap.put(team.getId(), getTeamHierarchy(team));
      }
    }
    for (Team team : joinableTeams) {
      if (team.getParents() == null) {
        continue;
      }
      for (EntityReference parentRef : team.getParents()) {
        if (parentRef.getName().equals(ORGANIZATION_NAME)) {
          continue;
        }
        Team parentTeam =
            allTeams.stream()
                .filter(t -> t.getId().equals(parentRef.getId()))
                .findFirst()
                .orElse(null);
        if (parentTeam == null) {
          continue;
        }
        hierarchyMap.putIfAbsent(parentTeam.getId(), getTeamHierarchy(parentTeam));
        TeamHierarchy parentNode = hierarchyMap.get(parentTeam.getId());
        TeamHierarchy childNode = hierarchyMap.get(team.getId());
        if (parentNode.getChildren() == null) {
          parentNode.setChildren(new ArrayList<>());
        }
        boolean childAlreadyAdded =
            parentNode.getChildren().stream()
                .anyMatch(child -> child.getId().equals(childNode.getId()));
        if (!childAlreadyAdded) {
          parentNode.getChildren().add(childNode);
        }
      }
    }
    Set<UUID> childIds = new HashSet<>();
    for (TeamHierarchy node : hierarchyMap.values()) {
      if (node.getChildren() != null) {
        for (TeamHierarchy child : node.getChildren()) {
          childIds.add(child.getId());
        }
      }
    }
    return hierarchyMap.values().stream()
        .filter(node -> !childIds.contains(node.getId()))
        .sorted(Comparator.comparing(TeamHierarchy::getName))
        .collect(Collectors.toList());
  }

  private List<EntityReference> getUsers(Team team) {
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(
                team.getId(), TEAM, Relationship.HAS, Entity.USER),
            Include.NON_DELETED);
  }

  private Integer getUserCount(UUID teamId) {
    Map<UUID, List<UUID>> childrenMap = new HashMap<>();
    Set<UUID> subtreeTeamIds = discoverSubtreeTeams(List.of(teamId), childrenMap);
    Map<UUID, Set<UUID>> directUsers = batchFetchDirectUsers(subtreeTeamIds);
    return countSubtreeUsers(teamId, childrenMap, directUsers);
  }

  private List<EntityReference> getOwns(Team team) {
    // Compile entities owned by the team
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(team.getId(), TEAM, Relationship.OWNS, null),
            Include.NON_DELETED);
  }

  private List<EntityReference> getDefaultRoles(Team team) {
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(
                team.getId(), TEAM, Relationship.HAS, Entity.ROLE),
            Include.NON_DELETED);
  }

  private EntityReference getDefaultPersona(Team team) {
    List<EntityReference> personas =
        relationships()
            .to(
                new EntityRelationshipReader.Selection(
                    team.getId(), TEAM, Relationship.HAS, Entity.PERSONA),
                Include.NON_DELETED);
    return personas.isEmpty() ? null : personas.get(0);
  }

  private List<EntityReference> getParents(Team team) {
    List<EntityReference> parents =
        relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    team.getId(), TEAM, Relationship.PARENT_OF, TEAM),
                Include.NON_DELETED);
    if (organization != null
        && listOrEmpty(parents).isEmpty()
        && !team.getId().equals(organization.getId())) {
      return new ArrayList<>(List.of(organization.getEntityReference()));
    }
    return parents;
  }

  private List<EntityReference> getParentsForInheritedRoles(Team team) {
    // filter out any deleted teams
    List<EntityReference> parents =
        relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    team.getId(), TEAM, Relationship.PARENT_OF, TEAM),
                Include.NON_DELETED)
            .stream()
            .filter(e -> !e.getDeleted())
            .collect(Collectors.toList());
    if (organization != null
        && listOrEmpty(parents).isEmpty()
        && !team.getId().equals(organization.getId())) {
      return new ArrayList<>(List.of(organization.getEntityReference()));
    }
    return parents;
  }

  @Override
  public List<EntityReference> getChildren(Team team) {
    return getChildren(team.getId(), NON_DELETED);
  }

  @Override
  public List<EntityReference> getChildren(Team team, Include include) {
    return getChildren(team.getId(), include);
  }

  /**
   * Parentless teams are the organization's children. {@code listTeamsUnderOrganization} returns raw
   * ids without applying the {@code deleted} flag, so resolve them through the requested {@link
   * Include} to stay consistent with the PARENT_OF path, which gets that filtering from {@code
   * findTo}.
   */
  private List<EntityReference> getOrganizationChildren(UUID organizationId, Include include) {
    List<UUID> childIds =
        EntityUtil.strToIds(
            context().dependencies().daos().teamDAO().listTeamsUnderOrganization(organizationId));
    return nullOrEmpty(childIds)
        ? List.of()
        : Entity.getEntityReferencesByIds(TEAM, childIds, include);
  }

  private List<UUID> getLiveOrganizationChildIds(UUID organizationId) {
    return EntityUtil.strToIds(
        context().dependencies().daos().teamDAO().listLiveTeamsUnderOrganization(organizationId));
  }

  public List<EntityReference> getChildren(UUID teamId) {
    return getChildren(teamId, NON_DELETED);
  }

  public List<EntityReference> getChildren(UUID teamId, Include include) {
    if (teamId.equals(organization.getId())) {
      // For organization all the parentless teams are children
      return getOrganizationChildren(teamId, include);
    }
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(teamId, TEAM, Relationship.PARENT_OF, TEAM),
            include);
  }

  private Integer getChildrenCount(Team team) {
    if (!nullOrEmpty(team.getChildren())) {
      return team.getChildren().size();
    }
    List<EntityReference> children = getChildren(team);
    return children != null ? children.size() : 0;
  }

  private List<EntityReference> getPolicies(Team team) {
    return relationships()
        .to(
            new EntityRelationshipReader.Selection(team.getId(), TEAM, Relationship.HAS, POLICY),
            Include.NON_DELETED);
  }

  private void populateChildren(Team team) {
    List<EntityReference> childrenRefs = team.getChildren();
    if (childrenRefs == null) {
      return;
    }
    List<Team> children = getTeams(childrenRefs);
    switch (team.getTeamType()) {
      case GROUP:
        if (!children.isEmpty()) {
          throw new IllegalArgumentException(CREATE_GROUP);
        }
        break;
      case DEPARTMENT:
        validateChildren(team, children, DEPARTMENT, GROUP);
        break;
      case DIVISION:
        validateChildren(team, children, DEPARTMENT, DIVISION, GROUP);
        break;
      case BUSINESS_UNIT, ORGANIZATION:
        validateChildren(team, children, BUSINESS_UNIT, DIVISION, DEPARTMENT, GROUP);
        break;
    }
    populateTeamRefs(childrenRefs, children);
  }

  private void populateParents(Team team) {
    // Teams created without parents has the top Organization as the default parent
    List<EntityReference> parentRefs = listOrEmpty(team.getParents());
    // When there are no parents for a team, add organization as the default parent
    if (parentRefs.isEmpty() && !team.getName().equals(ORGANIZATION_NAME)) {
      team.setParents(new ArrayList<>());
      team.getParents().add(organization.getEntityReference());
      return;
    }
    List<Team> parents = getTeams(parentRefs);
    switch (team.getTeamType()) {
      case GROUP, DEPARTMENT:
        validateParents(team, parents, DEPARTMENT, DIVISION, BUSINESS_UNIT, ORGANIZATION);
        break;
      case DIVISION:
        validateSingleParent(team, parentRefs);
        validateParents(team, parents, DIVISION, BUSINESS_UNIT, ORGANIZATION);
        break;
      case BUSINESS_UNIT:
        validateSingleParent(team, parentRefs);
        validateParents(team, parents, BUSINESS_UNIT, ORGANIZATION);
        break;
      case ORGANIZATION:
        if (!parentRefs.isEmpty()) {
          throw new IllegalArgumentException(UNEXPECTED_PARENT);
        }
    }
    populateTeamRefs(parentRefs, parents);
  }

  // Populate team refs from team entity list
  private void populateTeamRefs(List<EntityReference> teamRefs, List<Team> teams) {
    for (int i = 0; i < teams.size(); i++) {
      EntityUtil.copy(teams.get(i).getEntityReference(), teamRefs.get(i));
    }
  }

  private List<Team> getTeams(List<EntityReference> teamRefs) {
    List<Team> teams = new ArrayList<>();
    for (EntityReference teamRef : teamRefs) {
      try {
        Team team = lookup().byId(teamRef.getId(), NON_DELETED);
        teams.add(team);
      } catch (EntityNotFoundException ex) {
        // Team was soft-deleted
        LOG.debug("Failed to populate team since it might be soft deleted.", ex);
        // Ensure that the team was soft-deleted otherwise throw an exception
        lookup().byId(teamRef.getId(), Include.DELETED);
      }
    }
    return teams;
  }

  // Validate if the team can have given type of parents
  private void validateParents(Team team, List<Team> relatedTeams, TeamType... allowedTeamTypes) {
    List<TeamType> allowed = Arrays.asList(allowedTeamTypes);
    for (Team relatedTeam : relatedTeams) {
      if (!allowed.contains(relatedTeam.getTeamType())) {
        throw new IllegalArgumentException(
            invalidParent(relatedTeam, team.getName(), team.getTeamType()));
      }
    }
  }

  // Validate if the team can given type of children
  private void validateChildren(Team team, List<Team> children, TeamType... allowedTeamTypes) {
    List<TeamType> allowed = Arrays.asList(allowedTeamTypes);
    for (Team child : children) {
      if (!allowed.contains(child.getTeamType())) {
        throw new IllegalArgumentException(invalidChild(team.getName(), team.getTeamType(), child));
      }
    }
  }

  private void validateDefaultPersona(Team team) {
    if (team.getDefaultPersona() == null) {
      return;
    }
    if (!GROUP.equals(team.getTeamType())) {
      throw new IllegalArgumentException(
          "Default persona can only be set for teams of type Group.");
    }
    Entity.getEntityReferenceById(Entity.PERSONA, team.getDefaultPersona().getId(), NON_DELETED);
  }

  private void validateDirectUserAddition(Team team, List<EntityReference> users) {
    if (!GROUP.equals(team.getTeamType()) && !nullOrEmpty(users)) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidTeamDirectUserAssignment(team.getTeamType()));
    }
  }

  private void validateSingleParent(Team team, List<EntityReference> parentRefs) {
    if (listOrEmpty(parentRefs).size() != 1) {
      throw new IllegalArgumentException(invalidParentCount(1, team.getTeamType()));
    }
  }

  @Transaction
  public RestUtil.PutResponse<Team> updateTeamUsers(
      String updatedBy, UUID teamId, List<EntityReference> updatedUsers) {
    if (updatedUsers == null) {
      throw new IllegalArgumentException("Users list cannot be null");
    }
    Team team = Entity.getEntity(Entity.TEAM, teamId, USERS_FIELD, Include.NON_DELETED);
    List<EntityReference> currentUsers = listOrEmpty(team.getUsers());
    Set<UUID> oldUserIds =
        currentUsers.stream().map(EntityReference::getId).collect(Collectors.toSet());
    Set<UUID> updatedUserIds =
        updatedUsers.stream().map(EntityReference::getId).collect(Collectors.toSet());
    List<EntityReference> addedUsers =
        updatedUsers.stream()
            .filter(user -> !oldUserIds.contains(user.getId()))
            .collect(Collectors.toList());
    validateDirectUserAddition(team, addedUsers);
    if (!nullOrEmpty(addedUsers)) {
      referenceValidation().users(addedUsers);
    }
    List<UUID> addedUserIds =
        updatedUsers.stream()
            .map(EntityReference::getId)
            .filter(id -> !oldUserIds.contains(id))
            .collect(Collectors.toList());
    List<UUID> removedUserIds =
        currentUsers.stream()
            .map(EntityReference::getId)
            .filter(id -> !updatedUserIds.contains(id))
            .collect(Collectors.toList());
    Optional.of(addedUserIds)
        .filter(ids -> !ids.isEmpty())
        .ifPresent(
            ids ->
                relationshipWrites()
                    .addMany(
                        new EntityRelationshipWriter.Batch(
                            teamId, ids, Entity.TEAM, Entity.USER, Relationship.HAS)));
    Optional.of(removedUserIds)
        .filter(ids -> !ids.isEmpty())
        .ifPresent(
            ids ->
                relationshipWrites()
                    .removeMany(
                        new EntityRelationshipWriter.Batch(
                            teamId, ids, Entity.TEAM, Entity.USER, Relationship.HAS)));
    setFieldsInternal(team, new EntityUtil.Fields(context().allowedFields(), USERS_FIELD));
    ChangeDescription change = new ChangeDescription().withPreviousVersion(team.getVersion());
    fieldAdded(change, USERS_FIELD, updatedUsers);
    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntity(team)
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(context().schema().entityType())
            .withEntityId(teamId)
            .withEntityFullyQualifiedName(team.getFullyQualifiedName())
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(team.getVersion())
            .withPreviousVersion(change.getPreviousVersion());
    team.setChangeDescription(change);
    return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public final RestUtil.PutResponse<Team> deleteTeamUser(
      String updatedBy, UUID teamId, UUID userId) {
    Team team = lookup().byId(teamId, NON_DELETED);
    // Validate user
    EntityReference user = Entity.getEntityReferenceById(Entity.USER, userId, NON_DELETED);
    relationshipWrites()
        .delete(
            new EntityRelationshipWriter.Edge(
                teamId, userId, Entity.TEAM, Entity.USER, Relationship.HAS));
    ChangeDescription change = new ChangeDescription().withPreviousVersion(team.getVersion());
    fieldDeleted(change, USERS_FIELD, List.of(user));
    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntity(team)
            .withChangeDescription(change)
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityFullyQualifiedName(team.getFullyQualifiedName())
            .withEntityType(context().schema().entityType())
            .withEntityId(teamId)
            .withUserName(updatedBy)
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(team.getVersion())
            .withPreviousVersion(change.getPreviousVersion());
    return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public void initOrganization() {
    organization = lookup().byNameOrNull(ORGANIZATION_NAME, ALL);
    if (organization == null) {
      LOG.debug("Organization {} is not initialized", ORGANIZATION_NAME);
      // Teams
      try {
        EntityReference organizationPolicy =
            Entity.getEntityReferenceByName(POLICY, "OrganizationPolicy", Include.ALL);
        EntityReference dataConsumerRole =
            Entity.getEntityReferenceByName(ROLE, "DataConsumer", Include.ALL);
        Team team =
            new Team()
                .withId(UUID.randomUUID())
                .withName(ORGANIZATION_NAME)
                .withDisplayName(ORGANIZATION_NAME)
                .withDescription("Organization under which all the other team hierarchy is created")
                .withTeamType(ORGANIZATION)
                .withUpdatedBy(ADMIN_USER_NAME)
                .withUpdatedAt(System.currentTimeMillis())
                .withPolicies(new ArrayList<>(List.of(organizationPolicy)))
                .withDefaultRoles(new ArrayList<>(List.of(dataConsumerRole)));
        organization = creates().create(null, team, new EntityCommandActor(null, null));
        LOG.info(
            "Organization {}:{} is successfully initialized",
            ORGANIZATION_NAME,
            organization.getId());
      } catch (Exception e) {
        LOG.error("Failed to initialize organization", e);
        throw e;
      }
    } else {
      LOG.info("Organization is already initialized");
    }
  }

  public static class TeamCsv extends EntityCsv<Team> {

    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(TEAM, false);

    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();

    private final Team team;

    TeamCsv(Team team, String updatedBy) {
      super(Entity.TEAM, HEADERS, updatedBy);
      this.team = team;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      // Field 1, 2, 3, 4, 7 - name, displayName, description, teamType, isJoinable
      Team team =
          new Team()
              .withName(csvRecord.get(0))
              .withDisplayName(csvRecord.get(1))
              .withDescription(csvRecord.get(2))
              .withTeamType(TeamType.fromValue(csvRecord.get(3)))
              .withOwners(getOwners(printer, csvRecord, 5))
              .withIsJoinable(getBoolean(printer, csvRecord, 6))
              .withDefaultRoles(getEntityReferences(printer, csvRecord, 7, ROLE))
              .withPolicies(getEntityReferences(printer, csvRecord, 8, POLICY));
      // Pre-track the entity so getParents can find it for circular dependency detection
      if (processRecord) {
        dryRunCreatedEntities.put(team.getName(), team);
      }
      // Field 5 - parent teams
      getParents(printer, csvRecord, team);
      if (processRecord) {
        createEntity(printer, csvRecord, team);
      }
    }

    @Override
    protected void createEntity(CSVPrinter resultsPrinter, CSVRecord csvRecord, Team entity)
        throws IOException {
      // Validate hierarchy now that entity is pre-tracked
      if (processRecord) {
        TeamRepository repository = (TeamRepository) Entity.getEntityRepository(TEAM);
        try {
          repository.validateForDryRun(entity, dryRunCreatedEntities);
        } catch (Exception ex) {
          importFailure(resultsPrinter, ex.getMessage(), csvRecord);
          processRecord = false;
          // Remove from dryRunCreatedEntities since validation failed
          dryRunCreatedEntities.remove(entity.getName());
          // Don't proceed with creation
          return;
        }
      }
      // Now call the parent method for normal processing
      super.createEntity(resultsPrinter, csvRecord, entity);
    }

    @Override
    protected void addRecord(CsvFile csvFile, Team entity) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(recordList, entity.getTeamType().value());
      addEntityReferences(recordList, entity.getParents());
      addOwners(recordList, entity.getOwners());
      addField(recordList, entity.getIsJoinable());
      addEntityReferences(recordList, entity.getDefaultRoles());
      addEntityReferences(recordList, entity.getPolicies());
      addRecord(csvFile, recordList);
    }

    private void getParents(CSVPrinter printer, CSVRecord csvRecord, Team importedTeam)
        throws IOException {
      if (!processRecord) {
        return;
      }
      List<EntityReference> parentRefs = getEntityReferences(printer, csvRecord, 4, Entity.TEAM);
      // Validate team being created is under the hierarchy of the team for which CSV is being
      // imported to
      for (EntityReference parentRef : listOrEmpty(parentRefs)) {
        if (parentRef.getName().equals(team.getName())) {
          // Parent is same as the team to which CSV is being imported, then it is in the
          continue;
          // same hierarchy
        }
        if (dryRunCreatedEntities.get(parentRef.getName()) != null) {
          // Parent is being created by CSV import
          continue;
        }
        // Else the parent should already exist
        if (!SubjectContext.isInTeam(team.getName(), parentRef)) {
          importFailure(
              printer,
              invalidTeam(4, team.getName(), importedTeam.getName(), parentRef.getName()),
              csvRecord);
          processRecord = false;
        }
      }
      importedTeam.setParents(parentRefs);
    }

    public static String invalidTeam(
        int field, String team, String importedTeam, String parentName) {
      String error =
          String.format(
              "Parent %s of imported team %s is not under %s team hierarchy",
              parentName, importedTeam, team);
      return String.format(
          "#%s: Field %d error - %s", CsvErrorType.INVALID_FIELD, field + 1, error);
    }

    private List<Team> listTeams(
        TeamRepository repository, String parentTeam, List<Team> teams, Fields fields) {
      // Export the entire hierarchy of teams
      final ListFilter filter =
          new ListFilter(Include.NON_DELETED).addQueryParam("parentTeam", parentTeam);
      List<Team> list = repository.collections().all(fields, filter);
      if (nullOrEmpty(list)) {
        return teams;
      }
      teams.addAll(list);
      for (Team teamEntry : list) {
        listTeams(repository, teamEntry.getFullyQualifiedName(), teams, fields);
      }
      return teams;
    }

    public String exportCsv() throws IOException {
      return exportCsv((CsvExportProgressCallback) null);
    }

    public String exportCsv(CsvExportProgressCallback callback) throws IOException {
      TeamRepository repository = (TeamRepository) Entity.getEntityRepository(TEAM);
      final Fields fields = repository.fieldPolicy().parse("owners,defaultRoles,parents,policies");
      return exportCsv(
          listTeams(repository, team.getFullyQualifiedName(), new ArrayList<>(), fields), callback);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class TeamUpdater implements EntitySpecificMutation<Team> {

    public TeamUpdater(Team original, Team updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Team> entityUpdate, boolean consolidatingChanges) {
      if (entityUpdate.getOriginal().getTeamType() != entityUpdate.getUpdated().getTeamType()) {
        // A team of type 'Group' cannot be updated
        if (GROUP.equals(entityUpdate.getOriginal().getTeamType())) {
          throw new IllegalArgumentException(INVALID_GROUP_TEAM_UPDATE);
        }
        // A team containing children cannot be updated to Group
        if (!entityUpdate.getOriginal().getChildren().isEmpty()
            && GROUP.equals(entityUpdate.getUpdated().getTeamType())) {
          throw new IllegalArgumentException(INVALID_GROUP_TEAM_CHILDREN_UPDATE);
        }
      }
      entityUpdate.compareAndUpdate(
          "profile",
          () ->
              entityUpdate.recordChange(
                  "profile",
                  entityUpdate.getOriginal().getProfile(),
                  entityUpdate.getUpdated().getProfile(),
                  true));
      entityUpdate.compareAndUpdate(
          "isJoinable",
          () ->
              entityUpdate.recordChange(
                  "isJoinable",
                  entityUpdate.getOriginal().getIsJoinable(),
                  entityUpdate.getUpdated().getIsJoinable()));
      entityUpdate.compareAndUpdate(
          "teamType",
          () ->
              entityUpdate.recordChange(
                  "teamType",
                  entityUpdate.getOriginal().getTeamType(),
                  entityUpdate.getUpdated().getTeamType()));
      // If the team is empty then email should be null, not be empty
      if (CommonUtil.nullOrEmpty(entityUpdate.getUpdated().getEmail())) {
        entityUpdate.getUpdated().setEmail(null);
      }
      entityUpdate.compareAndUpdate(
          "email",
          () ->
              entityUpdate.recordChange(
                  "email",
                  entityUpdate.getOriginal().getEmail(),
                  entityUpdate.getUpdated().getEmail()));
      AtomicBoolean hierarchyOrPolicyChanged = new AtomicBoolean(false);
      entityUpdate.compareAndUpdate(
          "users",
          () -> {
            updateUsers(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            hierarchyOrPolicyChanged.set(true);
          });
      entityUpdate.compareAndUpdate(
          "defaultRoles",
          () -> {
            updateDefaultRoles(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            hierarchyOrPolicyChanged.set(true);
          });
      entityUpdate.compareAndUpdate(
          "defaultPersona",
          () -> {
            updateDefaultPersona(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            hierarchyOrPolicyChanged.set(true);
          });
      entityUpdate.compareAndUpdate(
          "parents",
          () -> {
            updateParents(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            hierarchyOrPolicyChanged.set(true);
          });
      entityUpdate.compareAndUpdate(
          "children",
          () -> {
            updateChildren(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            hierarchyOrPolicyChanged.set(true);
          });
      entityUpdate.compareAndUpdate(
          "policies",
          () -> {
            updatePolicies(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            hierarchyOrPolicyChanged.set(true);
          });
      if (hierarchyOrPolicyChanged.get()) {
        SubjectCache.invalidateAll();
      }
    }

    private void updateUsers(Team origTeam, Team updatedTeam) {
      List<EntityReference> origUsers = listOrEmpty(origTeam.getUsers());
      List<EntityReference> updatedUsers = listOrEmpty(updatedTeam.getUsers());
      if (!EntityUtil.entityReferenceListMatch.test(origUsers, updatedUsers)) {
        updateChangedUsers(origTeam, updatedTeam, origUsers, updatedUsers);
      }
    }

    private void updateChangedUsers(
        Team origTeam,
        Team updatedTeam,
        List<EntityReference> origUsers,
        List<EntityReference> updatedUsers) {
      Set<UUID> origUserIds =
          origUsers.stream().map(EntityReference::getId).collect(Collectors.toSet());
      List<EntityReference> addedUsers =
          updatedUsers.stream().filter(user -> !origUserIds.contains(user.getId())).toList();
      validateDirectUserAddition(updatedTeam, addedUsers);
      entityUpdate.updateToRelationships(
          new EntityRelationshipUpdates.Target(
              "users", origTeam.getId(), TEAM, Entity.USER, Relationship.HAS),
          new EntityRelationshipUpdates.References(origUsers, updatedUsers),
          false);
      updatedTeam.setUserCount(updatedUsers.size());
    }

    private void updateDefaultPersona(Team origTeam, Team updatedTeam) {
      EntityReference origPersona = origTeam.getDefaultPersona();
      EntityReference updatedPersona = updatedTeam.getDefaultPersona();
      if (updatedPersona != null && !GROUP.equals(updatedTeam.getTeamType())) {
        throw new IllegalArgumentException(
            "Default persona can only be set for teams of type Group.");
      }
      UUID origId = origPersona != null ? origPersona.getId() : null;
      UUID updatedId = updatedPersona != null ? updatedPersona.getId() : null;
      if (Objects.equals(origId, updatedId)) {
        return;
      }
      if (origPersona != null) {
        relationshipWrites()
            .deleteOutgoing(
                new EntityRelationshipWriter.Selection(
                    origTeam.getId(), TEAM, Relationship.HAS, Entity.PERSONA));
      }
      if (updatedPersona != null) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    origTeam.getId(),
                    updatedPersona.getId(),
                    TEAM,
                    Entity.PERSONA,
                    Relationship.HAS),
                EntityRelationshipWriter.Value.EMPTY,
                false);
      }
      entityUpdate.recordChange(DEFAULT_PERSONA, origPersona, updatedPersona, true);
    }

    private void updateDefaultRoles(Team origTeam, Team updatedTeam) {
      List<EntityReference> origDefaultRoles = listOrEmpty(origTeam.getDefaultRoles());
      List<EntityReference> updatedDefaultRoles = listOrEmpty(updatedTeam.getDefaultRoles());
      entityUpdate.updateToRelationships(
          new EntityRelationshipUpdates.Target(
              DEFAULT_ROLES, origTeam.getId(), TEAM, Entity.ROLE, Relationship.HAS),
          new EntityRelationshipUpdates.References(origDefaultRoles, updatedDefaultRoles),
          false);
    }

    @Override
    public void domains(EntityUpdater<Team> entityUpdate) {
      if (entityUpdate.getOperation().isPut()
          && !nullOrEmpty(entityUpdate.getOriginal().getDomains())
          && entityUpdate.updatedByBot()) {
        // Revert change to non-empty domain if it is being updated by a bot
        // This is to prevent bots from overwriting the domain. Domain need to be
        // updated with a PATCH request
        entityUpdate.getUpdated().setDomains(entityUpdate.getOriginal().getDomains());
        return;
      }
      List<EntityReference> origDomains =
          EntityUtil.populateEntityReferences(
              listOrEmptyMutable(entityUpdate.getOriginal().getDomains()));
      List<EntityReference> updatedDomains =
          EntityUtil.populateEntityReferences(
              listOrEmptyMutable(entityUpdate.getUpdated().getDomains()));
      // Remove Domains for the user
      relationshipWrites()
          .deleteIncoming(
              new EntityRelationshipWriter.Selection(
                  entityUpdate.getOriginal().getId(), TEAM, Relationship.HAS, Entity.DOMAIN));
      for (EntityReference domain : updatedDomains) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    domain.getId(),
                    entityUpdate.getOriginal().getId(),
                    Entity.DOMAIN,
                    TEAM,
                    Relationship.HAS),
                EntityRelationshipWriter.Value.EMPTY,
                false);
      }
      origDomains.sort(EntityUtil.compareEntityReference);
      updatedDomains.sort(EntityUtil.compareEntityReference);
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      entityUpdate.recordListChange(
          FIELD_DOMAINS,
          origDomains,
          updatedDomains,
          added,
          deleted,
          EntityUtil.entityReferenceMatch);
    }

    private void updateParents(Team original, Team updated) {
      List<EntityReference> origParents = listOrEmpty(original.getParents());
      List<EntityReference> updatedParents = listOrEmpty(updated.getParents());
      entityUpdate.updateFromRelationships(
          new EntityRelationshipUpdates.Target(
              PARENTS_FIELD, original.getId(), TEAM, TEAM, Relationship.PARENT_OF),
          new EntityRelationshipUpdates.References(origParents, updatedParents));
    }

    private void updateChildren(Team original, Team updated) {
      List<EntityReference> origParents = listOrEmpty(original.getChildren());
      List<EntityReference> updatedParents = listOrEmpty(updated.getChildren());
      entityUpdate.updateToRelationships(
          new EntityRelationshipUpdates.Target(
              "children", original.getId(), TEAM, TEAM, Relationship.PARENT_OF),
          new EntityRelationshipUpdates.References(origParents, updatedParents),
          false);
    }

    private void updatePolicies(Team original, Team updated) {
      List<EntityReference> origPolicies = listOrEmpty(original.getPolicies());
      List<EntityReference> updatedPolicies = listOrEmpty(updated.getPolicies());
      entityUpdate.updateToRelationships(
          new EntityRelationshipUpdates.Target(
              "policies", original.getId(), TEAM, POLICY, Relationship.HAS),
          new EntityRelationshipUpdates.References(origPolicies, updatedPolicies),
          false);
    }

    private final EntityUpdater<Team> entityUpdate;

    public EntityUpdater<Team> mutation() {
      return entityUpdate;
    }
  }

  /**
   * Validate hierarchy to avoid circular references A -> B -> A.
   */
  private void validateHierarchy(Team team) {
    // Both directions of the PARENT_OF edge are validated - parent -> team from team.getParents()
    // and team -> child from team.getChildren() - so a cycle cannot be introduced from either side
    // through create, PUT, PATCH, bulk create, or CSV import (all run through prepare()).
    for (EntityReference parent : listOrEmpty(team.getParents())) {
      validateNoCircularReference(parent.getId(), parent.getName(), team.getId(), team.getName());
    }
    validateChildEdges(team);
  }

  /**
   * Reject any child that is already an ancestor of the team, which would close a loop. The team's
   * ancestor names are collected once (not per child) by walking up from both its proposed
   * (in-request) parents and its persisted parents. Seeding from the proposed parents also catches a
   * cycle formed within a single create request - e.g. parents=[P], children=[C] where C is an
   * ancestor of P - which the per-edge walks miss because the new team has no id yet. The team's own
   * name is included to reject a team being its own child.
   */
  private void validateChildEdges(Team team) {
    List<EntityReference> children = listOrEmpty(team.getChildren());
    if (!children.isEmpty()) {
      Set<String> ancestorNames = collectAncestorNames(team);
      for (EntityReference child : children) {
        if (ancestorNames.contains(child.getName())) {
          throw new IllegalArgumentException(
              String.format(
                  "Circular reference detected: Team '%s' cannot be a child of '%s' because it is already an ancestor in the hierarchy.",
                  child.getName(), team.getName()));
        }
      }
    }
  }

  private Set<String> collectAncestorNames(Team team) {
    Set<String> ancestorNames = new HashSet<>();
    ancestorNames.add(team.getName());
    Deque<EntityReference> stack = new ArrayDeque<>(listOrEmpty(team.getParents()));
    if (team.getId() != null) {
      stack.addAll(
          relationships()
              .from(
                  new EntityRelationshipReader.Selection(
                      team.getId(), TEAM, Relationship.PARENT_OF, TEAM),
                  Include.NON_DELETED));
    }
    Set<UUID> expanded = new HashSet<>();
    while (!stack.isEmpty()) {
      EntityReference current = stack.pop();
      ancestorNames.add(current.getName());
      if (current.getId() != null && expanded.add(current.getId())) {
        stack.addAll(
            relationships()
                .from(
                    new EntityRelationshipReader.Selection(
                        current.getId(), TEAM, Relationship.PARENT_OF, TEAM),
                    Include.NON_DELETED));
      }
    }
    return ancestorNames;
  }

  /**
   * Validate that adding the {@code parent --PARENT_OF--> child} edge does not create a cycle. A
   * cycle exists when the two teams are the same, or when the child is already an ancestor of the
   * parent (found by walking up the parent chain from the parent).
   */
  private void validateNoCircularReference(
      UUID parentId, String parentName, UUID childId, String childName) {
    if (isSameTeam(parentId, parentName, childId, childName)) {
      throw new IllegalArgumentException(
          String.format("Invalid hierarchy: Team '%s' cannot be its own parent", childName));
    }
    Set<UUID> visited = new HashSet<>();
    visited.add(parentId);
    visited.add(childId);
    checkCircularReference(parentId, visited, childName);
  }

  private boolean isSameTeam(UUID parentId, String parentName, UUID childId, String childName) {
    return (parentId != null && parentId.equals(childId))
        || (parentName != null && parentName.equals(childName));
  }

  private void checkCircularReference(
      UUID currentTeamId, Set<UUID> visited, String originalTeamName) {
    // Traverse up from the current parent to see if we reach the original team
    // Team relationship direction: Parent --(PARENT_OF)--> Child(currentTeamId).
    // We want the Parent.
    // findFrom(toId=currentTeamId) gets the Parents.
    List<EntityReference> parents =
        relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    currentTeamId, TEAM, Relationship.PARENT_OF, TEAM),
                Include.NON_DELETED);
    for (EntityReference parent : listOrEmpty(parents)) {
      // Check Name match to handle potential ID mismatch during import (New Object vs DB Object)
      if (parent.getName().equals(originalTeamName) || visited.contains(parent.getId())) {
        throw new IllegalArgumentException(
            String.format(
                "Circular reference detected in hierarchy for Team '%s'. The parent relationship creates a loop.",
                originalTeamName));
      }
      visited.add(parent.getId());
      checkCircularReference(parent.getId(), visited, originalTeamName);
    }
  }

  /**
   * Validate hierarchy during Dry Run. This is critical for CSV imports where entities might not
   * exist in DB yet but are in the batch.
   */
  public void validateForDryRun(Team team, Map<String, Team> dryRunCreatedEntities) {
    if (listOrEmpty(team.getParents()).isEmpty()) {
      return;
    }
    for (EntityReference parentRef : team.getParents()) {
      // 1. Self Check by Name (since ID might be new)
      if (parentRef.getName().equals(team.getName())) {
        throw new IllegalArgumentException(
            String.format("Invalid hierarchy: Team '%s' cannot be its own parent", team.getName()));
      }
      // 2. Check in DryRun Entities (In-Memory check for the CSV batch)
      checkCircularReferenceInDryRun(
          team.getName(),
          parentRef.getName(),
          dryRunCreatedEntities,
          new HashSet<>(Set.of(team.getName())));
    }
  }

  private void checkCircularReferenceInDryRun(
      String originalTeamName,
      String currentParentName,
      Map<String, Team> dryRunMap,
      Set<String> visited) {
    if (visited.contains(currentParentName)) {
      throw new IllegalArgumentException(
          String.format(
              "Circular reference detected in CSV: Team '%s' participates in a loop involving '%s'.",
              originalTeamName, currentParentName));
    }
    visited.add(currentParentName);
    // If the parent is being created in this batch, using strict FQN or lenient name match
    Team parentTeamInCsv = findInDryRunMap(currentParentName, dryRunMap);
    if (parentTeamInCsv != null) {
      for (EntityReference grandParent : listOrEmpty(parentTeamInCsv.getParents())) {
        checkCircularReferenceInDryRun(
            originalTeamName, grandParent.getName(), dryRunMap, new HashSet<>(visited));
      }
    } else {
      Team dbTeam = lookup().byNameOrNull(currentParentName, Include.NON_DELETED);
      if (dbTeam != null) {
        for (EntityReference parent : listOrEmpty(dbTeam.getParents())) {
          checkCircularReferenceInDryRun(
              originalTeamName, parent.getName(), dryRunMap, new HashSet<>(visited));
        }
      }
    }
  }

  private Team findInDryRunMap(String name, Map<String, Team> dryRunMap) {
    // 1. Try direct FQN match
    if (dryRunMap.containsKey(name)) {
      return dryRunMap.get(name);
    }
    // 2. Lenient match: check if any key ends with the name (handling "Org.Team" vs "Team")
    // or if the entity name matches
    for (Team t : dryRunMap.values()) {
      if (t.getName().equals(name)) {
        return t;
      }
    }
    return null;
  }

  private final EntityPolicyContext<Team> entityContext;

  @Override
  public final EntityPolicyContext<Team> context() {
    return entityContext;
  }
}

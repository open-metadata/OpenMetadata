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

package org.openmetadata.service.resources.teams;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.BUSINESS_UNIT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DEPARTMENT;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.DIVISION;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.GROUP;
import static org.openmetadata.schema.api.teams.CreateTeam.TeamType.ORGANIZATION;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_GROUP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_ORGANIZATION;
import static org.openmetadata.service.exception.CatalogExceptionMessage.DELETE_ORGANIZATION;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParent;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidParentCount;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.validateEntityReferences;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.csv.EntityCsvTest;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.TeamHierarchy;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ImageList;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.TeamRepository.TeamCsv;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.locations.LocationResourceTest;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.resources.teams.TeamResource.TeamHierarchyList;
import org.openmetadata.service.resources.teams.TeamResource.TeamList;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ParallelizeTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
@ParallelizeTest
public class TeamResourceTest extends EntityResourceTest<Team, CreateTeam> {
  final Profile PROFILE = new Profile().withImages(new ImageList().withImage(URI.create("http://image.com")));

  public TeamResourceTest() {
    super(TEAM, Team.class, TeamList.class, "teams", TeamResource.FIELDS);
  }

  public void setupTeams(TestInfo test) throws HttpResponseException {
    CreateTeam createTeam = createRequest(test, 1).withTeamType(DEPARTMENT);
    TEAM1 = createEntity(createTeam, ADMIN_AUTH_HEADERS);

    createTeam = createRequest(test, 11).withParents(List.of(TEAM1.getId()));
    TEAM11 = createEntity(createTeam, ADMIN_AUTH_HEADERS);

    // TEAM2 has Team only policy - users from other teams can't access its assets
    createTeam =
        createRequest(test, 2)
            .withTeamType(DEPARTMENT)
            .withPolicies(List.of(TEAM_ONLY_POLICY.getId()))
            .withDefaultRoles(List.of(DATA_STEWARD_ROLE.getId()));
    TEAM2 = createEntity(createTeam, ADMIN_AUTH_HEADERS);

    createTeam = createRequest(test, 21).withParents(List.of(TEAM2.getId()));
    TEAM21 = createEntity(createTeam, ADMIN_AUTH_HEADERS);

    TEAM11_REF = TEAM11.getEntityReference();
    ORG_TEAM = getEntityByName(ORGANIZATION_NAME, "", ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_organization() throws HttpResponseException {
    // Ensure getting organization from team hierarchy is successful
    Team org = getEntityByName(ORGANIZATION_NAME, "", ADMIN_AUTH_HEADERS);

    // Organization can't be deleted
    assertResponse(() -> deleteEntity(org.getId(), ADMIN_AUTH_HEADERS), BAD_REQUEST, DELETE_ORGANIZATION);

    // Organization can't be created
    CreateTeam create = createRequest("org_test").withTeamType(ORGANIZATION);
    assertResponse(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, CREATE_ORGANIZATION);

    // Organization by default has DataConsumer Role. Ensure Role lists organization as one of the teams
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role role = roleResourceTest.getEntityByName("DataConsumer", "teams", ADMIN_AUTH_HEADERS);
    assertEntityReferencesContain(role.getTeams(), org.getEntityReference());
  }

  @Test
  void post_validTeams_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateTeam create = createRequest(test, 1);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 2).withDisplayName("displayName");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 3).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 4).withProfile(PROFILE);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 5).withDisplayName("displayName").withDescription("description").withProfile(PROFILE);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_teamWithUsersAndDefaultRoles_200_OK(TestInfo test) throws IOException {
    // Add team to user relationships while creating a team
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), TEST_AUTH_HEADERS);
    User user2 = userResourceTest.createEntity(userResourceTest.createRequest(test, 2), TEST_AUTH_HEADERS);
    List<UUID> users = Arrays.asList(user1.getId(), user2.getId());

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role role1 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Role role2 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 2), ADMIN_AUTH_HEADERS);
    List<UUID> roles = Arrays.asList(role1.getId(), role2.getId());

    CreateTeam create =
        createRequest(test)
            .withDisplayName("displayName")
            .withDescription("description")
            .withProfile(PROFILE)
            .withUsers(users)
            .withDefaultRoles(roles);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Ensure that the user entity has relationship to the team
    user1 = userResourceTest.getEntity(user1.getId(), "teams", TEST_AUTH_HEADERS);
    assertEquals(team.getId(), user1.getTeams().get(0).getId());
    user2 = userResourceTest.getEntity(user2.getId(), "teams", TEST_AUTH_HEADERS);
    assertEquals(team.getId(), user2.getTeams().get(0).getId());
  }

  /**
   * @see EntityResourceTest put_addDeleteFollower_200 for tests related getting team with entities owned by the team
   */
  @Test
  void delete_validTeam_200_OK(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = userResourceTest.createEntity(userResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<UUID> users = Collections.singletonList(user1.getId());

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role role1 = roleResourceTest.createEntity(roleResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    List<UUID> roles = Collections.singletonList(role1.getId());

    CreateTeam create = createRequest(test).withUsers(users).withDefaultRoles(roles);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Team with users and defaultRoles can be deleted
    // Team -- has --> User relationships are deleted
    // Team -- has --> Role relationships are deleted
    deleteAndCheckEntity(team, ADMIN_AUTH_HEADERS);

    // Ensure that the user does not have relationship to this team and is moved to the default team - Organization.
    User user = userResourceTest.getEntity(user1.getId(), "teams", ADMIN_AUTH_HEADERS);
    assertEquals(1, user.getTeams().size());
    assertEquals(ORG_TEAM.getId(), user.getTeams().get(0).getId());

    // Ensure that the role is not deleted
    Role role = roleResourceTest.getEntity(role1.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(role);
  }

  @Test
  void delete_recursive_validTeam_200_OK() throws IOException {
    //
    // Create hierarchy of business unit, division, and department under organization:
    // Organization -- has children --> [bu1], bu1 has children --> [div2], div2 has children [dep3]
    Team bu1 = createWithParents("bu1", BUSINESS_UNIT, ORG_TEAM.getEntityReference());
    Team div2 = createWithParents("div2", DIVISION, bu1.getEntityReference());
    Team dep3 = createWithParents("dep3", DEPARTMENT, div2.getEntityReference());

    // Ensure parent has all the newly created children
    ORG_TEAM = getEntity(ORG_TEAM.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(new ArrayList<>(List.of(bu1.getEntityReference())), ORG_TEAM.getChildren());

    // Ensure parent has all the newly created children
    bu1 = getEntity(bu1.getId(), "children", ADMIN_AUTH_HEADERS);
    assertEntityReferences(new ArrayList<>(List.of(div2.getEntityReference())), bu1.getChildren());

    div2 = getEntity(div2.getId(), "children", ADMIN_AUTH_HEADERS);
    assertEntityReferences(new ArrayList<>(List.of(dep3.getEntityReference())), div2.getChildren());

    // Recursive delete parent Team bu1
    deleteAndCheckEntity(bu1, true, false, ADMIN_AUTH_HEADERS);

    Double expectedVersion = EntityUtil.nextVersion(div2.getVersion());

    // Validate that the entity version is updated after soft delete
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", Include.DELETED.value());

    div2 = getEntity(div2.getId(), queryParams, "", ADMIN_AUTH_HEADERS);
    assertTrue(div2.getDeleted());
    assertEquals(expectedVersion, div2.getVersion());

    expectedVersion = EntityUtil.nextVersion(dep3.getVersion());
    dep3 = getEntity(dep3.getId(), queryParams, "", ADMIN_AUTH_HEADERS);
    assertTrue(dep3.getDeleted());
    assertEquals(expectedVersion, dep3.getVersion());

    // hard delete all the teams
    UUID div2Id = div2.getId();
    UUID dep3Id = dep3.getId();
    bu1 = getEntity(bu1.getId(), queryParams, "", ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(bu1, true, true, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> getEntity(div2Id, queryParams, "", ADMIN_AUTH_HEADERS), NOT_FOUND, entityNotFound(TEAM, div2Id));
    assertResponse(
        () -> getEntity(dep3Id, queryParams, "", ADMIN_AUTH_HEADERS), NOT_FOUND, entityNotFound(TEAM, dep3Id));
  }

  @Test
  void patch_teamAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create team without any attributes
    Team team = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should be disallowed
    String originalJson = JsonUtils.pojoToJson(team);
    team.setDisplayName("newDisplayName");
    assertResponse(
        () -> patchEntity(team.getId(), originalJson, team, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_DISPLAY_NAME)));
  }

  @Test
  void patch_teamType_as_user_with_UpdateTeam_permission(TestInfo test) throws IOException {
    Team team = createEntity(createRequest(test).withTeamType(BUSINESS_UNIT), ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(team);
    team.setTeamType(DIVISION);

    ChangeDescription change = getChangeDescription(team.getVersion());
    fieldUpdated(change, "teamType", BUSINESS_UNIT.toString(), DIVISION.toString());
    patchEntityAndCheck(team, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    team = getEntity(team.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(DIVISION, team.getTeamType());
  }

  @Test
  void patch_teamUsers_as_user_with_UpdateTeam_permission(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    List<EntityReference> userRefs = new ArrayList<>();
    for (int i = 0; i < 7; i++) {
      User user = userResourceTest.createEntity(userResourceTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      userRefs.add(user.getEntityReference());
    }

    Team team = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(team);
    team.setUsers(userRefs);

    // Ensure user without UpdateTeam permission cannot add users to a team.
    String randomUserName = userRefs.get(0).getName();
    assertResponse(
        () ->
            patchEntity(
                team.getId(), originalJson, team, SecurityUtil.authHeaders(randomUserName + "@open-metadata.org")),
        FORBIDDEN,
        permissionNotAllowed(randomUserName, List.of(MetadataOperation.EDIT_USERS)));

    // Ensure user with UpdateTeam permission can add users to a team.
    User teamManagerUser = createTeamManager(test);
    ChangeDescription change = getChangeDescription(team.getVersion());
    fieldAdded(change, "users", userRefs);
    patchEntityAndCheck(
        team,
        originalJson,
        SecurityUtil.authHeaders(teamManagerUser.getName() + "@open-metadata.org"),
        MINOR_UPDATE,
        change);
  }

  @Test
  void post_hierarchicalTeamsWithParents() throws HttpResponseException {
    // Ensure teams created without any parent has Organization as the parent
    Team team = getEntity(TEAM1.getId(), "parents", ADMIN_AUTH_HEADERS);
    assertParents(team, List.of(ORG_TEAM.getEntityReference()));

    //
    // Create hierarchy of business unit, division, and department under organization:
    // Organization -- has children --> [ bu1, div2, dep3]
    Team bu1 = createWithParents("bu1", BUSINESS_UNIT, ORG_TEAM.getEntityReference());
    Team div2 = createWithParents("div2", DIVISION, ORG_TEAM.getEntityReference());
    Team dep3 = createWithParents("dep3", DEPARTMENT, ORG_TEAM.getEntityReference());

    // Ensure parent has all the newly created children
    ORG_TEAM = getEntity(ORG_TEAM.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(List.of(bu1.getEntityReference(), div2.getEntityReference(), dep3.getEntityReference())),
        ORG_TEAM.getChildren());

    //
    // Create hierarchy of business unit, division, and department under business unit
    // bu1 -- has children --> [ bu11, div12, dep13]
    Team bu11 = createWithParents("bu11", BUSINESS_UNIT, bu1.getEntityReference());
    Team div12 = createWithParents("div12", DIVISION, bu1.getEntityReference());
    Team dep13 = createWithParents("dep13", DEPARTMENT, false, bu1.getEntityReference());

    // Ensure parent has all the newly created children
    bu1 = getEntity(bu1.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(List.of(bu11.getEntityReference(), div12.getEntityReference(), dep13.getEntityReference())),
        bu1.getChildren());

    // Ensure team hierarchy lists all the child teams
    List<TeamHierarchy> hierarchyList = getTeamsHierarchy(false, ADMIN_AUTH_HEADERS);
    // search for bu1 in the list
    UUID bu1Id = bu1.getId();
    UUID bu11Id = bu11.getId();
    UUID div12Id = div12.getId();
    UUID dep13Id = dep13.getId();
    TeamHierarchy bu1Hierarchy = hierarchyList.stream().filter(t -> t.getId().equals(bu1Id)).findAny().orElse(null);
    assertNotNull(bu1Hierarchy);
    assertEquals(3, bu1Hierarchy.getChildren().size());
    List<TeamHierarchy> children = bu1Hierarchy.getChildren();
    assertTrue(children.stream().anyMatch(t -> t.getId().equals(bu11Id)));
    assertTrue(children.stream().anyMatch(t -> t.getId().equals(div12Id)));
    assertTrue(children.stream().anyMatch(t -> t.getId().equals(dep13Id)));

    Team div121 = createWithParents("div121", DIVISION, div12.getEntityReference());
    // Ensure team hierarchy lists only the joinable child teams
    hierarchyList = getTeamsHierarchy(true, ADMIN_AUTH_HEADERS);
    bu1Hierarchy = hierarchyList.stream().filter(t -> t.getId().equals(bu1Id)).findAny().orElse(null);
    assertNotNull(bu1Hierarchy);
    assertEquals(2, bu1Hierarchy.getChildren().size());
    children = bu1Hierarchy.getChildren();
    assertTrue(children.stream().anyMatch(t -> t.getId().equals(bu11Id)));
    assertTrue(children.stream().anyMatch(t -> t.getId().equals(div12Id)));
    TeamHierarchy div12Hierarchy = children.stream().filter(t -> t.getId().equals(div12Id)).findAny().orElse(null);
    assertNotNull(div12Hierarchy);
    assertEquals(1, div12Hierarchy.getChildren().size());
    assertEquals(div121.getId(), div12Hierarchy.getChildren().get(0).getId());

    //
    // Create hierarchy of division, and department under division
    // div2 -- has children --> [ div21, dep22]
    Team div21 = createWithParents("div21", DIVISION, div2.getEntityReference());
    Team dep22 = createWithParents("dep22", DEPARTMENT, div2.getEntityReference());

    // Ensure parent has all the newly created children
    div2 = getEntity(div2.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(List.of(div21.getEntityReference(), dep22.getEntityReference())), div2.getChildren());

    //
    // Create hierarchy of department under department
    // dep3 -- has children --> [ dep31]
    Team dep31 = createWithParents("dep31", DEPARTMENT, dep3.getEntityReference());

    // Ensure parent has all the newly created children
    dep3 = getEntity(dep3.getId(), "children,parents", ADMIN_AUTH_HEADERS);
    assertEntityReferences(new ArrayList<>(List.of(dep31.getEntityReference())), dep3.getChildren());

    //
    // Test incorrect hierarchy is not allowed and results in failure
    // Department can't be the parent of Division
    assertResponse(
        () -> createWithParents("divInvalid", DIVISION, dep22.getEntityReference()),
        BAD_REQUEST,
        invalidParent(dep22, "divInvalid", DIVISION));

    // Division or Department can't be the parent of Business Unit
    assertResponse(
        () -> createWithParents("buInvalid", BUSINESS_UNIT, dep22.getEntityReference()),
        BAD_REQUEST,
        invalidParent(dep22, "buInvalid", BUSINESS_UNIT));
    assertResponse(
        () -> createWithParents("buInvalid", BUSINESS_UNIT, div21.getEntityReference()),
        BAD_REQUEST,
        invalidParent(div21, "buInvalid", BUSINESS_UNIT));

    // Business Unit can have only one parent
    EntityReference bu11Ref = bu11.getEntityReference();
    assertResponse(
        () -> createWithParents("buInvalid", BUSINESS_UNIT, bu11Ref, ORG_TEAM.getEntityReference()),
        BAD_REQUEST,
        invalidParentCount(1, BUSINESS_UNIT));

    // Division can have only one parent
    assertResponse(
        () -> createWithParents("divInvalid", DIVISION, dep22.getEntityReference(), ORG_TEAM.getEntityReference()),
        BAD_REQUEST,
        invalidParentCount(1, DIVISION));

    // Department can have more than one parent
    createWithParents(
        "dep", DEPARTMENT, div12.getEntityReference(), div21.getEntityReference(), ORG_TEAM.getEntityReference());

    //
    // Deletion tests to ensure no dangling parent/children relationship
    // Delete bu1 and ensure Organization does not have it a child and bu11, div12, dep13 don't change Org to parent
    deleteEntity(bu1.getId(), true, true, ADMIN_AUTH_HEADERS);
    ORG_TEAM = getEntity(ORG_TEAM.getId(), "children", ADMIN_AUTH_HEADERS);
    assertEntityReferencesDoesNotContain(ORG_TEAM.getChildren(), bu1.getEntityReference());
  }

  @Test
  void post_hierarchicalTeamsWithChildren() throws HttpResponseException {
    Team bu11 = createEntity(createRequest("t11").withTeamType(BUSINESS_UNIT), ADMIN_AUTH_HEADERS);
    Team div12 = createEntity(createRequest("t12").withTeamType(DIVISION), ADMIN_AUTH_HEADERS);
    Team dep13 = createEntity(createRequest("t13").withTeamType(DEPARTMENT), ADMIN_AUTH_HEADERS);

    // Create a parent team with children t11, t12, t13 and verify parent and child relationships
    Team t1 =
        createWithChildren(
            "t1", BUSINESS_UNIT, bu11.getEntityReference(), div12.getEntityReference(), dep13.getEntityReference());
    assertEntityReferencesContain(t1.getParents(), ORG_TEAM.getEntityReference());

    // assert children count for the newly created bu team
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parentTeam", "t1");
    queryParams.put("fields", "childrenCount,userCount");
    ResultList<Team> teams = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, teams.getData().size());
    assertEquals(3, teams.getPaging().getTotal());
    assertEquals(0, teams.getData().get(0).getChildrenCount());
    assertEquals(0, teams.getData().get(0).getUserCount());

    queryParams.put("parentTeam", ORGANIZATION_NAME);
    teams = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertTrue(teams.getData().stream().anyMatch(t -> t.getName().equals("t1")));
    t1 = teams.getData().stream().filter(t -> t.getName().equals("t1")).collect(Collectors.toList()).get(0);
    assertEquals(3, t1.getChildrenCount());
    assertEquals(0, t1.getUserCount());

    //
    // Creating a parent with invalid children type is not allowed
    // Department can't have Business unit as a child
    assertResponse(
        () -> createWithChildren("invalidDepartment", DEPARTMENT, bu11.getEntityReference()),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidChild("invalidDepartment", DEPARTMENT, bu11));
    // Department can't have Division as a child
    assertResponse(
        () -> createWithChildren("invalidDepartment", DEPARTMENT, div12.getEntityReference()),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidChild("invalidDepartment", DEPARTMENT, div12));
    // Division can't have BU as a child
    assertResponse(
        () -> createWithChildren("invalidDivision", DIVISION, bu11.getEntityReference()),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidChild("invalidDivision", DIVISION, bu11));
    // Group can't have other teams as children. Only users are allowed under the team
    assertResponse(
        () -> createWithChildren("invalidGroup", GROUP, bu11.getEntityReference()), BAD_REQUEST, CREATE_GROUP);
  }

  @Test
  void put_patch_hierarchicalTeams() throws IOException {
    // Create hierarchy of business unit, division, and department under organization:
    // Organization -- has children --> [ bu1, bu2]
    Team bu1 = createWithParents("put1", BUSINESS_UNIT, ORG_TEAM.getEntityReference());
    Team bu2 = createWithParents("put2", BUSINESS_UNIT, ORG_TEAM.getEntityReference());

    // Change bu2 parent from Organization to bu1 using PUT operation
    CreateTeam create = createRequest("put2").withTeamType(BUSINESS_UNIT).withParents(List.of(bu1.getId()));
    ChangeDescription change1 = getChangeDescription(bu2.getVersion());
    fieldDeleted(change1, "parents", List.of(ORG_TEAM.getEntityReference()));
    fieldAdded(change1, "parents", List.of(bu1.getEntityReference()));
    bu2 = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change1);

    // Remove bu2 parent. Default parent organization replaces it
    create = createRequest("put2").withTeamType(BUSINESS_UNIT).withParents(null);
    ChangeDescription change2 = getChangeDescription(bu2.getVersion());
    fieldDeleted(change2, "parents", List.of(bu1.getEntityReference()));
    fieldAdded(change2, "parents", List.of(ORG_TEAM.getEntityReference()));
    bu2 = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change2);

    // Change bu2 parent from Organization to bu1 using PATCH operation
    String json = JsonUtils.pojoToJson(bu2);
    change1.setPreviousVersion(bu2.getVersion());
    bu2.setParents(List.of(bu1.getEntityReference()));
    bu2 = patchEntityAndCheck(bu2, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change1);

    json = JsonUtils.pojoToJson(bu2);
    change2.setPreviousVersion(bu2.getVersion());
    bu2.setParents(List.of(ORG_TEAM.getEntityReference()));
    patchEntityAndCheck(bu2, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change2);
  }

  @Test
  void patch_isJoinable_200(TestInfo test) throws IOException {
    CreateTeam create =
        createRequest(getEntityName(test), "description", "displayName", null)
            .withTeamType(DEPARTMENT)
            .withProfile(PROFILE)
            .withIsJoinable(false);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Team child = createWithParents("child", GROUP, team.getEntityReference());
    // Delete child and then patch the parent
    deleteAndCheckEntity(child, ADMIN_AUTH_HEADERS);

    // patch the team with isJoinable set to true
    String json = JsonUtils.pojoToJson(team);
    team.setIsJoinable(true);
    ChangeDescription change = getChangeDescription(team.getVersion());
    fieldUpdated(change, "isJoinable", false, true);
    team = patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // set isJoinable to false and check
    json = JsonUtils.pojoToJson(team);
    team.setIsJoinable(false);
    change = getChangeDescription(team.getVersion());
    fieldUpdated(change, "isJoinable", true, false);
    patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void patch_deleteUserAndDefaultRolesFromTeam_200(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    final int totalUsers = 20;
    ArrayList<UUID> users = new ArrayList<>();
    for (int i = 0; i < totalUsers; i++) {
      User user = userResourceTest.createEntity(userResourceTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      users.add(user.getId());
    }

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    roleResourceTest.createRoles(test, 5, 0);
    List<Role> roles = roleResourceTest.listEntities(Map.of(), ADMIN_AUTH_HEADERS).getData();
    List<UUID> rolesIds = roles.stream().map(Role::getId).collect(Collectors.toList());

    CreateTeam create =
        createRequest(getEntityName(test), "description", "displayName", null)
            .withProfile(PROFILE)
            .withUsers(users)
            .withDefaultRoles(rolesIds);
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Remove a user from the team using patch request
    String json = JsonUtils.pojoToJson(team);
    int removeUserIndex = new Random().nextInt(totalUsers);
    EntityReference deletedUser = team.getUsers().get(removeUserIndex);
    team.getUsers().remove(removeUserIndex);
    ChangeDescription change = getChangeDescription(team.getVersion());
    fieldDeleted(change, "users", CommonUtil.listOf(deletedUser));
    team = patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Remove a default role from the team using patch request
    json = JsonUtils.pojoToJson(team);
    int removeDefaultRoleIndex = new Random().nextInt(roles.size());
    EntityReference deletedRole = team.getDefaultRoles().get(removeDefaultRoleIndex);
    team.getDefaultRoles().remove(removeDefaultRoleIndex);
    change = getChangeDescription(team.getVersion());
    fieldDeleted(change, "defaultRoles", CommonUtil.listOf(deletedRole));
    patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void post_teamWithPolicies(TestInfo test) throws IOException {
    CreateTeam create = createRequest(getEntityName(test)).withPolicies(List.of(POLICY1.getId(), POLICY2.getId()));
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_teamWithPolicies(TestInfo test) throws IOException {
    CreateTeam create = createRequest(getEntityName(test));
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add policies to the team
    create =
        createRequest(getEntityName(test))
            .withPolicies(List.of(POLICY1.getId(), POLICY2.getId()))
            .withName(team.getName());
    ChangeDescription change = getChangeDescription(team.getVersion());
    fieldAdded(change, "policies", List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference()));
    team = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove policies from the team
    create = createRequest(getEntityName(test)).withName(team.getName());
    change = getChangeDescription(team.getVersion());
    fieldDeleted(change, "policies", List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference()));
    updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_teamWithPolicies(TestInfo test) throws IOException {
    CreateTeam create = createRequest(getEntityName(test));
    Team team = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add policies to the team
    String json = JsonUtils.pojoToJson(team);
    team.withPolicies(List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference()));
    ChangeDescription change = getChangeDescription(team.getVersion());
    fieldAdded(change, "policies", List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference()));
    team = patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove policies from the team
    json = JsonUtils.pojoToJson(team);
    team.withPolicies(null);
    change = getChangeDescription(team.getVersion());
    fieldDeleted(change, "policies", List.of(POLICY1.getEntityReference(), POLICY2.getEntityReference()));
    patchEntityAndCheck(team, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void testInheritedRole() throws HttpResponseException {
    // team11 inherits DATA_CONSUMER_ROLE from Organization
    Team team11 = getEntity(TEAM11.getId(), "defaultRoles", ADMIN_AUTH_HEADERS);
    assertEntityReferences(List.of(DATA_CONSUMER_ROLE_REF), team11.getInheritedRoles());

    // TEAM21 inherits DATA_CONSUMER_ROLE from Organization and DATA_STEWARD_ROLE from Team2
    Team team21 = getEntity(TEAM21.getId(), "defaultRoles", ADMIN_AUTH_HEADERS);
    assertEntityReferences(List.of(DATA_CONSUMER_ROLE_REF, DATA_STEWARD_ROLE_REF), team21.getInheritedRoles());
  }

  @Test
  void testCsvDocumentation() throws HttpResponseException {
    assertEquals(TeamCsv.DOCUMENTATION, getCsvDocumentation());
  }

  @Test
  void testImportInvalidCsv() throws IOException {
    Team team = createEntity(createRequest("invalidCsvTest"), ADMIN_AUTH_HEADERS);

    // Invalid policy
    String resultsHeader = recordToString(EntityCsv.getResultHeaders(TeamCsv.HEADERS));
    String record = getRecord(1, GROUP, team.getName(), "", false, "", "invalidPolicy");
    String csv = createCsv(TeamCsv.HEADERS, listOf(record), null);
    CsvImportResult result = importCsv(team.getName(), csv, false);
    assertSummary(result, CsvImportResult.Status.FAILURE, 2, 1, 1);
    String[] expectedRows = {resultsHeader, getFailedRecord(record, EntityCsv.entityNotFound(8, "invalidPolicy"))};
    assertRows(result, expectedRows);

    // Invalid roles
    record = getRecord(1, GROUP, team.getName(), "", false, "invalidRole", "");
    csv = createCsv(TeamCsv.HEADERS, listOf(record), null);
    result = importCsv(team.getName(), csv, false);
    assertSummary(result, CsvImportResult.Status.FAILURE, 2, 1, 1);
    expectedRows = new String[] {resultsHeader, getFailedRecord(record, EntityCsv.entityNotFound(7, "invalidRole"))};
    assertRows(result, expectedRows);

    // Invalid owner
    record = getRecord(1, GROUP, team.getName(), "invalidOwner", false, "", "");
    csv = createCsv(TeamCsv.HEADERS, listOf(record), null);
    result = importCsv(team.getName(), csv, false);
    assertSummary(result, CsvImportResult.Status.FAILURE, 2, 1, 1);
    expectedRows = new String[] {resultsHeader, getFailedRecord(record, EntityCsv.entityNotFound(5, "invalidOwner"))};
    assertRows(result, expectedRows);

    // Invalid parent team
    record = getRecord(1, GROUP, "invalidParent", "", false, "", "");
    csv = createCsv(TeamCsv.HEADERS, listOf(record), null);
    result = importCsv(team.getName(), csv, false);
    assertSummary(result, CsvImportResult.Status.FAILURE, 2, 1, 1);
    expectedRows = new String[] {resultsHeader, getFailedRecord(record, EntityCsv.entityNotFound(4, "invalidParent"))};
    assertRows(result, expectedRows);

    // Parent team not in the hierarchy - TEAM21 is not under the team to which import is being done
    record = getRecord(1, GROUP, TEAM21.getName(), "", false, "", "");
    csv = createCsv(TeamCsv.HEADERS, listOf(record), null);
    result = importCsv(team.getName(), csv, false);
    assertSummary(result, CsvImportResult.Status.FAILURE, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, TeamCsv.invalidTeam(4, team.getName(), "x1", TEAM21.getName()))
        };
    assertRows(result, expectedRows);
  }

  @Test
  void testTeamImportExport() throws IOException {
    String teamName = "teamImportExport";
    Team team = createEntity(createRequest(teamName).withTeamType(DEPARTMENT), ADMIN_AUTH_HEADERS);

    // Create team hierarchy - team has children x1, x2. x1 has x11. x11 has x111
    String record1 = getRecord(1, DEPARTMENT, teamName, USER1, true, listOf(DATA_CONSUMER_ROLE), listOf(POLICY1));
    String record2 = getRecord(2, GROUP, teamName, USER2, false, listOf(DATA_STEWARD_ROLE), listOf(POLICY1, POLICY2));
    String record11 =
        getRecord(11, DEPARTMENT, "x1", USER2, false, listOf(DATA_STEWARD_ROLE), listOf(POLICY1, POLICY2));
    String record111 = getRecord(111, GROUP, "x11", USER1, false, listOf(DATA_STEWARD_ROLE), listOf(POLICY1, POLICY2));
    List<String> createRecords = listOf(record1, record2, record11, record111);

    // Update teams x1, x2 description
    record1 = record1.replace("description1", "new-description1");
    record2 = record2.replace("description2", "new-description2");
    List<String> updateRecords = listOf(record1, record2);

    // Add new team x3 to existing rows
    String record3 = getRecord(3, GROUP, team.getName(), null, true, null, (List<Policy>) null);
    List<String> newRecords = listOf(record3);
    testImportExport(team.getName(), TeamCsv.HEADERS, createRecords, updateRecords, newRecords);

    // Import to team111 a user with parent team1 - since team1 is not under team111 hierarchy, import should fail
    String record4 = getRecord(3, GROUP, "x1", null, true, null, (List<Policy>) null);
    String csv = EntityCsvTest.createCsv(TeamCsv.HEADERS, listOf(record4), null);
    CsvImportResult result = importCsv("x111", csv, false);
    String error = TeamCsv.invalidTeam(4, "x111", "x3", "x1");
    assertTrue(result.getImportResultsCsv().contains(error));
  }

  private static void validateTeam(
      Team team,
      String expectedDescription,
      String expectedDisplayName,
      Profile expectedProfile,
      List<EntityReference> expectedUsers,
      List<EntityReference> expectedDefaultRoles,
      String expectedUpdatedBy) {
    assertListNotNull(team.getId(), team.getHref());
    assertEquals(expectedDescription, team.getDescription());
    assertEquals(expectedUpdatedBy, team.getUpdatedBy());
    assertEquals(expectedDisplayName, team.getDisplayName());
    assertEquals(expectedProfile, team.getProfile());
    TestUtils.assertEntityReferences(expectedUsers, team.getUsers());
    TestUtils.assertEntityReferences(expectedDefaultRoles, team.getDefaultRoles());
    validateEntityReferences(team.getOwns());
  }

  @Override
  public Team validateGetWithDifferentFields(Team expectedTeam, boolean byName) throws HttpResponseException {
    if (expectedTeam.getUsers() == null) {
      UserResourceTest userResourceTest = new UserResourceTest();
      CreateUser create = userResourceTest.createRequest("user", "", "", null).withTeams(List.of(expectedTeam.getId()));
      userResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    }

    String updatedBy = getPrincipalName(ADMIN_AUTH_HEADERS);
    String fields = "";
    Team getTeam =
        byName
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), null, fields, ADMIN_AUTH_HEADERS);
    validateTeam(getTeam, expectedTeam.getDescription(), expectedTeam.getDisplayName(), null, null, null, updatedBy);
    assertNull(getTeam.getOwns());

    fields = "users,owns,profile,defaultRoles,owner";
    getTeam =
        byName
            ? getEntityByName(expectedTeam.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(expectedTeam.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(getTeam.getProfile());
    validateEntityReferences(getTeam.getOwns());
    validateEntityReferences(getTeam.getUsers(), true);
    validateEntityReferences(getTeam.getDefaultRoles());
    return getTeam;
  }

  @Override
  public CreateTeam createRequest(String name) {
    return new CreateTeam().withName(name).withProfile(PROFILE).withTeamType(GROUP);
  }

  @Override
  public Team beforeDeletion(TestInfo test, Team team) throws HttpResponseException {
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    locationResourceTest.createEntity(
        locationResourceTest.createRequest(test).withOwner(team.getEntityReference()), ADMIN_AUTH_HEADERS);
    return team;
  }

  @Override
  public void validateCreatedEntity(Team team, CreateTeam createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getProfile(), team.getProfile());
    TestUtils.validateEntityReferences(team.getOwns());

    List<EntityReference> expectedUsers = new ArrayList<>();
    for (UUID userId : listOrEmpty(createRequest.getUsers())) {
      expectedUsers.add(new EntityReference().withId(userId).withType(Entity.USER));
    }
    expectedUsers = expectedUsers.isEmpty() ? null : expectedUsers;
    TestUtils.assertEntityReferences(expectedUsers, team.getUsers());
    TestUtils.assertEntityReferenceIds(createRequest.getDefaultRoles(), team.getDefaultRoles());
    TestUtils.assertEntityReferenceIds(createRequest.getParents(), team.getParents());
    TestUtils.assertEntityReferenceIds(createRequest.getChildren(), team.getChildren());
    TestUtils.assertEntityReferenceIds(createRequest.getPolicies(), team.getPolicies());
  }

  @Override
  protected void validateDeletedEntity(
      CreateTeam create, Team teamBeforeDeletion, Team teamAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, teamBeforeDeletion, teamAfterDeletion, authHeaders);

    List<EntityReference> expectedOwnedEntities = new ArrayList<>();
    for (EntityReference ref : listOrEmpty(teamBeforeDeletion.getOwns())) {
      expectedOwnedEntities.add(reduceEntityReference(ref));
    }
    TestUtils.assertEntityReferences(expectedOwnedEntities, teamAfterDeletion.getOwns());
  }

  @Override
  public void compareEntities(Team expected, Team updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getProfile(), updated.getProfile());
    TestUtils.validateEntityReferences(updated.getOwns());

    List<EntityReference> expectedUsers = listOrEmpty(expected.getUsers());
    List<EntityReference> actualUsers = listOrEmpty(updated.getUsers());
    TestUtils.assertEntityReferences(expectedUsers, actualUsers);

    List<EntityReference> expectedDefaultRoles = listOrEmpty(expected.getDefaultRoles());
    List<EntityReference> actualDefaultRoles = listOrEmpty(updated.getDefaultRoles());
    TestUtils.assertEntityReferences(expectedDefaultRoles, actualDefaultRoles);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (List.of("users", "defaultRoles", "parents", "children", "policies").contains(fieldName)) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferences(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private Team createWithParents(String teamName, TeamType teamType, EntityReference... parents)
      throws HttpResponseException {
    return createWithParents(teamName, teamType, true, parents);
  }

  private Team createWithParents(String teamName, TeamType teamType, Boolean isJoinable, EntityReference... parents)
      throws HttpResponseException {
    List<EntityReference> parentList = List.of(parents);
    List<UUID> parentIds = EntityUtil.toIds(parentList);
    Team team =
        createEntity(
            createRequest(teamName).withParents(parentIds).withTeamType(teamType).withIsJoinable(isJoinable),
            ADMIN_AUTH_HEADERS);
    assertParents(team, parentList);
    return team;
  }

  private Team createWithChildren(String teamName, TeamType teamType, EntityReference... children)
      throws HttpResponseException {
    List<EntityReference> childrenList = List.of(children);
    List<UUID> childIds = EntityUtil.toIds(childrenList);
    Team team = createEntity(createRequest(teamName).withChildren(childIds).withTeamType(teamType), ADMIN_AUTH_HEADERS);
    assertChildren(team, childrenList);
    return team;
  }

  private void assertParents(Team team, List<EntityReference> expectedParents) throws HttpResponseException {
    assertEquals(team.getParents().size(), expectedParents.size());
    assertEntityReferences(expectedParents, team.getParents());

    for (EntityReference expectedParent : expectedParents) {
      // Ensure parents have the given team as a child
      Team parent = getEntity(expectedParent.getId(), "children", ADMIN_AUTH_HEADERS);
      assertEntityReferencesContain(parent.getChildren(), team.getEntityReference());
    }
  }

  private void assertChildren(Team team, List<EntityReference> expectedChildren) throws HttpResponseException {
    assertEquals(team.getChildren().size(), expectedChildren.size());
    assertEntityReferences(expectedChildren, team.getChildren());

    for (EntityReference expectedChild : expectedChildren) {
      // Ensure children have the given team as a parent
      Team child = getEntity(expectedChild.getId(), "parents", ADMIN_AUTH_HEADERS);
      assertEntityReferencesContain(child.getParents(), team.getEntityReference());
    }
  }

  private User createTeamManager(TestInfo testInfo) throws HttpResponseException {
    // Create a rule that can update team
    Rule rule =
        new Rule()
            .withName("TeamManagerPolicy-UpdateTeam")
            .withEffect(Effect.ALLOW)
            .withResources(List.of(TEAM))
            .withOperations(List.of(MetadataOperation.EDIT_USERS));

    // Create a policy with the rule
    PolicyResourceTest policyResourceTest = new PolicyResourceTest();
    CreatePolicy createPolicy =
        policyResourceTest.createRequest("TeamManagerPolicy", "", "", null).withRules(List.of(rule));
    Policy policy = policyResourceTest.createEntity(createPolicy, ADMIN_AUTH_HEADERS);

    // Create TeamManager role with the policy to update team
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    CreateRole createRole =
        roleResourceTest
            .createRequest(testInfo)
            .withName("TeamManager")
            .withPolicies(List.of(policy.getEntityReference()));
    Role teamManager = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);

    // Create a user with TeamManager role.
    UserResourceTest userResourceTest = new UserResourceTest();
    return userResourceTest.createEntity(
        userResourceTest.createRequest(testInfo).withName("user.TeamManager").withRoles(List.of(teamManager.getId())),
        ADMIN_AUTH_HEADERS);
  }

  public List<Team> getTeamOfTypes(TestInfo test, TeamType... teamTypes) throws HttpResponseException {
    List<Team> teams = new ArrayList<>();
    int i = 0;
    for (TeamType type : teamTypes) {
      teams.add(createEntity(createRequest(getEntityName(test, i++)).withTeamType(type), ADMIN_AUTH_HEADERS));
    }
    return teams;
  }

  public List<TeamHierarchy> getTeamsHierarchy(Boolean isJoinable, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("teams/hierarchy");
    target = target.queryParam("isJoinable", isJoinable);
    ResultList<TeamHierarchy> result = TestUtils.get(target, TeamHierarchyList.class, authHeaders);
    return result.getData();
  }

  private String getRecord(
      int index,
      TeamType teamType,
      String parent,
      User owner,
      Boolean isJoinable,
      List<Role> defaultRoles,
      List<Policy> policies) {
    return getRecord(
        index,
        teamType,
        parent != null ? parent : "",
        owner != null ? owner.getName() : "",
        isJoinable,
        defaultRoles != null
            ? defaultRoles.stream().flatMap(r -> Stream.of(r.getName())).collect(Collectors.joining(";"))
            : "",
        policies != null
            ? policies.stream().flatMap(p -> Stream.of(p.getName())).collect(Collectors.joining(";"))
            : "");
  }

  private String getRecord(
      int index,
      TeamType teamType,
      String parent,
      String owner,
      Boolean isJoinable,
      String defaultRoles,
      String policies) {
    // CSV Header
    // "name", "displayName", "description", "teamType", "parents", "owner", "isJoinable", "defaultRoles", & "policies"
    return String.format(
        "x%s,displayName%s,description%s,%s,%s,%s,%s,%s,%s",
        index,
        index,
        index,
        teamType.value(),
        parent,
        owner,
        isJoinable == null ? "" : isJoinable,
        defaultRoles,
        policies);
  }
}

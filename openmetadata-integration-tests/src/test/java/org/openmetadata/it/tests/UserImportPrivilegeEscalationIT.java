package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.CsvJobClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Regression tests for GHSA-rqv8-phgj-hf7x: {@code PUT /v1/users/import} authorizes {@code EditAll}
 * on users, not administrator, and {@code UserCsv.createEntity} then took {@code isAdmin} and
 * {@code roles} straight from the uploaded file. Anyone who could manage a team could hand
 * themselves system administrator from a spreadsheet - the same escalation the PATCH and PUT paths
 * reject.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class UserImportPrivilegeEscalationIT {

  private static final String HEADER =
      "name*,displayName,description,email*,timezone,isAdmin,teams*,Roles";
  private static final String ORGANIZATION = "Organization";
  private static final String CLOSED_TEAM_ERROR =
      "Only an admin can add a user to, or remove a user from, a team that is not open to"
          + " everyone";

  @Test
  void test_nonAdminImport_cannotGrantIsAdmin(TestNamespace ns) {
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvadmin");
    String target = "csvvictim" + ns.shortPrefix();

    String result =
        importer.upload(row(target, target + "@test.com", "true", importer.teamName(), ""), false);

    assertTrue(
        result.contains("Only an admin can set isAdmin during user import"),
        "Import must be rejected with a field error: " + result);
    assertFalse(userExists(target), "Rejected row must not create the user");
  }

  @Test
  void test_nonAdminImport_cannotGrantRoles(TestNamespace ns) {
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvroles");
    String target = "csvroleuser" + ns.shortPrefix();

    String result =
        importer.upload(
            row(target, target + "@test.com", "false", importer.teamName(), "DataSteward"), false);

    assertTrue(
        result.contains("Only an admin can set roles during user import"),
        "Import must be rejected with a field error: " + result);
    assertFalse(userExists(target), "Rejected row must not create the user");
  }

  @Test
  void test_nonAdminImport_ofOrdinaryUser_stillWorks(TestNamespace ns) {
    // The guard must only bite on the privileged columns - importing plain users into a team is
    // the whole point of the endpoint.
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvplain");
    String target = "csvplainuser" + ns.shortPrefix();

    String result =
        importer.upload(row(target, target + "@test.com", "false", importer.teamName(), ""), false);

    assertTrue(result.contains("success"), "Ordinary import must succeed: " + result);
    User created = SdkClients.adminClient().users().getByName(target);
    assertFalse(Boolean.TRUE.equals(created.getIsAdmin()));
  }

  @Test
  void test_adminImport_canStillGrantIsAdmin(TestNamespace ns) {
    Team team = createTeam(ns, "csvadminok");
    String target = "csvadminuser" + ns.shortPrefix();

    String result =
        upload(
            SdkClients.adminClient(),
            team.getName(),
            row(target, target + "@test.com", "true", team.getName(), ""),
            false);

    assertTrue(result.contains("success"), "Admin import must succeed: " + result);
    assertTrue(
        Boolean.TRUE.equals(SdkClients.adminClient().users().getByName(target).getIsAdmin()),
        "Admin must still be able to set isAdmin via import");
  }

  @Test
  void test_nonAdminDryRun_alsoRejectsIsAdmin(TestNamespace ns) {
    // dryRun runs the same createEntity path, so it must report the same failure rather than
    // telling the caller the escalation would have worked.
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvdry");
    String target = "csvdryuser" + ns.shortPrefix();

    String result =
        importer.upload(row(target, target + "@test.com", "true", importer.teamName(), ""), true);

    assertTrue(
        result.contains("Only an admin can set isAdmin during user import"),
        "Dry run must report the same rejection: " + result);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void test_nonAdminImport_cannotAddExistingUserToClosedTeam(boolean dryRun, TestNamespace ns) {
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvjoin");
    Team open = createTeam(ns, "csvjoinopen");
    Team closed = createClosedTeam(ns, "csvjoinclosed");
    User member = createMember(ns, "csvjoiner", open);

    String result =
        importer.uploadToOrganization(
            row(member.getName(), member.getEmail(), "false", teams(open, closed), ""), dryRun);

    assertTrue(result.contains(CLOSED_TEAM_ERROR), "Row must be rejected: " + result);
    assertEquals(Set.of(open.getId()), storedTeamIds(member.getName()));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void test_nonAdminImport_cannotCreateUserInClosedTeam(boolean dryRun, TestNamespace ns) {
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvnew");
    Team closed = createClosedTeam(ns, "csvnewclosed");
    String target = "csvnewuser" + ns.shortPrefix();

    String result =
        importer.uploadToOrganization(
            row(target, target + "@test.com", "false", closed.getName(), ""), dryRun);

    assertTrue(result.contains(CLOSED_TEAM_ERROR), "Row must be rejected: " + result);
    assertFalse(userExists(target), "Rejected row must not create the user");
  }

  @Test
  void test_nonAdminImport_cannotRemoveUserFromClosedTeam(TestNamespace ns) {
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvleave");
    Team open = createTeam(ns, "csvleaveopen");
    Team closed = createClosedTeam(ns, "csvleaveclosed");
    User member = createMember(ns, "csvleaver", open, closed);

    String result =
        importer.uploadToOrganization(
            row(member.getName(), member.getEmail(), "false", open.getName(), ""), false);

    assertTrue(result.contains(CLOSED_TEAM_ERROR), "Row must be rejected: " + result);
    assertEquals(Set.of(open.getId(), closed.getId()), storedTeamIds(member.getName()));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void test_nonAdminAsyncImport_cannotPutUserInClosedTeam(boolean dryRun, TestNamespace ns) {
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvasync");
    Team open = createTeam(ns, "csvasyncopen");
    Team closed = createClosedTeam(ns, "csvasyncclosed");
    User member = createMember(ns, "csvasyncjoiner", open);
    String target = "csvasyncnew" + ns.shortPrefix();
    String csv =
        row(member.getName(), member.getEmail(), "false", teams(open, closed), "")
            + String.join(
                ",",
                target,
                target,
                "imported by test",
                target + "@test.com",
                "",
                "false",
                closed.getName(),
                "")
            + "\n";

    CsvImportResult result = importer.uploadAsyncToOrganization(csv, dryRun);

    assertEquals(2, result.getNumberOfRowsFailed(), result.getImportResultsCsv());
    assertTrue(result.getImportResultsCsv().contains(CLOSED_TEAM_ERROR));
    assertEquals(Set.of(open.getId()), storedTeamIds(member.getName()));
    assertFalse(userExists(target), "Rejected row must not create the user");
  }

  @Test
  void test_nonAdminImport_keepingClosedTeamMembershipStillWorks(TestNamespace ns) {
    Importer importer = createImporterWithEditAllOnUsers(ns, "csvkeep");
    Team open = createTeam(ns, "csvkeepopen");
    Team closed = createClosedTeam(ns, "csvkeepclosed");
    User member = createMember(ns, "csvkeeper", open, closed);
    String csv =
        HEADER
            + "\n"
            + String.join(
                ",",
                member.getName(),
                "Renamed by import",
                "imported by test",
                member.getEmail(),
                "",
                "false",
                teams(open, closed),
                "")
            + "\n";

    String result = importer.uploadToOrganization(csv, false);

    assertFalse(result.contains(CLOSED_TEAM_ERROR), "Row must import: " + result);
    User stored = SdkClients.adminClient().users().getByName(member.getName());
    assertEquals("Renamed by import", stored.getDisplayName());
    assertEquals(Set.of(open.getId(), closed.getId()), storedTeamIds(member.getName()));
  }

  @Test
  void test_adminImport_canStillAddUserToClosedTeam(TestNamespace ns) {
    Team open = createTeam(ns, "csvadminjoinopen");
    Team closed = createClosedTeam(ns, "csvadminjoinclosed");
    User member = createMember(ns, "csvadminjoiner", open);

    String result =
        upload(
            SdkClients.adminClient(),
            ORGANIZATION,
            row(member.getName(), member.getEmail(), "false", teams(open, closed), ""),
            false);

    assertTrue(result.contains("success"), "Admin import must succeed: " + result);
    assertEquals(Set.of(open.getId(), closed.getId()), storedTeamIds(member.getName()));
  }

  private static String teams(Team... teams) {
    return Arrays.stream(teams).map(Team::getName).collect(Collectors.joining(";"));
  }

  private static Set<UUID> storedTeamIds(String userName) {
    return SdkClients.adminClient().users().getByName(userName, "teams").getTeams().stream()
        .map(EntityReference::getId)
        .filter(teamId -> !teamId.equals(organizationId()))
        .collect(Collectors.toSet());
  }

  private static UUID organizationId() {
    return SdkClients.adminClient().teams().getByName(ORGANIZATION).getId();
  }

  private User createMember(TestNamespace ns, String suffix, Team... teams) {
    String userName = suffix + ns.shortPrefix();
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(userName)
                .withEmail(userName + "@test.com")
                .withTeams(Arrays.stream(teams).map(Team::getId).toList()));
  }

  private Team createClosedTeam(TestNamespace ns, String suffix) {
    return SdkClients.adminClient()
        .teams()
        .create(
            new CreateTeam()
                .withName("csvimpteam_" + suffix + ns.shortPrefix())
                .withTeamType(CreateTeam.TeamType.GROUP)
                .withIsJoinable(false));
  }

  private String row(String name, String email, String isAdmin, String team, String roles) {
    return HEADER
        + "\n"
        + String.join(",", name, name, "imported by test", email, "", isAdmin, team, roles)
        + "\n";
  }

  private String upload(OpenMetadataClient client, String team, String csv, boolean dryRun) {
    return client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/users/import?team=" + team + "&dryRun=" + dryRun, csv);
  }

  private boolean userExists(String name) {
    try {
      return SdkClients.adminClient().users().getByName(name) != null;
    } catch (Exception e) {
      return false;
    }
  }

  /** A non-admin principal holding {@code EditAll} on users, plus the team it imports into. */
  private record Importer(OpenMetadataClient client, String teamName) {
    String upload(String csv, boolean dryRun) {
      return client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT, "/v1/users/import?team=" + teamName + "&dryRun=" + dryRun, csv);
    }

    // Scoped to the organization so every team in the file is inside the import's hierarchy.
    String uploadToOrganization(String csv, boolean dryRun) {
      return client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT, "/v1/users/import?team=" + ORGANIZATION + "&dryRun=" + dryRun, csv);
    }

    CsvImportResult uploadAsyncToOrganization(String csv, boolean dryRun) {
      String submitted =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.PUT,
                  "/v1/users/importAsync?team=" + ORGANIZATION + "&dryRun=" + dryRun,
                  csv);
      String jobId = JsonUtils.readTree(submitted).path("jobId").asText();
      assertFalse(jobId.isEmpty(), submitted);
      CsvJobClient jobs = CsvJobClient.onDefaultServer();
      jobs.awaitJobStatus(jobId, "COMPLETED");
      try {
        String body =
            jobs.request("GET", "/v1/csvAsyncJobs/" + jobId + "/import-result", null).body();
        return JsonUtils.readValue(body, CsvImportResult.class);
      } catch (IOException | InterruptedException e) {
        throw new IllegalStateException("Failed to read the import result of job " + jobId, e);
      }
    }
  }

  private Importer createImporterWithEditAllOnUsers(TestNamespace ns, String suffix) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String unique = suffix + ns.shortPrefix();

    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("csvimp_policy_" + unique)
                    .withDescription("EditAll on users, granted to a non-admin importer")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("csvimpEditUsers")
                                .withDescription("Allow editing users")
                                .withEffect(Rule.Effect.ALLOW)
                                .withOperations(List.of(MetadataOperation.ALL))
                                .withResources(List.of("all")))));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName("csvimp_role_" + unique)
                    .withPolicies(List.of(policy.getFullyQualifiedName())));

    Team team = createTeam(ns, suffix);
    String userName = "csvimp" + unique;
    User importer =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(userName + "@test.com")
                    .withRoles(List.of(role.getId())));
    assertNotNull(importer.getId());
    assertFalse(Boolean.TRUE.equals(importer.getIsAdmin()), "Importer must not be an admin");

    return new Importer(
        SdkClients.createClient(userName, userName + "@test.com", new String[] {}), team.getName());
  }

  private Team createTeam(TestNamespace ns, String suffix) {
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName("csvimpteam_" + suffix + ns.shortPrefix())
                    .withTeamType(CreateTeam.TeamType.GROUP));
    assertEquals(CreateTeam.TeamType.GROUP.value(), team.getTeamType().value());
    return team;
  }
}

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration test for GitHub Issue #22551: Query Visibility Issue with Table Policies
 *
 * <p>When a user has a policy that grants VIEW_ALL on entities with a specific tag, they should be
 * able to:
 * <ul>
 *   <li>View tables that have that tag
 *   <li>View queries that are associated with those tables (via queryUsedIn relationship)
 * </ul>
 *
 * <p>The bug was that queries for a tagged table were not visible because the authorization check
 * was only done on the Query entity's own tags, not considering the table's tags.
 *
 * <p>The fix allows users with VIEW_QUERIES permission on a table to see queries associated with
 * that table.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class QueryVisibilityPolicyIT {

  private static final String PII_SENSITIVE_TAG = "PII.Sensitive";

  @Test
  void test_queryVisibilityWithTableTagPolicy(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    String testPrefix = ns.prefix("qvp");

    // Step 1: Create a policy that allows VIEW_ALL on entities with PII.Sensitive tag
    Rule viewAllWithTagRule = new Rule();
    viewAllWithTagRule.setName("ViewAllWithTag");
    viewAllWithTagRule.setResources(List.of("All"));
    viewAllWithTagRule.setOperations(List.of(MetadataOperation.VIEW_ALL));
    viewAllWithTagRule.setEffect(Rule.Effect.ALLOW);
    viewAllWithTagRule.setCondition("matchAnyTag('PII.Sensitive')");

    CreatePolicy createPolicy = new CreatePolicy();
    createPolicy.setName(testPrefix + "_policy");
    createPolicy.setDescription("Policy to allow VIEW_ALL on entities with PII.Sensitive tag");
    createPolicy.setRules(List.of(viewAllWithTagRule));

    Policy policy = adminClient.policies().create(createPolicy);
    assertNotNull(policy, "Policy should be created");

    try {
      // Step 2: Create a role with that policy
      CreateRole createRole = new CreateRole();
      createRole.setName(testPrefix + "_role");
      createRole.setPolicies(List.of(policy.getFullyQualifiedName()));

      Role role = adminClient.roles().create(createRole);
      assertNotNull(role, "Role should be created");

      try {
        // Step 3: Create a team with that role as default
        CreateTeam createTeam = new CreateTeam();
        createTeam.setName(testPrefix + "_team");
        createTeam.setDefaultRoles(List.of(role.getId()));
        createTeam.setTeamType(org.openmetadata.schema.entity.teams.Team.TeamType.GROUP);

        Team team = adminClient.teams().create(createTeam);
        assertNotNull(team, "Team should be created");

        try {
          // Step 4: Create a user in that team
          String userEmail = testPrefix + "_user@test.openmetadata.org";
          CreateUser createUser = new CreateUser();
          createUser.setName(testPrefix + "_user");
          createUser.setEmail(userEmail);
          createUser.setTeams(List.of(team.getId()));

          User testUser = adminClient.users().create(createUser);
          assertNotNull(testUser, "User should be created");

          try {
            // Step 5: Create a table WITH the PII.Sensitive tag
            // First, we need a database schema reference
            // For this test, we'll use an existing database schema
            CreateTable createTable = new CreateTable();
            createTable.setName(testPrefix + "_table");
            createTable.setDatabaseSchema("sample_data.ecommerce_db.shopify");
            Column column = new Column();
            column.setName("id");
            column.setDataType(ColumnDataType.INT);
            createTable.setColumns(List.of(column));

            TagLabel piiTag = new TagLabel();
            piiTag.setTagFQN(PII_SENSITIVE_TAG);
            piiTag.setSource(TagLabel.TagSource.CLASSIFICATION);
            piiTag.setLabelType(TagLabel.LabelType.MANUAL);
            piiTag.setState(TagLabel.State.CONFIRMED);
            createTable.setTags(List.of(piiTag));

            Table taggedTable = adminClient.tables().create(createTable);
            assertNotNull(taggedTable, "Table should be created");

            try {
              // Step 6: Create a query that references the table (query does NOT have the tag)
              CreateQuery createQuery = new CreateQuery();
              createQuery.setName(testPrefix + "_query");
              createQuery.setQuery("SELECT * FROM " + taggedTable.getFullyQualifiedName());
              EntityReference tableRef = new EntityReference();
              tableRef.setId(taggedTable.getId());
              tableRef.setType("table");
              createQuery.setQueryUsedIn(List.of(tableRef));
              createQuery.setDuration(0.0);
              createQuery.setQueryDate(System.currentTimeMillis());
              createQuery.setService("sample_data");

              Query queryForTable = adminClient.queries().create(createQuery);
              assertNotNull(queryForTable, "Query should be created");

              try {
                // Create client for the test user
                OpenMetadataClient testUserClient =
                    SdkClients.createClient(userEmail, userEmail, new String[] {});

                // Step 7: Verify the test user CAN view the table (due to tag-based policy)
                Table retrievedTable =
                    testUserClient.tables().get(taggedTable.getId().toString(), "tags");
                assertNotNull(retrievedTable, "User should be able to view the tagged table");
                assertTrue(
                    retrievedTable.getTags().stream()
                        .anyMatch(t -> PII_SENSITIVE_TAG.equals(t.getTagFQN())),
                    "Table should have the PII.Sensitive tag");

                // Step 8: Verify the test user CAN view queries for that table
                // This is the key test - with the bug, this would fail with FORBIDDEN
                // After the fix, this should succeed because user has VIEW_ALL (which includes
                // VIEW_QUERIES) on the table
                ListParams listParams = new ListParams();
                listParams.addQueryParam("entityId", taggedTable.getId().toString());
                listParams.setFields("*");

                ListResponse<Query> queriesForTable = testUserClient.queries().list(listParams);

                // The user should be able to see queries associated with the table they have access
                // to
                assertNotNull(queriesForTable, "Query response should not be null");
                assertNotNull(queriesForTable.getData(), "Query data should not be null");
                assertFalse(
                    queriesForTable.getData().isEmpty(),
                    "User with VIEW_ALL on table should be able to see queries for that table");

                boolean foundQuery =
                    queriesForTable.getData().stream()
                        .anyMatch(q -> q.getId().equals(queryForTable.getId()));
                assertTrue(foundQuery, "The query for the tagged table should be visible");

              } finally {
                // Cleanup query
                adminClient.queries().delete(queryForTable.getId());
              }
            } finally {
              // Cleanup table
              adminClient.tables().delete(taggedTable.getId());
            }
          } finally {
            // Cleanup user
            adminClient.users().delete(testUser.getId());
          }
        } finally {
          // Cleanup team
          adminClient.teams().delete(team.getId());
        }
      } finally {
        // Cleanup role
        adminClient.roles().delete(role.getId());
      }
    } finally {
      // Cleanup policy
      adminClient.policies().delete(policy.getId());
    }
  }
}

package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OAuthDAOs;

public class McpOAuthClientIT extends McpTestBase {
  @BeforeAll
  static void setup() throws Exception {
    initAuth();
  }

  @Test
  void adminCanInventoryAndRemoveClientButOrdinaryUserCannot() throws Exception {
    final String id = "mcp_admin_" + UUID.randomUUID();
    final String userName = "mcp_reader_" + UUID.randomUUID().toString().substring(0, 8);
    final var user =
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser().withName(userName).withEmail(userName + "@test.openmetadata.org"));
    final OAuthDAOs.OAuthClientDAO clients = Entity.getCollectionDAO().oauthClientDAO();
    try {
      clients.insert(
          id,
          "test-secret-hash",
          "Inventory test",
          "[\"https://client.example/cb\"]",
          "[\"authorization_code\"]",
          "none",
          "[]");
      final String userToken = "Bearer " + tokenFor(userName);
      assertThat(getResponse("mcp/clients", userToken).statusCode()).isEqualTo(403);
      assertThat(deleteResponse("mcp/clients/" + id, userToken).statusCode()).isEqualTo(403);
      final var page = getResponse("mcp/clients?after=mcp_admin_&limit=1000", authToken);
      assertThat(page.statusCode()).isEqualTo(200);
      assertThat(page.body())
          .contains(id)
          .doesNotContain("test-secret-hash", "clientSecret", "token");
      assertThat(deleteResponse("mcp/clients/" + id, authToken).statusCode()).isEqualTo(204);
      assertThat(clients.findByClientId(id)).isNull();
      assertThat(deleteResponse("mcp/clients/" + id, authToken).statusCode()).isEqualTo(404);
    } finally {
      clients.deleteWithGrants(id);
      SdkClients.adminClient().users().delete(user.getId().toString());
    }
  }
}

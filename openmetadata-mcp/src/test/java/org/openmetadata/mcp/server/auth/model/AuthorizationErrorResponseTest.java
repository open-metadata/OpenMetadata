package org.openmetadata.mcp.server.auth.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class AuthorizationErrorResponseTest {

  @Test
  void testToQueryParams_allFieldsPresent() {
    AuthorizationErrorResponse response =
        new AuthorizationErrorResponse("invalid_request", "Missing client_id", "state123");

    Map<String, String> params = response.toQueryParams();

    assertThat(params).containsEntry("error", "invalid_request");
    assertThat(params).containsEntry("error_description", "Missing client_id");
    assertThat(params).containsEntry("state", "state123");
    assertThat(params).hasSize(3);
  }

  @Test
  void testToQueryParams_nullDescriptionOmitted() {
    AuthorizationErrorResponse response =
        new AuthorizationErrorResponse("server_error", null, "state123");

    Map<String, String> params = response.toQueryParams();

    assertThat(params).containsEntry("error", "server_error");
    assertThat(params).containsEntry("state", "state123");
    assertThat(params).doesNotContainKey("error_description");
    assertThat(params).hasSize(2);
  }

  @Test
  void testToQueryParams_nullStateOmitted() {
    AuthorizationErrorResponse response =
        new AuthorizationErrorResponse("invalid_scope", "Scope not allowed", null);

    Map<String, String> params = response.toQueryParams();

    assertThat(params).containsEntry("error", "invalid_scope");
    assertThat(params).containsEntry("error_description", "Scope not allowed");
    assertThat(params).doesNotContainKey("state");
    assertThat(params).hasSize(2);
  }
}

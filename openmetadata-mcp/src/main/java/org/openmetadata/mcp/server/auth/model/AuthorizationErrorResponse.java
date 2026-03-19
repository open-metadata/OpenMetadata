package org.openmetadata.mcp.server.auth.model;

import java.util.HashMap;
import java.util.Map;

/**
 * Immutable OAuth authorization error response as defined in RFC 6749 Section 4.1.2.1.
 */
public class AuthorizationErrorResponse {

  private final String error;
  private final String errorDescription;
  private final String state;

  public AuthorizationErrorResponse(String error, String errorDescription, String state) {
    this.error = error;
    this.errorDescription = errorDescription;
    this.state = state;
  }

  public String getError() {
    return error;
  }

  public String getErrorDescription() {
    return errorDescription;
  }

  public String getState() {
    return state;
  }

  public Map<String, String> toQueryParams() {
    Map<String, String> params = new HashMap<>();
    params.put("error", error);

    if (errorDescription != null) {
      params.put("error_description", errorDescription);
    }

    if (state != null) {
      params.put("state", state);
    }

    return params;
  }
}

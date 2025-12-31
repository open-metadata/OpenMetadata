package org.openmetadata.mcp.server.auth.model;

import java.net.URI;

/**
 * OAuth authorization error response as defined in RFC 6749 Section 4.1.2.1.
 */
public class AuthorizationErrorResponse {

  private String error;

  private String errorDescription;

  private URI errorUri;

  private String state;

  /**
   * Creates a new AuthorizationErrorResponse.
   * @param error The error code
   * @param errorDescription The error description
   * @param state The state parameter from the request
   */
  public AuthorizationErrorResponse(String error, String errorDescription, String state) {
    this.error = error;
    this.errorDescription = errorDescription;
    this.state = state;
  }

  /**
   * Gets the error code.
   * @return The error code
   */
  public String getError() {
    return error;
  }

  /**
   * Sets the error code.
   * @param error The error code
   */
  public void setError(String error) {
    this.error = error;
  }

  /**
   * Gets the error description.
   * @return The error description
   */
  public String getErrorDescription() {
    return errorDescription;
  }

  /**
   * Sets the error description.
   * @param errorDescription The error description
   */
  public void setErrorDescription(String errorDescription) {
    this.errorDescription = errorDescription;
  }

  /**
   * Gets the error URI.
   * @return The error URI
   */
  public URI getErrorUri() {
    return errorUri;
  }

  /**
   * Sets the error URI.
   * @param errorUri The error URI
   */
  public void setErrorUri(URI errorUri) {
    this.errorUri = errorUri;
  }

  /**
   * Gets the state parameter.
   * @return The state parameter
   */
  public String getState() {
    return state;
  }

  /**
   * Sets the state parameter.
   * @param state The state parameter
   */
  public void setState(String state) {
    this.state = state;
  }

  /**
   * Converts the error response to a map of query parameters.
   * @return A map of query parameters
   */
  public java.util.Map<String, String> toQueryParams() {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("error", error);

    if (errorDescription != null) {
      params.put("error_description", errorDescription);
    }

    if (errorUri != null) {
      params.put("error_uri", errorUri.toString());
    }

    if (state != null) {
      params.put("state", state);
    }

    return params;
  }
}

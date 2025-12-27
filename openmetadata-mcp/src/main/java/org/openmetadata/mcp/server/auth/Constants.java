package org.openmetadata.mcp.server.auth;

/**
 * Shared constants for the auth example.
 */
public class Constants {

  public static final String SERVER_URL = "http://localhost:8585";

  public static final String CLIENT_ID =
      "551097823620-8859ma7ik8cqsrbofm4lr4guus6esl4g.apps.googleusercontent.com";

  public static final String CLIENT_SECRET = "example-secret";

  // public static final String REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";

  public static final String REDIRECT_URI = "http://localhost:47486/oauth/callback";

  public static final String SCOPE = "read write";
}

package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.bolt.App;
import com.slack.api.bolt.servlet.SlackOAuthAppServlet;
import javax.servlet.annotation.WebServlet;

/**
 * Servlet for handling Slack OAuth flow.
 * This endpoint manages the installation and callback process for Slack apps.
 * It supports two paths:
 * - /api/slack/install: Initiates the OAuth installation process.
 * - /api/slack/callback: Handles the callback after the user authorizes the app.
 * Security:
 * - This endpoint is secured by validating the state parameter sent from Slack to prevent CSRF attacks.
 */
@WebServlet({"/api/slack/install", "/api/slack/callback"})
public class SlackAppOAuthController extends SlackOAuthAppServlet {
  public SlackAppOAuthController(App app) {
    super(app);
  }
}

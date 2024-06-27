package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.bolt.App;
import com.slack.api.bolt.servlet.SlackAppServlet;
import javax.servlet.annotation.WebServlet;

/**
 * Servlet for handling Slack events.
 * This endpoint is exposed to receive event callbacks from Slack.
 * Security:
 * - The endpoint is secured by verifying the Slack signing secret internally by bolt.
 */
@WebServlet("/api/slack/events")
public class SlackAppController extends SlackAppServlet {
  public SlackAppController(App app) {
    super(app);
  }
}

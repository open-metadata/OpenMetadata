package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.bolt.App;
import com.slack.api.bolt.servlet.SlackAppServlet;
import javax.servlet.annotation.WebServlet;

@WebServlet("/api/slack/events")
public class SlackAppController extends SlackAppServlet {
  public SlackAppController(App app) {
    super(app);
  }
}

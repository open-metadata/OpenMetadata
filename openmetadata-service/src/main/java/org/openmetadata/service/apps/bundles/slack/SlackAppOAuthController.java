package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.bolt.App;
import com.slack.api.bolt.servlet.SlackOAuthAppServlet;
import javax.servlet.annotation.WebServlet;

@WebServlet({"/api/slack/install", "/api/slack/oauth_redirect"})
public class SlackAppOAuthController extends SlackOAuthAppServlet {
    public SlackAppOAuthController(App app) {
        super(app);
    }
}

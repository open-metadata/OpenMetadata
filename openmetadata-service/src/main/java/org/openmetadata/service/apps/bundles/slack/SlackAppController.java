package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.bolt.App;
import com.slack.api.bolt.servlet.SlackAppServlet;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.core.Response;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AppException;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.AppRepository;

@WebServlet("/api/slack/events")
public class SlackAppController extends SlackAppServlet {
  public static final String APP_NAME = "SlackApplication";
  private static final String SLACK_APP = "Slack";
  private SlackApp slackApp;

  protected void initializeSlackApp() {
    try {
      AppRepository appRepo = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      org.openmetadata.schema.entity.app.App slackApplication =
          appRepo.getByName(null, APP_NAME, appRepo.getFields("*"));
      slackApp =
          (SlackApp)
              ApplicationHandler.getInstance()
                  .runAppInit(
                      slackApplication, Entity.getCollectionDAO(), Entity.getSearchRepository());

    } catch (ClassNotFoundException
        | InvocationTargetException
        | NoSuchMethodException
        | InstantiationException
        | IllegalAccessException e) {
      throw AppException.byMessage(
          SLACK_APP,
          "Missing config",
          "The app needs to be installed before interacting with the API",
          Response.Status.INTERNAL_SERVER_ERROR);
    }
  }
//
//  @Override
//  protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
//    initializeSlackApp();
//    super.doPost(req, resp);
//  }

  public SlackAppController(App app) {
    super(app);
  }
}

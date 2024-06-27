package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.Slack;
import com.slack.api.bolt.App;
import com.slack.api.bolt.AppConfig;
import com.slack.api.bolt.model.builtin.DefaultBot;
import com.slack.api.bolt.service.InstallationService;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.request.conversations.ConversationsListRequest;
import com.slack.api.methods.request.views.ViewsPublishRequest;
import com.slack.api.methods.response.conversations.ConversationsListResponse;
import com.slack.api.methods.response.views.ViewsPublishResponse;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import org.openmetadata.schema.service.configuration.slackApp.SlackAppConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SlackApp extends AbstractNativeApplication {
  private SlackAppConfiguration appConfig;
  private SystemRepository systemRepository;
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final Base64.Encoder BASE64_ENCODER = Base64.getUrlEncoder();
  private final SlackInstallationService installationService = new SlackInstallationService();

  public SlackApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  public static App boltSlackAppRegistration(SlackAppConfiguration config) throws Exception {
    System.out.println("::::: boltSlackAppRegistration :::::");
    AppConfig appConfig =
        AppConfig.builder()
            .clientId(config.getClientId())
            .clientSecret(config.getClientSecret())
            .signingSecret(config.getSigningSecret())
            .scope(config.getScopes())
            .oauthInstallPath("/slack/install")
            .oauthRedirectUriPath(config.getCallbackUrl())
            .stateValidationEnabled(false)
            .build();

    App slackApp = new App(appConfig).asOAuthApp(true);

    InstallationService installationService = new SlackInstallationService();
    slackApp.service(installationService);

    slackApp.command("/hello", (req, ctx) -> ctx.ack(r -> r.text("Thanks!")));
    return slackApp;
  }

  @Override
  public void init(org.openmetadata.schema.entity.app.App app) {
    super.init(app);
    this.systemRepository = Entity.getSystemRepository();
    appConfig =
        JsonUtils.convertValue(
            this.getApp().getPrivateConfiguration(), SlackAppConfiguration.class);
  }

  public Map<String, Object> listChannels() throws AppException {
    try {
      HashMap<String, Object> tokenMap = installationService.getSavedToken();
      if (!tokenMap.containsKey(SlackConstants.BOT_ACCESS_TOKEN)) {
        throw AppException.byMessage(
            SlackConstants.SLACK_APP,
            "listChannels",
            "Bot access token is missing",
            Response.Status.BAD_REQUEST);
      }
      DefaultBot bot = (DefaultBot) tokenMap.get(SlackConstants.BOT_ACCESS_TOKEN);

      Slack slack = Slack.getInstance();
      ConversationsListResponse response =
          slack
              .methods(bot.getBotAccessToken())
              .conversationsList(ConversationsListRequest.builder().build());

      if (response.isOk()) {
        List<Map<String, String>> channels =
            response.getChannels().stream()
                .map(
                    channel -> {
                      Map<String, String> channelInfo = new HashMap<>();
                      channelInfo.put("id", channel.getId());
                      channelInfo.put("name", channel.getName());
                      return channelInfo;
                    })
                .collect(Collectors.toList());

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("channels", channels);

        return responseData;
      } else {
        throw AppException.byMessage(
            SlackConstants.SLACK_APP,
            "listChannels",
            response.getError(),
            Response.Status.INTERNAL_SERVER_ERROR);
      }
    } catch (SlackApiException | IOException e) {
      throw AppException.byMessage(
          SlackConstants.SLACK_APP,
          "listChannels",
          "Slack API error: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    } catch (Exception e) {
      throw AppException.byMessage(
          SlackConstants.SLACK_APP,
          "listChannels",
          "Unexpected error occurred: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  private String readJsonFromFile(String filePath) throws IOException {
    try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(filePath)) {
      if (inputStream == null) {
        throw new IOException("File not found: " + filePath);
      }
      return IOUtils.toString(inputStream, StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw e;
    }
  }

  public String getRedirectUrl(boolean isStateValid) {
    return appConfig.getCallbackRedirectURL()
        + (isStateValid ? SlackConstants.SUCCESS_FRAGMENT : SlackConstants.FAILED_FRAGMENT);
  }

  public boolean isOAuthStateValid(String stateFromCallback) {
    try {
      String expectedState = getSlackOAuthStateFromDb();
      return stateFromCallback.equals(expectedState);
    } catch (Exception e) {
      LOG.error("Error comparing OAuth states: {}", e.getMessage(), e);
      return false;
    }
  }

  private Response handleAppHomeOpened(String eventTab, String userId) {
    try {
      return switch (eventTab) {
        case SlackConstants.HOME -> {
          publishHomeTab(userId);
          yield Response.ok().build();
        }
        case SlackConstants.MESSAGES -> {
          LOG.info("message_tab_opened");
          yield Response.ok().build();
        }
        case SlackConstants.ABOUT -> {
          LOG.info("about_tab_opened");
          yield Response.ok().build();
        }
        default -> throw new IllegalStateException("Unexpected value: " + eventTab);
      };
    } catch (IOException | SlackApiException e) {
      LOG.error("Error publishing home tab", e);
      return Response.serverError().build();
    }
  }

  private void publishHomeTab(String userId) throws IOException, SlackApiException {
    Slack slack = Slack.getInstance();
    HashMap<String, Object> tokenMap = installationService.getSavedToken();
    if (!tokenMap.containsKey(SlackConstants.BOT_ACCESS_TOKEN)) {
      throw AppException.byMessage(
          SlackConstants.SLACK_APP,
          "publishHomeTab",
          "Bot access token is missing",
          Response.Status.BAD_REQUEST);
    }
    DefaultBot bot = (DefaultBot) tokenMap.get(SlackConstants.BOT_ACCESS_TOKEN);
    String jsonView = readJsonFromFile(SlackConstants.HOME_VIEW_TEMPLATE);

    ViewsPublishRequest request =
        ViewsPublishRequest.builder()
            .userId(userId)
            .viewAsString(jsonView)
            .token(bot.getBotAccessToken())
            .build();

    ViewsPublishResponse response = slack.methods().viewsPublish(request);

    if (!response.isOk()) {
      throw AppException.byMessage(
          SlackConstants.SLACK_APP,
          "viewsPublish",
          "error publishing view :: " + response.getError(),
          Response.Status.INTERNAL_SERVER_ERROR);
    } else {
      LOG.info("View published successfully: {}", response);
    }
  }

  private String getSlackOAuthStateFromDb() {
    Settings stateSetting = systemRepository.getSlackOAuthStateConfigInternal();
    String installerJson = JsonUtils.pojoToJson(stateSetting.getConfigValue());
    return SystemRepository.decryptSlackOAuthStateSetting(installerJson);
  }

  public String buildOAuthUrl() {
    String baseUrl = SlackConstants.SLACK_OAUTH_URL;
    String clientId = appConfig.getClientId();
    String scopes = appConfig.getScopes();

    String state = generateRandomState();
    installationService.saveTokenToSystemRepository(state, SettingsType.SLACK_O_AUTH_STATE);

    return String.format("%s?client_id=%s&scope=%s&state=%s", baseUrl, clientId, scopes, state);
  }

  private String generateRandomState() {
    byte[] randomBytes = new byte[24];
    SECURE_RANDOM.nextBytes(randomBytes);
    return BASE64_ENCODER.encodeToString(randomBytes);
  }

  @Override
  public void raisePreviewMessage(org.openmetadata.schema.entity.app.App app) {
    throw AppException.byMessage(
        app.getName(), "Preview", "Contact Collate to purchase the Application");
  }
}

record SlackApiResponse<T>(int statusCode, String message, T data) {}

@Getter
class SlackConstants {
  public static final String SLACK_APP = "SlackApp";
  public static final String HOME = "home";
  public static final String ABOUT = "about";
  public static final String MESSAGES = "messages";
  public static final String HOME_EVENT_TYPE = "app_home_opened";
  public static final String EVENT_CALLBACK = "event_callback";
  public static final String BOT_ACCESS_TOKEN = "botAccessToken";
  public static final String AUTHED_USER_ACCESS_TOKEN = "installerAccessToken";
  public static final String SUCCESS_FRAGMENT = "#oauth_success";
  public static final String FAILED_FRAGMENT = "#oauth_failed";
  public static final String HOME_VIEW_TEMPLATE = "slackViewTemplates/home_view.json";
  public static final String SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
}

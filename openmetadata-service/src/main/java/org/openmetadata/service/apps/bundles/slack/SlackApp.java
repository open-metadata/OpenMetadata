package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.Slack;
import com.slack.api.bolt.App;
import com.slack.api.bolt.AppConfig;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.request.conversations.ConversationsListRequest;
import com.slack.api.methods.request.views.ViewsPublishRequest;
import com.slack.api.methods.response.conversations.ConversationsListResponse;
import com.slack.api.methods.response.oauth.OAuthV2AccessResponse;
import com.slack.api.methods.response.views.ViewsPublishResponse;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Hex;
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
                    .oauthInstallPath("")
                    .oauthRedirectUriPath(config.getCallbackUrl())
                    .stateValidationEnabled(false)
                    .build();

    App slackApp = new App(appConfig).asOAuthApp(true);

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

  public String saveTokenAndBuildRedirectUrl(String code) {
    boolean isSuccess = exchangeCodeAndSaveToken(code);
    return appConfig.getCallbackRedirectURL()
        + (isSuccess ? SlackConstants.SUCCESS_FRAGMENT : SlackConstants.FAILED_FRAGMENT);
  }

  private boolean exchangeCodeAndSaveToken(String code) {
    try {
      Slack slack = Slack.getInstance();
      OAuthV2AccessResponse oAuthV2AccessResponse =
          slack
              .methods()
              .oauthV2Access(
                  r ->
                      r.clientId(appConfig.getClientId())
                          .clientSecret(appConfig.getClientSecret())
                          .code(code)
                          .redirectUri(appConfig.getCallbackUrl()));

      if (oAuthV2AccessResponse.isOk()) {
        Optional.ofNullable(oAuthV2AccessResponse.getAccessToken())
            .ifPresentOrElse(
                token -> saveTokenToSystemRepository(token, SettingsType.SLACK_BOT),
                () -> {
                  LOG.warn("Received null accessToken");
                  saveTokenToSystemRepository("", SettingsType.SLACK_BOT);
                });

        Optional.ofNullable(oAuthV2AccessResponse.getAuthedUser().getAccessToken())
            .ifPresentOrElse(
                token -> saveTokenToSystemRepository(token, SettingsType.SLACK_INSTALLER),
                () -> {
                  LOG.warn("Received null userAccessToken");
                  saveTokenToSystemRepository("", SettingsType.SLACK_INSTALLER);
                });

        return true;
      } else {
        LOG.error("Error exchanging Slack token: {}", oAuthV2AccessResponse.getError());
        return false;
      }
    } catch (IOException | SlackApiException e) {
      LOG.error("Error during Slack OAuth exchange: ", e);
      return false;
    }
  }

  public Map<String, Object> listChannels() throws AppException {
    try {
      HashMap<String, String> tokenMap = getSavedToken();
      if (!tokenMap.containsKey(SlackConstants.BOT_ACCESS_TOKEN)) {
        throw AppException.byMessage(
            SlackConstants.SLACK_APP,
            "listChannels",
            "Bot access token is missing",
            Response.Status.BAD_REQUEST);
      }
      String accessToken = tokenMap.get(SlackConstants.BOT_ACCESS_TOKEN);

      Slack slack = Slack.getInstance();
      ConversationsListResponse response =
          slack.methods(accessToken).conversationsList(ConversationsListRequest.builder().build());

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

  private HashMap<String, String> getSavedToken() {
    HashMap<String, String> tokenMap = new HashMap<>();
    try {
      tokenMap.put(SlackConstants.BOT_ACCESS_TOKEN, getBotTokenFromDb());
      tokenMap.put(SlackConstants.AUTHED_USER_ACCESS_TOKEN, getInstallerTokenFromDb());
    } catch (Exception e) {
      throw AppException.byMessage(
          SlackConstants.SLACK_APP,
          "getSavedToken",
          "error retrieving slack tokens:: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
    return tokenMap;
  }

  private String getBotTokenFromDb() {
    Settings botSettings = systemRepository.getSlackbotConfigInternal();
    String botJson = JsonUtils.pojoToJson(botSettings.getConfigValue());
    return SystemRepository.decryptSlackDefaultBotSetting(botJson);
  }

  private String getInstallerTokenFromDb() {
    Settings installerSettings = systemRepository.getSlackInstallerConfigInternal();
    String installerJson = JsonUtils.pojoToJson(installerSettings.getConfigValue());
    return SystemRepository.decryptSlackDefaultInstallerSetting(installerJson);
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

  boolean isRequestValid(String slackSignature, String slackRequestTimestamp, String requestBody) {
    try {
      String SIGNING_SECRET = appConfig.getSigningSecret();
      long requestTime = Long.parseLong(slackRequestTimestamp);
      long currentTime = Instant.now().getEpochSecond();

      // Check if request is within 5 minutes of server time
      if (Math.abs(currentTime - requestTime) > 300) {
        LOG.error("Request timestamp is too old");
        return false;
      }

      // Construct the base string for the HMAC signature using a colon (:) as a delimiter
      String baseString = "v0:" + slackRequestTimestamp + ":" + requestBody;

      // Compute HMAC SHA-256 hash
      Mac mac = Mac.getInstance("HmacSHA256");
      SecretKeySpec secretKeySpec =
          new SecretKeySpec(SIGNING_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
      mac.init(secretKeySpec);
      byte[] hmacBytes = mac.doFinal(baseString.getBytes(StandardCharsets.UTF_8));

      // Convert bytes to hexadecimal format
      String computedSignature = "v0=" + Hex.encodeHexString(hmacBytes);

      // Compare computed signature with Slack signature
      return MessageDigest.isEqual(
          computedSignature.getBytes(StandardCharsets.UTF_8),
          slackSignature.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      LOG.error("Error verifying request signature", e);
      return false;
    }
  }

  Response handleEvent(Map<String, Object> eventPayload) {
    String eventType = (String) eventPayload.get("type");

    if (SlackConstants.EVENT_CALLBACK.equals(eventType)) {
      Map<String, Object> event = (Map<String, Object>) eventPayload.get("event");
      String eventSubtype = (String) event.get("type");
      String eventTab = (String) event.get("tab");

      return switch (eventSubtype) {
        case SlackConstants.HOME_EVENT_TYPE -> handleAppHomeOpened(
            eventTab, (String) event.get("user"));
        default -> {
          LOG.warn("Unhandled event subtype: " + eventSubtype);
          yield Response.status(Response.Status.BAD_REQUEST).build();
        }
      };
    }

    // If no valid event type matches
    return Response.status(Response.Status.BAD_REQUEST).build();
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
    HashMap<String, String> tokenMap = getSavedToken();
    if (!tokenMap.containsKey(SlackConstants.BOT_ACCESS_TOKEN)) {
      throw AppException.byMessage(
          SlackConstants.SLACK_APP,
          "publishHomeTab",
          "Bot access token is missing",
          Response.Status.BAD_REQUEST);
    }
    String accessToken = tokenMap.get(SlackConstants.BOT_ACCESS_TOKEN);
    String jsonView = readJsonFromFile(SlackConstants.HOME_VIEW_TEMPLATE);

    ViewsPublishRequest request =
        ViewsPublishRequest.builder()
            .userId(userId)
            .viewAsString(jsonView)
            .token(accessToken)
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
    saveTokenToSystemRepository(state, SettingsType.SLACK_O_AUTH_STATE);

    return String.format("%s?client_id=%s&scope=%s&state=%s", baseUrl, clientId, scopes, state);
  }

  private String generateRandomState() {
    byte[] randomBytes = new byte[24];
    SECURE_RANDOM.nextBytes(randomBytes);
    return BASE64_ENCODER.encodeToString(randomBytes);
  }

  private void saveTokenToSystemRepository(String accessToken, SettingsType configType) {
    try {
      Settings setting = new Settings();
      setting.setConfigType(configType);
      setting.setConfigValue(accessToken);
      systemRepository.createOrUpdate(setting);
    } catch (Exception e) {
      LOG.error("Error saving token to system repository: {}", e.getMessage());
    }
  }

  @Override
  public void raisePreviewMessage(org.openmetadata.schema.entity.app.App app) {
    throw AppException.byMessage(
        app.getName(), "Preview", "Contact Collate to purchase the Application");
  }
}

@Getter
class SlackApiResponse<T> {
  private final int statusCode;
  private final String message;
  private final T data;

  public SlackApiResponse(int statusCode, String message, T data) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

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

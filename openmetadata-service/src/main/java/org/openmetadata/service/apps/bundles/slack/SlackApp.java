package org.openmetadata.service.apps.bundles.slack;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.slack.api.Slack;
import com.slack.api.bolt.App;
import com.slack.api.bolt.AppConfig;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.request.chat.ChatPostMessageRequest;
import com.slack.api.methods.request.conversations.ConversationsListRequest;
import com.slack.api.methods.response.chat.ChatPostMessageResponse;
import com.slack.api.methods.response.conversations.ConversationsListResponse;
import com.slack.api.model.Conversation;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import okhttp3.FormBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
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
  private SystemRepository systemRepository;
  private SlackAppConfiguration appConfig;
  private App slackAppInstance;
  private static final SecureRandom secureRandom = new SecureRandom();
  private static final Base64.Encoder base64Encoder = Base64.getUrlEncoder();

  private static final String SLACK_OAUTH_BASE_URL = "https://slack.com/oauth/v2/authorize";
  private static final String SLACK_OAUTH_INSTALL_ENDPOINT = "/slack/install";
  private static final String SLACK_OAUTH_CALLBACK_ENDPOINT = "/api/v1/slack/callback";
  private static final String SLACK_TOKEN_EXCHANGE_ENDPOINT =
      "https://slack.com/api/oauth.v2.access";
  private static final String SLACK_REDIRECT_URL =
      "https://005d-2405-201-6028-48a8-9059-c572-1956-c86a.ngrok-free.app/api/v1/slack/callback";

  @Getter private static String generatedState;

  public SlackApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(org.openmetadata.schema.entity.app.App app) {
    super.init(app);
    this.systemRepository = Entity.getSystemRepository();
    appConfig =
        JsonUtils.convertValue(
            this.getApp().getPrivateConfiguration(), SlackAppConfiguration.class);
    initializeSlackApp(appConfig);
  }

  public void initializeSlackApp(SlackAppConfiguration config) {
    AppConfig appConfig = buildAppConfig(config);
    App slackApp = new App(appConfig).asOAuthApp(true);
    this.slackAppInstance = slackApp;
  }

  private static AppConfig buildAppConfig(SlackAppConfiguration config) {
    return AppConfig.builder()
        .clientId(config.getClientId())
        .clientSecret(config.getClientSecret())
        .signingSecret(config.getSigningCertificate())
        .scope(config.getScopes())
        .oauthInstallPath(SLACK_OAUTH_INSTALL_ENDPOINT)
        .oauthRedirectUriPath(SLACK_OAUTH_CALLBACK_ENDPOINT)
        .stateValidationEnabled(true)
        .build();
  }

  public String buildOAuthUrl() {
    String clientId = appConfig.getClientId();
    String scopes = appConfig.getScopes();
    String state = generateRandomState();
    generatedState = state;

    return SLACK_OAUTH_BASE_URL
        + "?client_id="
        + clientId
        + "&scope="
        + scopes
        + "&state="
        + state
        + "&redirect_uri="
        + SLACK_REDIRECT_URL;
  }

  @Override
  public void raisePreviewMessage(org.openmetadata.schema.entity.app.App app) {
    throw AppException.byMessage(
        app.getName(), "Preview", "Contact Collate to purchase the Application");
  }

  public boolean exchangeAndSaveSlackTokens(String code) {
    OkHttpClient client = new OkHttpClient();
    ObjectMapper objectMapper = new ObjectMapper();

    try {
      RequestBody body = buildTokenExchangeRequestBody(code);
      Request request = new Request.Builder().url(SLACK_TOKEN_EXCHANGE_ENDPOINT).post(body).build();

      try (okhttp3.Response slackResponse = client.newCall(request).execute()) {
        if (!slackResponse.isSuccessful()) {
          throw new IOException("Unexpected code " + slackResponse.code());
        }

        String responseBody = slackResponse.body().string();
        JsonNode jsonNode = objectMapper.readTree(responseBody);
        String botAccessToken = extractAccessToken(jsonNode, "access_token", "Bot access token");
        String userAccessToken =
            extractAccessToken(
                jsonNode.get("authed_user"), "access_token", "Authed user access token");

        saveTokenToSystemRepository(botAccessToken, SettingsType.SLACK_BOT);
        saveTokenToSystemRepository(userAccessToken, SettingsType.SLACK_INSTALLER);

        return true;
      } catch (IOException e) {
        LOG.error("Error executing Slack token exchange request: {}", e.getMessage());
        return false;
      }
    } catch (Exception e) {
      LOG.error("Error exchanging Slack token: {}", e.getMessage());
      return false;
    }
  }

  private RequestBody buildTokenExchangeRequestBody(String code) {
    return new FormBody.Builder()
        .add("code", code)
        .add("client_id", appConfig.getClientId())
        .add("client_secret", appConfig.getClientSecret())
        .add("redirect_uri", SLACK_REDIRECT_URL)
        .build();
  }

  private String extractAccessToken(JsonNode node, String accessTokenField, String logMessage) {
    String accessToken = "";
    if (node != null && !node.isNull()) {
      JsonNode accessTokenNode = node.get(accessTokenField);
      if (accessTokenNode != null && !accessTokenNode.isNull()) {
        accessToken = accessTokenNode.asText();
      } else {
        LOG.warn(logMessage + " not found in Slack response");
      }
    } else {
      LOG.warn("JsonNode is null or empty for: " + logMessage);
    }
    return accessToken;
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

  public Map<String, List<Conversation>> listChannels() throws AppException {
    try {
      HashMap<String, String> tokenMap = getSavedToken();
      if (tokenMap == null || !tokenMap.containsKey("botAccessToken")) {
        throw AppException.byMessage(
            "SlackApp", "listChannels", "Bot access token is missing", Response.Status.BAD_REQUEST);
      }
      String accessToken = tokenMap.get("botAccessToken");

      Slack slack = slackAppInstance.getSlack();
      ConversationsListResponse response =
          slack.methods(accessToken).conversationsList(ConversationsListRequest.builder().build());

      if (response.isOk()) {
        Map<String, List<Conversation>> channelMap = new HashMap<>();
        channelMap.put("channels", response.getChannels());
        return channelMap;
      } else {
        throw AppException.byMessage(
            "SlackApp", "listChannels", response.getError(), Response.Status.INTERNAL_SERVER_ERROR);
      }
    } catch (SlackApiException | IOException e) {
      throw AppException.byMessage(
          "SlackApp",
          "listChannels",
          "Slack API error: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    } catch (Exception e) {
      throw AppException.byMessage(
          "SlackApp",
          "listChannels",
          "Unexpected error occurred: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public HashMap<String, Object> postMessage(String channelId, String message) throws AppException {
    HashMap<String, String> tokenMap = getSavedToken();
    if (tokenMap == null || !tokenMap.containsKey("botAccessToken")) {
      throw AppException.byMessage(
          "SlackApp", "postMessage", "Bot access token is missing", Response.Status.BAD_REQUEST);
    }

    String accessToken = tokenMap.get("botAccessToken");

    try {
      Slack slack = slackAppInstance.getSlack();
      ChatPostMessageResponse response =
          slack
              .methods(accessToken)
              .chatPostMessage(
                  ChatPostMessageRequest.builder().channel(channelId).text(message).build());

      if (!response.isOk()) {
        String errorMessage = response.getError();
        if ("not_in_channel".equals(errorMessage)) {
          throw AppException.byMessage(
              "SlackApp",
              "postMessage",
              "Bot is not in the channel or lacks permission to post",
              Response.Status.FORBIDDEN);
        } else {
          throw AppException.byMessage(
              "SlackApp",
              "postMessage",
              "Error posting message: " + response.getError(),
              Response.Status.BAD_REQUEST);
        }
      }

      HashMap<String, Object> postedMessage = new HashMap<>();
      postedMessage.put("channel", response.getChannel());
      postedMessage.put("message", response.getMessage());
      return postedMessage;

    } catch (SlackApiException | IOException e) {
      throw AppException.byMessage(
          "SlackApp",
          "postMessage",
          "Slack API error: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    } catch (Exception e) {
      throw AppException.byMessage(
          "SlackApp",
          "postMessage",
          "Unexpected error occurred: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
  }

  public HashMap<String, String> getSavedToken() {
    HashMap<String, String> tokenMap = new HashMap<>();
    try {
      tokenMap.put("botAccessToken", getBotTokenFromDb());
      tokenMap.put("installerAccessToken", getInstallerTokenFromDb());

    } catch (Exception e) {
      throw AppException.byMessage(
          "SlackApp",
          "getSavedToken",
          "error retrieving slack tokens:: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
    return tokenMap;
  }

  public String getBotTokenFromDb() {
    Settings botSettings = systemRepository.getSlackbotConfigInternal();
    String botJson = JsonUtils.pojoToJson(botSettings.getConfigValue());
    return SystemRepository.decryptSlackDefaultBotSetting(botJson);
  }

  public String getInstallerTokenFromDb() {
    Settings installerSettings = systemRepository.getSlackInstallerConfigInternal();
    String installerJson = JsonUtils.pojoToJson(installerSettings.getConfigValue());
    return SystemRepository.decryptSlackDefaultInstallerSetting(installerJson);
  }

  public String generateRandomState() {
    byte[] randomBytes = new byte[24];
    secureRandom.nextBytes(randomBytes);
    return base64Encoder.encodeToString(randomBytes);
  }
}
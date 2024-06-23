package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.Slack;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.request.conversations.ConversationsListRequest;
import com.slack.api.methods.response.conversations.ConversationsListResponse;
import com.slack.api.methods.response.oauth.OAuthV2AccessResponse;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
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
  private final String BOT_ACCESS_TOKEN = "botAccessToken";
  private final String AUTHED_USER_ACCESS_TOKEN = "installerAccessToken";
  private static final String SUCCESS_FRAGMENT = "#oauth_success";
  private static final String FAILED_FRAGMENT = "#oauth_failed";
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final Base64.Encoder BASE64_ENCODER = Base64.getUrlEncoder();

  public SlackApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    this.systemRepository = Entity.getSystemRepository();
    appConfig =
        JsonUtils.convertValue(
            this.getApp().getPrivateConfiguration(), SlackAppConfiguration.class);
  }

  public String saveTokenAndBuildRedirectUrl(String code) {
    boolean isSuccess = exchangeCodeAndSaveToken(code);
    return appConfig.getCallbackRedirectURL() + (isSuccess ? SUCCESS_FRAGMENT : FAILED_FRAGMENT);
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
      if (!tokenMap.containsKey(BOT_ACCESS_TOKEN)) {
        throw AppException.byMessage(
            "SlackApp", "listChannels", "Bot access token is missing", Response.Status.BAD_REQUEST);
      }
      String accessToken = tokenMap.get(BOT_ACCESS_TOKEN);

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

  public String getRedirectUrl(boolean isStateValid) {
    return appConfig.getCallbackRedirectURL() + (isStateValid ? SUCCESS_FRAGMENT : FAILED_FRAGMENT);
  }

  private HashMap<String, String> getSavedToken() {
    HashMap<String, String> tokenMap = new HashMap<>();
    try {
      tokenMap.put(BOT_ACCESS_TOKEN, getBotTokenFromDb());
      tokenMap.put(AUTHED_USER_ACCESS_TOKEN, getInstallerTokenFromDb());
    } catch (Exception e) {
      throw AppException.byMessage(
          "SlackApp",
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

  private String getSlackOAuthStateFromDb() {
    Settings stateSetting = systemRepository.getSlackOAuthStateConfigInternal();
    String installerJson = JsonUtils.pojoToJson(stateSetting.getConfigValue());
    return SystemRepository.decryptSlackOAuthStateSetting(installerJson);
  }

  public String buildOAuthUrl() {
    String baseUrl = "https://slack.com/oauth/v2/authorize";
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
  public void raisePreviewMessage(App app) {
    throw AppException.byMessage(
        app.getName(), "Preview", "Contact Collate to purchase the Application");
  }
}

@Getter
class SlackApiResponse<T> {
  private int statusCode;
  private String message;
  private T data;

  public SlackApiResponse(int statusCode, String message, T data) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

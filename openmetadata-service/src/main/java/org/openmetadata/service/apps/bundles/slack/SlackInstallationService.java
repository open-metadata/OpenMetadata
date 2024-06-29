package org.openmetadata.service.apps.bundles.slack;

import com.slack.api.bolt.Initializer;
import com.slack.api.bolt.model.Bot;
import com.slack.api.bolt.model.Installer;
import com.slack.api.bolt.model.builtin.DefaultBot;
import com.slack.api.bolt.model.builtin.DefaultInstaller;
import com.slack.api.bolt.service.InstallationService;
import java.util.HashMap;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AppException;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SlackInstallationService implements InstallationService {
  private final SystemRepository systemRepository = Entity.getSystemRepository();

  @Override
  public Initializer initializer() {
    return InstallationService.super.initializer();
  }

  @Override
  public boolean isHistoricalDataEnabled() {
    return false;
  }

  @Override
  public void setHistoricalDataEnabled(boolean b) {}

  @Override
  public void saveInstallerAndBot(Installer installer) throws Exception {
    saveTokenToSystemRepository(installer, SettingsType.SLACK_INSTALLER);
    saveTokenToSystemRepository(installer.toBot(), SettingsType.SLACK_BOT);
  }

  @Override
  public void deleteBot(Bot bot) throws Exception {
    systemRepository.deleteSettings(SettingsType.SLACK_BOT);
  }

  @Override
  public void deleteInstaller(Installer installer) throws Exception {
    systemRepository.deleteSettings(SettingsType.SLACK_INSTALLER);
  }

  @Override
  public Bot findBot(String s, String s1) {
    return getBotFromDb();
  }

  @Override
  public Installer findInstaller(String s, String s1, String s2) {
    return getInstallerFromDb();
  }

  HashMap<String, Object> getSavedToken() {
    HashMap<String, Object> tokenMap = new HashMap<>();
    try {
      tokenMap.put(SlackConstants.BOT_ACCESS_TOKEN, getBotFromDb());
      tokenMap.put(SlackConstants.AUTHED_USER_ACCESS_TOKEN, getInstallerFromDb());
    } catch (Exception e) {
      throw AppException.byMessage(
          SlackConstants.SLACK_APP,
          "getSavedToken",
          "error retrieving slack tokens:: " + e.getMessage(),
          Response.Status.INTERNAL_SERVER_ERROR);
    }
    return tokenMap;
  }

  private DefaultBot getBotFromDb() {
    Settings botSettings = systemRepository.getSlackbotConfigInternal();
    String botJson = JsonUtils.pojoToJson(botSettings.getConfigValue());
    return SystemRepository.decryptSlackDefaultBotSetting(botJson);
  }

  private DefaultInstaller getInstallerFromDb() {
    Settings installerSettings = systemRepository.getSlackInstallerConfigInternal();
    String installerJson = JsonUtils.pojoToJson(installerSettings.getConfigValue());
    return SystemRepository.decryptSlackDefaultInstallerSetting(installerJson);
  }

  void saveTokenToSystemRepository(Object entity, SettingsType configType) {
    try {
      Settings setting = new Settings();
      setting.setConfigType(configType);
      setting.setConfigValue(entity);
      systemRepository.createOrUpdate(setting);
    } catch (Exception e) {
      LOG.error("Error saving token to system repository: {}", e.getMessage());
    }
  }
}

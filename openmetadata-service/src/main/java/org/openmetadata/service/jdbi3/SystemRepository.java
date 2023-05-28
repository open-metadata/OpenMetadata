package org.openmetadata.service.jdbi3;

import java.util.List;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.SlackAppConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class SystemRepository {
  private static final String FAILED_TO_UPDATE_SETTINGS = "Failed to Update Settings";
  public static final String INTERNAL_SERVER_ERROR_WITH_REASON = "Internal Server Error. Reason :";
  private final SystemDAO dao;

  public SystemRepository(SystemDAO dao) {
    this.dao = dao;
  }

  public EntitiesCount getAllEntitiesCount(ListFilter filter) {
    return dao.getAggregatedEntitiesCount(filter.getCondition());
  }

  public ServicesCount getAllServicesCount(ListFilter filter) {
    return dao.getAggregatedServicesCount(filter.getCondition());
  }

  public ResultList<Settings> listAllConfigs() {
    List<Settings> settingsList = null;
    try {
      settingsList = dao.getAllConfig();
    } catch (Exception ex) {
      LOG.error("Error while trying fetch all Settings " + ex.getMessage());
    }
    int count = 0;
    if (settingsList != null) {
      count = settingsList.size();
    }
    return new ResultList<>(settingsList, null, null, count);
  }

  public Settings getConfigWithKey(String key) {
    try {
      Settings fetchedSettings = dao.getConfigWithKey(key);
      if (fetchedSettings == null) {
        return null;
      }
      if (fetchedSettings.getConfigType() == SettingsType.EMAIL_CONFIGURATION) {
        SmtpSettings emailConfig = (SmtpSettings) fetchedSettings.getConfigValue();
        emailConfig.setPassword("***********");
        fetchedSettings.setConfigValue(emailConfig);
      }
      return fetchedSettings;

    } catch (Exception ex) {
      LOG.error("Error while trying fetch Settings ", ex);
    }
    return null;
  }

  public Settings getEmailConfigInternal() {
    try {
      Settings setting = dao.getConfigWithKey(SettingsType.EMAIL_CONFIGURATION.value());
      SmtpSettings emailConfig = SystemRepository.decryptEmailSetting((SmtpSettings) setting.getConfigValue());
      setting.setConfigValue(emailConfig);
      return setting;
    } catch (Exception ex) {
      LOG.error("Error while trying fetch EMAIL Settings " + ex.getMessage());
    }
    return null;
  }

  public Settings getSlackApplicationConfiInternal() {
    try {
      Settings setting = dao.getConfigWithKey(SettingsType.SLACK_APP_CONFIGURATION.value());
      SlackAppConfiguration slackAppConfiguration =
          SystemRepository.decryptSlackAppSetting((SlackAppConfiguration) setting.getConfigValue());
      setting.setConfigValue(slackAppConfiguration);
      return setting;
    } catch (Exception ex) {
      LOG.error("Error while trying fetch EMAIL Settings " + ex.getMessage());
    }
    return null;
  }

  public Response createOrUpdate(Settings setting) {
    Settings oldValue = getConfigWithKey(setting.getConfigType().toString());
    try {
      updateSetting(setting);
    } catch (Exception ex) {
      LOG.error(FAILED_TO_UPDATE_SETTINGS + ex.getMessage());
      return Response.status(500, INTERNAL_SERVER_ERROR_WITH_REASON + ex.getMessage()).build();
    }
    if (oldValue == null) {
      return (new RestUtil.PutResponse<>(Response.Status.CREATED, setting, RestUtil.ENTITY_CREATED)).toResponse();
    } else {
      return (new RestUtil.PutResponse<>(Response.Status.OK, setting, RestUtil.ENTITY_UPDATED)).toResponse();
    }
  }

  public Response createNewSetting(Settings setting) {
    try {
      updateSetting(setting);
    } catch (Exception ex) {
      LOG.error(FAILED_TO_UPDATE_SETTINGS + ex.getMessage());
      return Response.status(500, INTERNAL_SERVER_ERROR_WITH_REASON + ex.getMessage()).build();
    }
    return (new RestUtil.PutResponse<>(Response.Status.CREATED, setting, RestUtil.ENTITY_CREATED)).toResponse();
  }

  public Response deleteSettings(SettingsType type) {
    Settings oldValue = getConfigWithKey(type.toString());
    dao.delete(type.value());
    return (new RestUtil.DeleteResponse<>(oldValue, RestUtil.ENTITY_DELETED)).toResponse();
  }

  public Response patchSetting(String settingName, JsonPatch patch) {
    Settings original = getConfigWithKey(settingName);
    // Apply JSON patch to the original entity to get the updated entity
    JsonValue updated = JsonUtils.applyPatch(original.getConfigValue(), patch);
    original.setConfigValue(updated);
    try {
      updateSetting(original);
    } catch (Exception ex) {
      LOG.error(FAILED_TO_UPDATE_SETTINGS + ex.getMessage());
      return Response.status(500, INTERNAL_SERVER_ERROR_WITH_REASON + ex.getMessage()).build();
    }
    return (new RestUtil.PutResponse<>(Response.Status.OK, original, RestUtil.ENTITY_UPDATED)).toResponse();
  }

  public void updateSetting(Settings setting) {
    try {
      switch (setting.getConfigType()) {
        case EMAIL_CONFIGURATION:
          SmtpSettings emailConfig = JsonUtils.convertValue(setting.getConfigValue(), SmtpSettings.class);
          setting.setConfigValue(encryptEmailSetting(emailConfig));
          break;
        case SLACK_APP_CONFIGURATION:
          SlackAppConfiguration appConfiguration =
              JsonUtils.convertValue(setting.getConfigValue(), SlackAppConfiguration.class);
          setting.setConfigValue(encryptSlackAppSetting(appConfiguration));
          break;
      }
      dao.insertSettings(setting.getConfigType().toString(), JsonUtils.pojoToJson(setting.getConfigValue()));
      // Invalidate Cache
      SettingsCache.getInstance().invalidateSettings(setting.getConfigType().value());
    } catch (Exception ex) {
      LOG.error("Failing in Updating Setting.", ex);
      throw new CustomExceptionMessage(Response.Status.INTERNAL_SERVER_ERROR, ex.getMessage());
    }
  }

  public static SmtpSettings encryptEmailSetting(SmtpSettings decryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      String encryptedPwd = Fernet.getInstance().encryptIfApplies(decryptedSetting.getPassword());
      return decryptedSetting.withPassword(encryptedPwd);
    }
    return decryptedSetting;
  }

  public static SmtpSettings decryptEmailSetting(SmtpSettings encryptedSetting) {
    if (Fernet.getInstance().isKeyDefined() && Fernet.isTokenized(encryptedSetting.getPassword())) {
      String decryptedPassword = Fernet.getInstance().decrypt(encryptedSetting.getPassword());
      return encryptedSetting.withPassword(decryptedPassword);
    }
    return encryptedSetting;
  }

  public static SlackAppConfiguration encryptSlackAppSetting(SlackAppConfiguration decryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      String clientId = Fernet.getInstance().encryptIfApplies(decryptedSetting.getClientId());
      String clientSecret = Fernet.getInstance().encryptIfApplies(decryptedSetting.getClientSecret());
      String signingCert = Fernet.getInstance().decryptIfApplies(decryptedSetting.getSigningCertificate());
      return decryptedSetting.withClientId(clientId).withClientSecret(clientSecret).withSigningCertificate(signingCert);
    }
    return decryptedSetting;
  }

  public static SlackAppConfiguration decryptSlackAppSetting(SlackAppConfiguration encryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      String clientId = Fernet.getInstance().decryptIfApplies(encryptedSetting.getClientId());
      String clientSecret = Fernet.getInstance().decryptIfApplies(encryptedSetting.getClientSecret());
      String signingCert = Fernet.getInstance().decryptIfApplies(encryptedSetting.getSigningCertificate());
      return encryptedSetting.withClientId(clientId).withClientSecret(clientSecret).withSigningCertificate(signingCert);
    }
    return encryptedSetting;
  }
}

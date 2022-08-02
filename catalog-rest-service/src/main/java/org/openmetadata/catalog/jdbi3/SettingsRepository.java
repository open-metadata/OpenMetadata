package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.ArrayList;
import java.util.List;
import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.filter.Filter;
import org.openmetadata.catalog.filter.FilterRegistry;
import org.openmetadata.catalog.settings.Settings;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;

@Slf4j
public class SettingsRepository {
  private final CollectionDAO dao;

  public SettingsRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  public ResultList<Settings> listAllConfigs() {
    List<Settings> settingsList = null;
    try {
      List<String> jsons = dao.getSettingsDAO().getAllConfig();
      settingsList = JsonUtils.readObjects(jsons, Settings.class);
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
    Settings settings = null;
    try {
      String json = dao.getSettingsDAO().getConfigWithKey(key);
      settings = JsonUtils.readValue(json, Settings.class);
    } catch (Exception ex) {
      LOG.error("Error while trying fetch Settings " + ex.getMessage());
    }
    return settings;
  }

  public Response createOrUpdate(Settings setting) {
    Settings oldValue = getConfigWithKey(setting.getConfigType().toString());
    try {
      updateSetting(setting);
    } catch (Exception ex) {
      LOG.error("Failed to Update Settings" + ex.getMessage());
      return Response.status(500, "Internal Server Error. Reason :" + ex.getMessage()).build();
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
      LOG.error("Failed to Update Settings" + ex.getMessage());
      return Response.status(500, "Internal Server Error. Reason :" + ex.getMessage()).build();
    }
    return (new RestUtil.PutResponse<>(Response.Status.CREATED, setting, RestUtil.ENTITY_CREATED)).toResponse();
  }

  // TODO: Need to add Json Patch , not sure if that will be possible
  public Response patchSetting(String settingName, JsonPatch patch) throws JsonProcessingException {
    Settings original = getConfigWithKey(settingName);
    // Apply JSON patch to the original entity to get the updated entity
    Settings updated = JsonUtils.applyPatch(original, patch, Settings.class);
    try {
      updateSetting(original);
    } catch (Exception ex) {
      LOG.error("Failed to Update Settings" + ex.getMessage());
      return Response.status(500, "Internal Server Error. Reason :" + ex.getMessage()).build();
    }
    return (new RestUtil.PutResponse<>(Response.Status.OK, original, RestUtil.ENTITY_UPDATED)).toResponse();
  }

  public void updateSetting(Settings setting) {
    try {
      switch (setting.getConfigType()) {
        case AIRFLOW_CONFIGURATION:
          AirflowConfiguration airflowConfiguration =
              JsonUtils.convertValue(setting.getConfigValue(), AirflowConfiguration.class);
          dao.getSettingsDAO().insertSettings(JsonUtils.pojoToJson(airflowConfiguration));
          break;
        case ACTIVITY_FEED_FILTER_SETTING:
          List<Filter> filterDetails = JsonUtils.convertValue(setting.getConfigValue(), ArrayList.class);
          dao.getSettingsDAO().insertSettings(JsonUtils.pojoToJson(filterDetails));
          FilterRegistry.add(filterDetails);
          break;
        default:
          throw new RuntimeException("Only Airflow and Activity Feed Filter Settings update allowed.");
      }
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }
}

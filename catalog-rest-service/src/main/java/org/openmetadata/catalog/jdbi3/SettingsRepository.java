package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.util.EntityUtil.compareEventFilters;
import static org.openmetadata.catalog.util.EntityUtil.compareFilters;

import java.util.List;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.filter.EventFilter;
import org.openmetadata.catalog.filter.Filters;
import org.openmetadata.catalog.settings.Settings;
import org.openmetadata.catalog.settings.SettingsType;
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
      settingsList = dao.getSettingsDAO().getAllConfig();
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
      settings = dao.getSettingsDAO().getConfigWithKey(key);
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

  public Response updateEntityFilter(String entityType, List<Filters> filters) {
    Settings oldValue = getConfigWithKey(SettingsType.ACTIVITY_FEED_FILTER_SETTING.toString());
    // all existing filters
    List<EventFilter> existingEntityFilter = (List<EventFilter>) oldValue.getConfigValue();
    EventFilter entititySpecificFilter = null;
    int position = 0;
    for (EventFilter e : existingEntityFilter) {
      if (e.getEntityType().equals(entityType)) {
        // filters for entity to Update
        entititySpecificFilter = e;
        break;
      }
      position++;
    }
    // sort based on eventType
    filters.sort(compareFilters);
    if (entititySpecificFilter != null) {
      // entity has some existing filter
      entititySpecificFilter.setFilters(filters);
      existingEntityFilter.set(position, entititySpecificFilter);
    } else {
      entititySpecificFilter = new EventFilter();
      entititySpecificFilter.setEntityType(entityType);
      entititySpecificFilter.setFilters(filters);
      existingEntityFilter.add(entititySpecificFilter);
    }
    // sort based on eventType
    existingEntityFilter.sort(compareEventFilters);
    // Put in DB
    oldValue.setConfigValue(existingEntityFilter);
    try {
      updateSetting(oldValue);
      return (new RestUtil.PutResponse<>(Response.Status.OK, oldValue, RestUtil.ENTITY_UPDATED)).toResponse();
    } catch (Exception ex) {
      LOG.error("Failed to Update Settings" + ex.getMessage());
      return Response.status(500, "Internal Server Error. Reason :" + ex.getMessage()).build();
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

  public Response patchSetting(String settingName, JsonPatch patch) {
    Settings original = getConfigWithKey(settingName);
    // Apply JSON patch to the original entity to get the updated entity
    JsonValue updated = JsonUtils.applyPatch(original.getConfigValue(), patch);
    original.setConfigValue(updated);
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
      dao.getSettingsDAO()
          .insertSettings(setting.getConfigType().toString(), JsonUtils.pojoToJson(setting.getConfigValue()));
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }
}

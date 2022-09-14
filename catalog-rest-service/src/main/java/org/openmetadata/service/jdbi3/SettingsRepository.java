/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.settings.SettingsType.ACTIVITY_FEED_FILTER_SETTING;

import java.util.List;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.filter.Filters;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.filter.FilterRegistry;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.FilterUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

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
    try {
      updateSetting(FilterUtil.updateEntityFilter(oldValue, entityType, filters));
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
      if (setting.getConfigType().equals(ACTIVITY_FEED_FILTER_SETTING)) {
        FilterRegistry.add(FilterUtil.getEventFilterFromSettings(setting));
        SettingsCache.getInstance().putSettings(setting);
      }
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }
}

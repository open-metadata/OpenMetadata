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

import java.util.List;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class SettingsRepository {
  private static final String FAILED_TO_UPDATE_SETTINGS = "Failed to Update Settings";
  public static final String INTERNAL_SERVER_ERROR_WITH_REASON = "Internal Server Error. Reason :";
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
    try {
      return dao.getSettingsDAO().getConfigWithKey(key);
    } catch (Exception ex) {
      LOG.error("Error while trying fetch Settings " + ex.getMessage());
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
      dao.getSettingsDAO()
          .insertSettings(setting.getConfigType().toString(), JsonUtils.pojoToJson(setting.getConfigValue()));
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }
}

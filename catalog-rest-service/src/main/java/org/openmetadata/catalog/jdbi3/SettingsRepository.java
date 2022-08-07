package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.List;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.filter.BasicFilter;
import org.openmetadata.catalog.filter.EntityFilter;
import org.openmetadata.catalog.filter.Filter;
import org.openmetadata.catalog.filter.FilterRegistry;
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

  public Response addNewFilter(List<EntityFilter> filter) {
    // takes up unique entries
    checkDuplicateFilters(filter);
    // else proceed
    Settings oldValue = getConfigWithKey(SettingsType.ACTIVITY_FEED_FILTER_SETTING.toString());
    Filter existingFilter = (Filter) oldValue.getConfigValue();
    List<EntityFilter> existingEntityFilters = existingFilter.getEntityFilters();
    // once we have the stored
    checkDuplicateFilters(filter, existingEntityFilters);
    // if no
    existingEntityFilters.addAll(filter);
    existingFilter.setEntityFilters(existingEntityFilters);
    oldValue.setConfigValue(existingFilter);
    return createOrUpdate(oldValue);
  }

  private void checkDuplicateFilters(List<EntityFilter> filters) {
    for (int i = 0; i < filters.size(); i++) {
      for (int j = i + 1; j < filters.size(); j++) {
        if (filters.get(i).getEntityType().equals(filters.get(j).getEntityType()))
          throw new RuntimeException("Filter List Contains Duplicate Entries, Duplicate Entities not allowed in list");
      }
    }
  }

  private void checkDuplicateFilters(List<EntityFilter> newfilters, List<EntityFilter> existingFilters) {
    newfilters.stream()
        .forEach(
            (newFilter) -> {
              boolean duplicateFound =
                  existingFilters.stream()
                      .anyMatch(
                          (existingFilter) -> {
                            return existingFilter.getEntityType().equals(newFilter.getEntityType());
                          });
              if (duplicateFound) {
                throw new RuntimeException("Filters for the Entity already exists, you need to add filters to entity.");
              }
            });
  }

  public Response addNewFilterToEntity(String entityType, List<BasicFilter> filters) {
    Settings oldValue = getConfigWithKey(SettingsType.ACTIVITY_FEED_FILTER_SETTING.toString());
    // all existing filters
    Filter existingFilter = (Filter) oldValue.getConfigValue();
    List<EntityFilter> existingEntityFilter = existingFilter.getEntityFilters();
    EntityFilter entititySpecificFilter = null;
    int position = 0;
    for (EntityFilter e : existingEntityFilter) {
      if (e.getEntityType().equals(entityType)) {
        // filters for entity to Update
        entititySpecificFilter = e;
        break;
      }
      position++;
    }
    if (entititySpecificFilter != null) {
      // entity has some existing filter
      entititySpecificFilter.getEventFilter().addAll(filters);
      existingEntityFilter.set(position, entititySpecificFilter);
    } else {
      entititySpecificFilter = new EntityFilter();
      entititySpecificFilter.setEntityType(entityType);
      entititySpecificFilter.setEventFilter(filters);
      existingEntityFilter.add(entititySpecificFilter);
    }
    existingFilter.setEntityFilters(existingEntityFilter);
    oldValue.setConfigValue(existingFilter);
    return createOrUpdate(oldValue);
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

  public Response patchSetting(String settingName, JsonPatch patch) throws JsonProcessingException {
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
      if (setting.getConfigType() == SettingsType.ACTIVITY_FEED_FILTER_SETTING) {
        Filter filterDetails = JsonUtils.convertValue(setting.getConfigValue(), Filter.class);
        FilterRegistry.add(filterDetails);
      }
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }
}

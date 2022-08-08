package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.util.EntityUtil.compareEntityFilter;
import static org.openmetadata.catalog.util.EntityUtil.compareEventFilter;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.List;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.filter.EntityFilter;
import org.openmetadata.catalog.filter.EventFilter;
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
    Settings oldValue = getConfigWithKey(SettingsType.ACTIVITY_FEED_FILTER_SETTING.toString());
    List<EntityFilter> existingEntityFilters = (List<EntityFilter>) oldValue.getConfigValue();
    checkDuplicateFilters(filter, existingEntityFilters);
    existingEntityFilters.addAll(filter);
    existingEntityFilters.sort(compareEntityFilter);
    oldValue.setConfigValue(existingEntityFilters);
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
    checkDuplicateFilters(newfilters);
    newfilters.forEach(
        (newFilter) -> {
          boolean duplicateFound =
              existingFilters.stream()
                  .anyMatch((existingFilter) -> existingFilter.getEntityType().equals(newFilter.getEntityType()));
          if (duplicateFound) {
            throw new RuntimeException("Filters for the Entity already exists, you need to add filters to entity.");
          }
        });
  }

  public Response addNewFilterToEntity(String entityType, List<EventFilter> filters) {
    Settings oldValue = getConfigWithKey(SettingsType.ACTIVITY_FEED_FILTER_SETTING.toString());
    // all existing filters
    List<EntityFilter> existingEntityFilter = (List<EntityFilter>) oldValue.getConfigValue();
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
    filters.sort(compareEventFilter);
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
      if (setting.getConfigType() == SettingsType.ACTIVITY_FEED_FILTER_SETTING) {
        List<EntityFilter> filterDetails =
            JsonUtils.convertValue(setting.getConfigValue(), new TypeReference<ArrayList<EntityFilter>>() {});
        FilterRegistry.add(filterDetails);
      }
    } catch (Exception ex) {
      throw new RuntimeException(ex);
    }
  }
}

package org.openmetadata.service.jobs;

import static org.openmetadata.service.TypeRegistry.getCustomPropertyFQN;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.openmetadata.schema.jobs.JobArgs;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class EnumCleanupHandler implements JobHandler {
  private static final Logger LOG = LoggerFactory.getLogger(EnumCleanupHandler.class);
  private final CollectionDAO daoCollection;

  public EnumCleanupHandler(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  @Override
  public void runJob(JobArgs jobArgs) throws Exception {
    LOG.debug("Starting EnumCleanupHandler job with args: {}", jobArgs);
    Map<String, Object> enumRemovalArgs = jobArgs.getAdditionalProperties();
    String propertyName = (String) enumRemovalArgs.get("propertyName");
    List<String> removedEnumKeys = (List<String>) enumRemovalArgs.get("removedEnumKeys");
    String entityType = (String) enumRemovalArgs.get("entityType");
    String customPropertyFQN = getCustomPropertyFQN(entityType, propertyName);

    List<CollectionDAO.ExtensionWithIdAndSchemaObject> extensions =
        daoCollection.entityExtensionDAO().getExtensionsByPrefixBatch(customPropertyFQN);

    List<CollectionDAO.ExtensionWithIdAndSchemaObject> updatedExtensions =
        extensions.stream()
            .map(
                extension -> {
                  List<String> rowValues =
                      Optional.ofNullable(extension.getJson())
                          .map(
                              json ->
                                  JsonUtils.readValue(json, new TypeReference<List<String>>() {}))
                          .orElseGet(ArrayList::new);
                  rowValues.removeAll(removedEnumKeys);

                  return CollectionDAO.ExtensionWithIdAndSchemaObject.builder()
                      .id(extension.getId())
                      .extension(extension.getExtension())
                      .json(JsonUtils.pojoToJson(rowValues))
                      .jsonschema(extension.getJsonschema())
                      .build();
                })
            .collect(Collectors.toList());

    LOG.debug("Updated extensions: {}", updatedExtensions);
    daoCollection.entityExtensionDAO().bulkUpsertExtensions(updatedExtensions);
    LOG.debug(
        "Completed EnumCleanupHandler job for entityType: {}, propertyName: {}",
        entityType,
        propertyName);
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return true;
  }
}

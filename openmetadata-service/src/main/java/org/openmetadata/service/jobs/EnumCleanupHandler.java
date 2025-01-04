package org.openmetadata.service.jobs;

import static org.openmetadata.service.TypeRegistry.getCustomPropertyFQN;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.jobs.EnumCleanupArgs;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class EnumCleanupHandler implements JobHandler {
  private final CollectionDAO daoCollection;

  public EnumCleanupHandler(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  @Override
  public void runJob(Object jobArgs) throws Exception {
    LOG.debug("Starting EnumCleanupHandler job with args: {}", jobArgs);
    EnumCleanupArgs enumCleanupArgs = JsonUtils.convertValue(jobArgs, EnumCleanupArgs.class);

    String propertyName = enumCleanupArgs.getPropertyName();
    List<String> removedEnumKeys = enumCleanupArgs.getRemovedEnumKeys();
    String entityType = enumCleanupArgs.getEntityType();
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

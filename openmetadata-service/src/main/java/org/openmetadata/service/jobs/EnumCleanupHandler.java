package org.openmetadata.service.jobs;

import static org.openmetadata.service.TypeRegistry.getCustomPropertyFQN;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.jobs.EnumCleanupArgs;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class EnumCleanupHandler implements JobHandler {
  private final CollectionDAO daoCollection;

  public EnumCleanupHandler(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  @Override
  public void runJob(BackgroundJob job) throws BackgroundJobException {
    try {
      Object jobArgs = job.getJobArgs();
      LOG.debug("Starting EnumCleanupHandler job with args: {}", jobArgs);
      EnumCleanupArgs enumCleanupArgs;
      try {
        enumCleanupArgs = JsonUtils.convertValue(jobArgs, EnumCleanupArgs.class);
      } catch (IllegalArgumentException e) {
        throw new BackgroundJobException(job.getId(), "Invalid arguments " + jobArgs.toString());
      }

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
    } catch (Exception e) {
      throw new BackgroundJobException(
          job.getId(), "Failed to run EnumCleanupHandler job. Error:" + e.getMessage(), e);
    }
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return true;
  }
}

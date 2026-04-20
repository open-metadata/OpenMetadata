package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * The subset of data assets that a Data Insights run cares about.
 *
 * <p>Derived once from {@link InsightsConfig} and shared by the steady-state
 * {@link DataAssetsWorkflow} and the {@link DataAssetsBackfillWorkflow}, so both
 * apply the same {@code entities} whitelist, service-type filter, and
 * {@code dataProduct} soft-delete exception. Callers tell the scope what they
 * need ({@link #entityTypes()}, {@link #filterFor(String)}) rather than
 * re-deriving filter decisions from the raw config at every use site.
 */
public final class DataAssetsScope {

  private static final String ALL_ENTITIES = "all";

  private final Set<String> entityTypes;
  private final DataAssetsConfig dataAssetsConfig;

  private DataAssetsScope(Set<String> entityTypes, DataAssetsConfig dataAssetsConfig) {
    this.entityTypes = entityTypes;
    this.dataAssetsConfig = dataAssetsConfig;
  }

  public static DataAssetsScope from(InsightsConfig config) {
    DataAssetsConfig dataAssetsConfig = config.dataAssetsConfig();
    if (dataAssetsConfig == null) {
      return new DataAssetsScope(config.dataAssetTypes(), null);
    }

    Set<String> serviceFiltered =
        dataAssetsConfig.getServiceFilter() != null
            ? Entity.getEntityTypeInService(dataAssetsConfig.getServiceFilter().getServiceType())
            : Set.of(ALL_ENTITIES);

    List<String> result = new ArrayList<>();
    for (String entityType : config.dataAssetTypes()) {
      boolean passesEntityFilter =
          dataAssetsConfig.getEntities() == null
              || dataAssetsConfig.getEntities().contains(ALL_ENTITIES)
              || dataAssetsConfig.getEntities().contains(entityType);
      boolean passesServiceFilter =
          serviceFiltered.contains(ALL_ENTITIES) || serviceFiltered.contains(entityType);
      if (passesEntityFilter && passesServiceFilter) {
        result.add(entityType);
      }
    }
    return new DataAssetsScope(Set.copyOf(result), dataAssetsConfig);
  }

  public Set<String> entityTypes() {
    return entityTypes;
  }

  public boolean isEmpty() {
    return entityTypes.isEmpty();
  }

  /**
   * {@link ListFilter} for paginated DB reads of the given entity type. Applies the
   * service-name filter when configured and uses {@code Include.ALL} for
   * {@code dataProduct} so soft-deleted data products remain visible (V0/V1 behaviour).
   */
  public ListFilter filterFor(String entityType) {
    if ("dataProduct".equals(entityType)) {
      return new ListFilter(Include.ALL);
    }
    ListFilter filter = new ListFilter();
    if (dataAssetsConfig != null && dataAssetsConfig.getServiceFilter() != null) {
      filter =
          filter.addQueryParam("service", dataAssetsConfig.getServiceFilter().getServiceName());
    }
    return filter;
  }
}

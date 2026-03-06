package org.openmetadata.service.migration.utils.v1130;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final String OLD_FIELD = "owners.name.keyword";
  private static final String NEW_FIELD = "ownerName";

  public static void updateOwnerChartFormulas() {
    DataInsightSystemChartRepository repository = new DataInsightSystemChartRepository();
    String[] chartNames = {
      "percentage_of_data_asset_with_owner",
      "percentage_of_service_with_owner",
      "data_assets_with_owner_summary_card",
      "percentage_of_data_asset_with_owner_kpi",
      "number_of_data_asset_with_owner_kpi",
      "assets_with_owners",
      "assets_with_owner_live"
    };

    for (String chartName : chartNames) {
      try {
        DataInsightCustomChart chart =
            repository.getByName(null, chartName, EntityUtil.Fields.EMPTY_FIELDS);
        String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(chart.getChartDetails());
        if (json.contains(OLD_FIELD)) {
          String updatedJson = json.replace(OLD_FIELD, NEW_FIELD);
          Object updatedDetails =
              org.openmetadata.schema.utils.JsonUtils.readValue(
                  updatedJson, chart.getChartDetails().getClass());
          chart.setChartDetails(updatedDetails);
          repository.prepareInternal(chart, false);
          repository.getDao().update(chart);
          LOG.info(
              "Updated chart formula for '{}': replaced '{}' with '{}'",
              chartName,
              OLD_FIELD,
              NEW_FIELD);
        }
      } catch (Exception ex) {
        LOG.warn("Could not update chart '{}': {}", chartName, ex.getMessage());
      }
    }
  }
}

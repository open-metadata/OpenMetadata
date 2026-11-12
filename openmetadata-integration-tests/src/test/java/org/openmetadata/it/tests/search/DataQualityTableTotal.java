package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertFalse;

import java.math.BigDecimal;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Reads the table total as the UI does: a single value_count row keyed by the field name. */
public final class DataQualityTableTotal {

  public static final String TABLE_TOTAL_AGGREGATION =
      "bucketName=count:aggType=value_count:field=fullyQualifiedName";

  private DataQualityTableTotal() {}

  public static String scopedQuery(UUID databaseSchemaId) {
    return """
        {"query":{"bool":{"must":[{"term":{"databaseSchema.id":"%s"}},{"term":{"deleted":false}}]}}}"""
        .formatted(databaseSchemaId);
  }

  public static long tableTotal(String q, String aggregationQuery) {
    DataQualityReport report = dataQualityReport(q, aggregationQuery);
    assertFalse(report.getData().isEmpty(), "Expected the aggregation to return a row");
    return new BigDecimal(
            report.getData().getFirst().getAdditionalProperties().get("fullyQualifiedName"))
        .longValueExact();
  }

  private static DataQualityReport dataQualityReport(String q, String aggregationQuery) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("q", q)
            .queryParam("index", "table")
            .queryParam("aggregationQuery", aggregationQuery)
            .build();
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/dataQuality/testSuites/dataQualityReport",
            null,
            DataQualityReport.class,
            options);
  }
}

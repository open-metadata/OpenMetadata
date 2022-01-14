package org.openmetadata.catalog.selenium.pages.common;

import org.jetbrains.annotations.Contract;
import org.jetbrains.annotations.NotNull;

public class PayLoad {

  public static String changeDescriptionServices() {
    String payLoad =
        "{\n"
            + "  \"id\": \"b610c069-b0cc-43cf-9845-3236c8666eae\",\n"
            + "  \"name\": \"bigquery_gcp\",\n"
            + "  \"serviceType\": \"BigQuery\",\n"
            + "  \"description\": \"test\",\n"
            + "  \"version\": 0.2,\n"
            + "  \"updatedAt\": 1640848954438,\n"
            + "  \"updatedBy\": \"anonymous\",\n"
            + "  \"href\": \"http://localhost:8585/api/v1/services/databaseServices/b610c069-b0cc-43cf-9845-3236c8666eae\",\n"
            + "  \"jdbc\": {\n"
            + "    \"driverClass\": \"jdbc\",\n"
            + "    \"connectionUrl\": \"jdbc://9999\"\n"
            + "  },\n"
            + "  \"changeDescription\": {\n"
            + "    \"fieldsAdded\": [],\n"
            + "    \"fieldsUpdated\": [\n"
            + "      {\n"
            + "        \"name\": \"description\",\n"
            + "        \"oldValue\": \"\",\n"
            + "        \"newValue\": \"Kushal123\"\n"
            + "      }\n"
            + "    ],\n"
            + "    \"fieldsDeleted\": [],\n"
            + "    \"previousVersion\": 0.1\n"
            + "  }\n"
            + "}";
    return payLoad;
  }

  @NotNull
  @Contract(pure = true)
  public static String changeDescriptionDatabase() {
    String payload =
        "[\n"
            + "  {\n"
            + "    \"op\": \"replace\",\n"
            + "    \"path\": \"/description\",\n"
            + "    \"value\": \"\"\n"
            + "  }\n"
            + "]";

    return payload;
  }
}

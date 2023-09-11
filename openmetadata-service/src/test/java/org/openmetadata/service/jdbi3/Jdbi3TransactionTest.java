package org.openmetadata.service.jdbi3;

import static java.lang.String.format;
import static org.openmetadata.service.resources.EntityResourceTest.C1;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import io.dropwizard.testing.ResourceHelpers;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.*;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.util.TestUtils;

public class Jdbi3TransactionTest extends OpenMetadataApplicationTest {

  private static Jdbi jdbi;
  protected static final String CONFIG_PATH = ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");

  @Test
  void runTransactions(TestInfo testInfo) throws Exception {
    CreateTable create = createTable(testInfo, "testTransactions");
    Table table = createTable(create, "createwithunitofwork", ADMIN_AUTH_HEADERS);
    table = getTable(table.getId().toString(), ADMIN_AUTH_HEADERS);
    Assertions.assertEquals(create.getName(), table.getName());
    table.setDisplayName("testUpdate1");
    table = updateTable(table, "updatewithjdbi", 10, ADMIN_AUTH_HEADERS);
    Assertions.assertEquals("testUpdate1", table.getDisplayName());
    UsageDetails usageDetails = getUsageDetails(table.getId().toString(), ADMIN_AUTH_HEADERS);
    Assertions.assertEquals(usageDetails.getDailyStats().getCount(), 10);
    String oldDisplayName = table.getDisplayName();
    table.setDisplayName("testUpdate1WithFailure");
    try {
      updateTable(table, "updatewithjdbiwitherror", 100, ADMIN_AUTH_HEADERS);
    } catch (Exception e) {
      // ignore exception
    }
    Table newTable = getTable(table.getId().toString(), ADMIN_AUTH_HEADERS);
    // old values should be there
    Assertions.assertEquals(oldDisplayName, newTable.getDisplayName());
    usageDetails = getUsageDetails(table.getId().toString(), ADMIN_AUTH_HEADERS);
    Assertions.assertEquals(usageDetails.getDailyStats().getCount(), 10);
    create.setDisplayName("testUpdate1WithFailure");
  }

  private CreateTable createTable(TestInfo test, String displayName) {
    String name = test.getDisplayName().replaceAll("\\(.*\\)", "");
    return new CreateTable()
        .withName(name)
        .withDisplayName(displayName)
        .withDatabaseSchema("sample_schema")
        .withColumns(
            List.of(
                new Column()
                    .withName(C1)
                    .withDisplayName("c1")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(10)));
  }

  public final Table createTable(CreateTable createRequest, String endPoint, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getClient()
            .target(format("http://localhost:%s/api/v1/system/testtransactions/%s", APP.getLocalPort(), endPoint));
    return TestUtils.put(target, createRequest, Table.class, Response.Status.CREATED, authHeaders);
  }

  public final Table updateTable(Table createRequest, String endPoint, int dailyCount, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getClient()
            .target(
                format(
                    "http://localhost:%s/api/v1/system/testtransactions/%s?dailyCount=%d",
                    APP.getLocalPort(), endPoint, dailyCount));
    return TestUtils.put(target, createRequest, Table.class, Response.Status.OK, authHeaders);
  }

  public final Table getTable(String id, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.get(
        getClient().target(format("http://localhost:%s/api/v1/system/testtransactions/%s", APP.getLocalPort(), id)),
        Table.class,
        authHeaders);
  }

  public final UsageDetails getUsageDetails(String id, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.get(
        getClient()
            .target(format("http://localhost:%s/api/v1/system/testtransactions/%s/usage", APP.getLocalPort(), id)),
        UsageDetails.class,
        authHeaders);
  }
}

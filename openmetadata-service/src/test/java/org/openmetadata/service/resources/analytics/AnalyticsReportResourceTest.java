package org.openmetadata.service.resources.analytics;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.*;

import java.io.IOException;
import java.text.ParseException;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.WebTarget;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.analytics.ReportDefinition;
import org.openmetadata.schema.analytics.type.ReportResult;
import org.openmetadata.schema.analytics.type.ReportResultValue;
import org.openmetadata.schema.api.tests.CreateReportDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

public class AnalyticsReportResourceTest extends EntityResourceTest<ReportDefinition, CreateReportDefinition> {
  public AnalyticsReportResourceTest() {
    super(
        Entity.REPORT_DEFINITION,
        ReportDefinition.class,
        AnalyticsReportResource.ReportDefinitionList.class,
        "analytics/report",
        AnalyticsReportResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
  }

  @Test
  void post_report_definition_200(TestInfo test) throws IOException {
    CreateReportDefinition create = createRequest(test);
    create.withName("bar");
    ReportDefinition reportDefinition = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    reportDefinition = getEntity(reportDefinition.getId(), ADMIN_AUTH_HEADERS);
    validateCreatedEntity(reportDefinition, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_report_definition_4x(TestInfo test) throws IOException {
    assertResponseContains(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name must not be null");
  }

  @Test
  void put_report_results_200(TestInfo test) throws IOException, ParseException {
    CreateReportDefinition create = createRequest(test);
    create.withName("foo");
    ReportDefinition reportDefinition = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    ReportResult reportResult =
        new ReportResult()
            .withTimestamp(TestUtils.dateToTimestamp("2022-10-11"))
            .withDimensions(List.of(new ReportResultValue().withValue("table").withName("entityType")))
            .withMetrics(List.of(new ReportResultValue().withValue("10").withName("completed_descriptions")));
    putReportResult(reportDefinition.getFullyQualifiedName(), reportResult, ADMIN_AUTH_HEADERS);

    ResultList<ReportResult> reportResultList =
        getReportResults(
            reportDefinition.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2022-10-10"),
            TestUtils.dateToTimestamp("2022-10-12"),
            ADMIN_AUTH_HEADERS);

    verifyReportResults(reportResultList, List.of(reportResult), 1);
  }

  @Override
  public CreateReportDefinition createRequest(String name) {
    return new CreateReportDefinition().withName(name).withDescription(name);
  }

  @Override
  public void validateCreatedEntity(
      ReportDefinition createdEntity, CreateReportDefinition request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(ReportDefinition expected, ReportDefinition updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public ReportDefinition validateGetWithDifferentFields(ReportDefinition entity, boolean byName) {
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    return;
  }

  public static void putReportResult(String fqn, ReportResult data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("analytics/report/" + fqn + "/result");
    TestUtils.put(target, data, CREATED, authHeaders);
  }

  public static ResultList<ReportResult> getReportResults(
      String fqn, Long start, Long end, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("analytics/report/" + fqn + "/result");
    target = target.queryParam("startTs", start);
    target = target.queryParam("endTs", end);
    return TestUtils.get(target, AnalyticsReportResource.ReportResultList.class, authHeaders);
  }

  private void verifyReportResults(
      ResultList<ReportResult> actualReportResults, List<ReportResult> expectedReportResults, int expectedCount) {
    assertEquals(expectedCount, actualReportResults.getPaging().getTotal());
    assertEquals(expectedReportResults.size(), actualReportResults.getData().size());
  }
}

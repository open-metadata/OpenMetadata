package org.openmetadata.service.resources.datainsight;

import static jakarta.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.Entity.DATA_INSIGHT_CHART;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionDenied;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.DataReportIndex;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.TestUtils;

public class DataInsightChartResourceTest
    extends EntityResourceTest<DataInsightChart, CreateDataInsightChart> {
  public DataInsightChartResourceTest() {
    super(
        DATA_INSIGHT_CHART,
        DataInsightChart.class,
        DataInsightChartResource.DataInsightChartList.class,
        "analytics/dataInsights/charts",
        DataInsightChartResource.FIELDS);
  }

  @Test
  void post_data_insight_chart_entity_200(TestInfo test) throws IOException {
    CreateDataInsightChart create = createRequest(test);
    create.withName("dataChartTest");
    DataInsightChart dataInsightChart = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    dataInsightChart = getEntity(dataInsightChart.getId(), ADMIN_AUTH_HEADERS);
    validateCreatedEntity(dataInsightChart, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_data_insight_4x(TestInfo test) {
    assertResponseContains(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "query param name must not be null");
  }

  @Test
  void get_data_insight_data_403() throws IOException, ParseException {
    List<Rule> rules = new ArrayList<>();
    CreatePolicy createPolicy;

    UserResourceTest userResourceTest = new UserResourceTest();
    RoleResourceTest roleResourceTest = new RoleResourceTest();
    PolicyResourceTest policyResourceTest = new PolicyResourceTest();

    Role dataStewardRole =
        roleResourceTest.getEntityByName(
            DATA_STEWARD_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);

    rules.add(
        new Rule()
            .withName("denyDataInsightViewRule")
            .withResources(List.of(DATA_INSIGHT_CHART))
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.DENY));
    createPolicy =
        new CreatePolicy()
            .withName("denyDataInsightViewPolicy")
            .withDescription("denyDataInsightViewPolicy")
            .withRules(rules)
            .withOwners(List.of(USER1_REF));
    Policy policy = policyResourceTest.createEntity(createPolicy, ADMIN_AUTH_HEADERS);
    CreateRole createRole =
        roleResourceTest
            .createRequest("denyDataInsightViewRole")
            .withPolicies(EntityUtil.toFQNs(List.of(policy)));
    Role denyDataInsightViewRole = roleResourceTest.createEntity(createRole, ADMIN_AUTH_HEADERS);

    User userForDataInsight =
        userResourceTest.createEntity(
            userResourceTest
                .createRequest("di_user_w_deny", "", "", null)
                .withRoles(List.of(dataStewardRole.getId(), denyDataInsightViewRole.getId())),
            ADMIN_AUTH_HEADERS);

    getDataInsightData(
        userForDataInsight.getName(),
        denyDataInsightViewRole.getName(),
        policy.getName(),
        rules.get(0).getName(),
        true);
  }

  /* We need elasticsearch to fetch data, so we'll only test permission are
   * handled correctly in the request for a restricted user.
   *  */
  public void getDataInsightData(
      String username,
      String roleName,
      String policyName,
      String ruleName,
      boolean shouldThrowException)
      throws ParseException {
    Map<String, String> authHeaders = authHeaders(username + "@open-metadata.org");
    WebTarget target = getCollection().path("/aggregate");

    target =
        target.queryParam(
            "dataInsightChartName",
            DataInsightChartResult.DataInsightChartType.MOST_VIEWED_ENTITIES);
    target = target.queryParam("dataReportIndex", "web_analytic_entity_view_report_data_index");
    target = target.queryParam("startTs", TestUtils.dateToTimestamp("2023-03-21"));
    target = target.queryParam("endTs", TestUtils.dateToTimestamp("2023-03-22"));

    if (shouldThrowException) {
      WebTarget finalTarget = target;
      assertResponse(
          () -> TestUtils.get(finalTarget, authHeaders),
          FORBIDDEN,
          permissionDenied(username, MetadataOperation.VIEW_ALL, roleName, policyName, ruleName));
    }
  }

  @Override
  public CreateDataInsightChart createRequest(String name) {
    return new CreateDataInsightChart()
        .withName(name)
        .withDescription(name)
        .withDataIndexType(DataReportIndex.ENTITY_REPORT_DATA_INDEX);
  }

  @Override
  public void validateCreatedEntity(
      DataInsightChart createdEntity,
      CreateDataInsightChart request,
      Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(
      DataInsightChart expected, DataInsightChart updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public DataInsightChart validateGetWithDifferentFields(DataInsightChart entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners());
    fields = "owners";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}

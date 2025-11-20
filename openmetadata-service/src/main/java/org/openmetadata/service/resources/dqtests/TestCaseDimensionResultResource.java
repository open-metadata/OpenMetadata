package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.service.Entity.TEST_CASE;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseDimensionResult;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseDimensionResultRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.TestCaseResourceContext;

@Slf4j
@Path("/v1/dataQuality/testCases/dimensionResults")
@Tag(name = "Data Quality", description = "APIs to retrieve dimensional test case results data.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestCaseDimensionResults")
public class TestCaseDimensionResultResource
    extends EntityTimeSeriesResource<TestCaseDimensionResult, TestCaseDimensionResultRepository> {
  public static final String COLLECTION_PATH = "/v1/dataQuality/testCases/";

  public TestCaseDimensionResultResource(Authorizer authorizer) {
    super(Entity.TEST_CASE_DIMENSION_RESULT, authorizer);
  }

  public static class TestCaseDimensionResultList extends ResultList<TestCaseDimensionResult> {
    /* Required for serde */
  }

  @GET
  @Path("/{fqn}")
  @Operation(
      operationId = "listTestCaseDimensionResults",
      summary = "List test case dimensional results",
      description =
          "Get a list of dimensional results for a specific test case. "
              + "Results can be filtered by time range and specific dimension values. "
              + "Use `startTs` and `endTs` to filter results within a time range. "
              + "Use `dimensionalityKey` to filter results for a specific dimension value combination. "
              + "Use `dimensionName` to filter results for all values of a specific dimension (e.g., 'column' to get all column dimension results).",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of test case dimensional results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TestCaseDimensionResultList.class)))
      })
  public ResultList<TestCaseDimensionResult> listDimensionResults(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the test case",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String testCaseFQN,
      @Parameter(
              description = "Start timestamp to list dimensional results from",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "End timestamp to list dimensional results to",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description = "Filter by specific dimension key (e.g., 'column=address')",
              schema = @Schema(type = "string"))
          @QueryParam("dimensionalityKey")
          String dimensionalityKey,
      @Parameter(
              description =
                  "Filter by dimension name (e.g., 'column' to get all column dimension results)",
              schema = @Schema(type = "string"))
          @QueryParam("dimensionName")
          String dimensionName)
      throws IOException {
    TestCase testCase = getTestCase(testCaseFQN);
    ResourceContextInterface testCaseResourceContext =
        TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
    OperationContext testCaseOperationContext =
        new OperationContext(TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface entityResourceContext =
        TestCaseResourceContext.builder()
            .entityLink(MessageParser.EntityLink.parse(testCase.getEntityLink()))
            .build();
    OperationContext entityOperationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);

    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(testCaseOperationContext, testCaseResourceContext),
            new AuthRequest(entityOperationContext, entityResourceContext));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    return repository.listDimensionResults(
        testCaseFQN, startTs, endTs, dimensionalityKey, dimensionName);
  }

  @GET
  @Path("/{fqn}/dimensions")
  @Operation(
      operationId = "listAvailableDimensions",
      summary = "List available dimensions for a test case",
      description =
          "Get a list of available dimensions and their distinct values for a test case. "
              + "This helps in understanding what dimensional breakdowns are available for filtering.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Map of dimension names to their available values",
            content =
                @Content(
                    mediaType = "application/json",
                    examples = {
                      @ExampleObject(
                          value =
                              "{\"column\": [\"address\", \"email\", \"phone\"], \"tier\": [\"Bronze\", \"Silver\", \"Gold\"]}")
                    }))
      })
  public Map<String, List<String>> listAvailableDimensions(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the test case",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String testCaseFQN,
      @Parameter(
              description = "Start timestamp to list dimensions from",
              schema = @Schema(type = "number"))
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "End timestamp to list dimensions to",
              schema = @Schema(type = "number"))
          @QueryParam("endTs")
          Long endTs)
      throws IOException {
    TestCase testCase = getTestCase(testCaseFQN);
    ResourceContextInterface testCaseResourceContext =
        TestCaseResourceContext.builder().name(testCase.getFullyQualifiedName()).build();
    OperationContext testCaseOperationContext =
        new OperationContext(TEST_CASE, MetadataOperation.VIEW_ALL);
    ResourceContextInterface entityResourceContext =
        TestCaseResourceContext.builder()
            .entityLink(MessageParser.EntityLink.parse(testCase.getEntityLink()))
            .build();
    OperationContext entityOperationContext =
        new OperationContext(Entity.TABLE, MetadataOperation.VIEW_TESTS);

    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(testCaseOperationContext, testCaseResourceContext),
            new AuthRequest(entityOperationContext, entityResourceContext));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ANY);

    return repository.listAvailableDimensions(testCaseFQN, startTs, endTs);
  }

  private TestCase getTestCase(String fqn) {
    return Entity.getEntityByName(TEST_CASE, fqn, "", Include.ALL);
  }
}

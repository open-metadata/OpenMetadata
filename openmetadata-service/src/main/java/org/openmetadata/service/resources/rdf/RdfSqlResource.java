package org.openmetadata.service.resources.rdf;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import javax.validation.constraints.NotEmpty;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.rdf.sql2sparql.SqlToSparqlService;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/rdf/sql")
@Tag(name = "RDF SQL", description = "Execute SQL queries over RDF data")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "rdf-sql", order = 9)
@Slf4j
public class RdfSqlResource {

  @Context private UriInfo uriInfo;
  @Context private Authorizer authorizer;

  private SqlToSparqlService sqlToSparqlService;
  private boolean rdfEnabled;
  private OpenMetadataApplicationConfig config;

  public RdfSqlResource() {
    // Default constructor for resource creation
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.config = config;
    RdfConfiguration rdfConfig = config.getRdfConfiguration();
    this.rdfEnabled = rdfConfig != null && rdfConfig.getEnabled() != null && rdfConfig.getEnabled();

    if (rdfEnabled) {
      this.sqlToSparqlService = new SqlToSparqlService();
      this.sqlToSparqlService.initialize(rdfConfig);
    } else {
      this.sqlToSparqlService = null;
    }
  }

  @POST
  @Path("/query")
  @Operation(
      operationId = "executeSqlOverRdf",
      summary = "Execute SQL query over RDF data",
      description = "Translates SQL to SPARQL and executes against RDF store",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Query results",
            content = @Content(schema = @Schema(implementation = String.class))),
        @ApiResponse(responseCode = "400", description = "Invalid SQL query"),
        @ApiResponse(responseCode = "503", description = "RDF support not enabled")
      })
  public Response executeQuery(
      @Parameter(description = "SQL query to execute", required = true) @NotEmpty String sqlQuery,
      @Parameter(
              description = "Result format",
              schema =
                  @Schema(
                      allowableValues = {
                        "application/sparql-results+json",
                        "application/sparql-results+xml",
                        "text/csv",
                        "text/tab-separated-values"
                      }))
          @QueryParam("format")
          @DefaultValue("application/sparql-results+json")
          String format) {

    if (!rdfEnabled) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\": \"RDF support is not enabled\"}")
          .build();
    }

    try {
      LOG.debug("Executing SQL query over RDF: {}", sqlQuery);
      String results = sqlToSparqlService.executeQuery(sqlQuery, format);

      return Response.ok(results).type(format).build();

    } catch (Exception e) {
      LOG.error("Failed to execute SQL query", e);
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\": \"" + e.getMessage() + "\"}")
          .build();
    }
  }

  @POST
  @Path("/translate")
  @Operation(
      operationId = "translateSqlToSparql",
      summary = "Translate SQL to SPARQL",
      description = "Translates SQL query to SPARQL without executing",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "SPARQL translation",
            content = @Content(schema = @Schema(implementation = TranslationResponse.class))),
        @ApiResponse(responseCode = "400", description = "Invalid SQL query"),
        @ApiResponse(responseCode = "503", description = "RDF support not enabled")
      })
  public Response translateQuery(
      @Parameter(description = "SQL query to translate", required = true) @NotEmpty
          String sqlQuery) {

    if (!rdfEnabled) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity("{\"error\": \"RDF support is not enabled\"}")
          .build();
    }

    try {
      LOG.debug("Translating SQL to SPARQL: {}", sqlQuery);
      String sparqlQuery = sqlToSparqlService.translateOnly(sqlQuery);

      TranslationResponse response = new TranslationResponse();
      response.setSqlQuery(sqlQuery);
      response.setSparqlQuery(sparqlQuery);

      return Response.ok(response).build();

    } catch (Exception e) {
      LOG.error("Failed to translate SQL query", e);
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"error\": \"" + e.getMessage() + "\"}")
          .build();
    }
  }

  @Schema
  public static class TranslationResponse {
    @Schema(description = "Original SQL query")
    private String sqlQuery;

    @Schema(description = "Translated SPARQL query")
    private String sparqlQuery;

    public String getSqlQuery() {
      return sqlQuery;
    }

    public void setSqlQuery(String sqlQuery) {
      this.sqlQuery = sqlQuery;
    }

    public String getSparqlQuery() {
      return sparqlQuery;
    }

    public void setSparqlQuery(String sparqlQuery) {
      this.sparqlQuery = sparqlQuery;
    }
  }
}

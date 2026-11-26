package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.OntologyReleaseValidation;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseExportGateIT extends OntologyReleaseExportSupport {
  @Test
  void shaclGateExportsAValidReleaseUnchanged(TestNamespace ns) throws Exception {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "gate");
    declareClass(ontology, "Customer", CUSTOMER);
    OntologyRelease release = capture(ontology);

    String ungated = export(client, release.getId(), "turtle");
    HttpResponse<String> gated = rawExport(release.getId(), "&shaclGate=true", "text/turtle");
    assertEquals(200, gated.statusCode());
    assertTrue(gated.headers().firstValue("Content-Type").orElse("").startsWith("text/turtle"));
    assertFalse(gated.body().isBlank());
    assertTrue(parseTurtle(ungated).isIsomorphicWith(parseTurtle(gated.body())));
    assertTrue(
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/validation",
                null,
                OntologyReleaseValidation.class)
            .getValid());
  }

  @Test
  void shaclGateRefusesAReleaseThatDoesNotValidateAndTheUngatedExportStillSucceeds(TestNamespace ns)
      throws Exception {
    Ontology ontology = createOntology(ns, "gateInvalid");
    declareClass(ontology, "Customer", CUSTOMER);
    OntologyRelease release = captureWithOneValueEnumeration(ontology);

    HttpResponse<String> refused = rawExport(release.getId(), "&shaclGate=true", "text/turtle");
    assertEquals(422, refused.statusCode());
    assertTrue(
        refused.headers().firstValue("Content-Type").orElse("").startsWith("application/json"));
    assertTrue(refused.headers().firstValue("Content-Disposition").isEmpty());
    JsonNode report = JsonUtils.readTree(refused.body());
    assertFalse(report.get("valid").asBoolean());
    assertEquals(1, report.get("shacl").get("violationCount").asInt());

    HttpResponse<String> ungated = rawExport(release.getId(), "", "text/turtle");
    assertEquals(200, ungated.statusCode());
    assertTrue(ungated.headers().firstValue("Content-Disposition").isPresent());
  }

  private static OntologyRelease captureWithOneValueEnumeration(Ontology ontology) {
    var properties = SdkClients.adminClient().ontologyProperties();
    var gold = new OntologyLiteral().withValue("Gold");
    var created =
        properties.create(
            new CreateOntologyProperty()
                .withOntology(ontology.getFullyQualifiedName())
                .withName("tier")
                .withKind(OntologyPropertyKind.DATA)
                .withEnumValues(List.of(gold, new OntologyLiteral().withValue("Silver"))));
    var legacy = properties.get(created.getId().toString()).withEnumValues(List.of(gold));
    Entity.getCollectionDAO().ontologyPropertyDAO().update(legacy);
    EntityRepository.invalidateCacheForEntity(
        Entity.ONTOLOGY_PROPERTY, legacy.getId(), legacy.getFullyQualifiedName());
    return capture(ontology);
  }

  private static HttpResponse<String> rawExport(UUID releaseId, String options, String accept)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/ontologyReleases/"
                        + releaseId
                        + "/export?format=turtle"
                        + options))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", accept)
            .GET()
            .build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }
}

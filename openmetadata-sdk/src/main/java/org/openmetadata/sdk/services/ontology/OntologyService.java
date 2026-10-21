package org.openmetadata.sdk.services.ontology;

import java.util.UUID;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyWorkingDiff;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public final class OntologyService extends EntityServiceBase<Ontology> {
  public OntologyService(final HttpClient httpClient) {
    super(httpClient, "/v1/ontologies");
  }

  public Ontology create(final CreateOntology request) {
    return httpClient.execute(HttpMethod.POST, basePath, request, Ontology.class);
  }

  public Ontology upsert(final CreateOntology request) {
    return httpClient.execute(HttpMethod.PUT, basePath, request, Ontology.class);
  }

  public OntologyState state(final UUID id) {
    return httpClient.execute(
        HttpMethod.GET, basePath + "/" + id + "/state", null, OntologyState.class);
  }

  public OntologyWorkingDiff workingDiff(final UUID id, final int limit, final String after) {
    final var options = RequestOptions.builder().queryParam("limit", Integer.toString(limit));
    if (after != null) {
      options.queryParam("after", after);
    }
    return httpClient.execute(
        HttpMethod.GET,
        basePath + "/" + id + "/working/diff",
        null,
        OntologyWorkingDiff.class,
        options.build());
  }

  public CreateOntologyChangeSet previewImport(
      final UUID id, final PreviewNativeOntologyImport request) {
    return httpClient.execute(
        HttpMethod.POST,
        basePath + "/" + id + "/imports/preview",
        request,
        CreateOntologyChangeSet.class);
  }

  public OntologyRelease capture(final UUID id, final CaptureOntologyRelease request) {
    return httpClient.execute(
        HttpMethod.POST, basePath + "/" + id + "/releases", request, OntologyRelease.class);
  }

  public OntologyState activate(final UUID id, final ActivateOntologyRelease request) {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/" + id + "/activation", request, OntologyState.class);
  }

  @Override
  protected Class<Ontology> getEntityClass() {
    return Ontology.class;
  }
}

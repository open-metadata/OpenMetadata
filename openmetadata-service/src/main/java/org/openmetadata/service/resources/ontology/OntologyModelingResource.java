/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.ontology;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Objects;
import org.openmetadata.schema.api.data.OntologyIriPreview;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.ontology.OntologyIriMinter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/ontology/modeling")
@Tag(name = "Ontology Modeling", description = "Governed Ontology Studio modeling utilities.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "ontologyModeling", order = 8)
public final class OntologyModelingResource {
  private final Authorizer authorizer;
  private final OntologyIriMinter iriMinter;

  public OntologyModelingResource(final Authorizer authorizer) {
    this(authorizer, new OntologyIriMinter());
  }

  OntologyModelingResource(final Authorizer authorizer, final OntologyIriMinter iriMinter) {
    this.authorizer = Objects.requireNonNull(authorizer);
    this.iriMinter = Objects.requireNonNull(iriMinter);
  }

  @POST
  @Path("/iris/preview")
  @Operation(operationId = "previewOntologyIri", summary = "Preview a governed concept IRI")
  public OntologyIriPreview previewIri(
      @Context final SecurityContext securityContext,
      @Valid final OntologyIriPreviewRequest request) {
    final GlossaryRepository repository = glossaryRepository();
    final Glossary glossary =
        repository.get(null, request.getGlossaryId(), repository.getFields(""));
    authorizeView(securityContext, repository, glossary);
    return iriMinter.preview(glossary, request);
  }

  private void authorizeView(
      final SecurityContext securityContext,
      final GlossaryRepository repository,
      final Glossary glossary) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.GLOSSARY, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(Entity.GLOSSARY, glossary, repository));
  }

  private static GlossaryRepository glossaryRepository() {
    return (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
  }
}

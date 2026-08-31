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

package org.openmetadata.service.resources.rdf;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.rdf.RdfEntityTypeValidator;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Path("/v1/lod/entity")
@Tag(name = "Linked Data", description = "Authenticated dereferencing for OpenMetadata IRIs.")
@Collection(name = "lod", order = 10)
public final class LodResource {
  private static final String VARY = "Vary";
  private static final String ACCEPT = "Accept";
  private static final String RDF_ENTITY_PATH = "v1/rdf/entity";
  private static final List<NegotiatedFormat> FORMATS =
      List.of(
          format(RdfResource.TURTLE, RdfSerializationFormat.TURTLE),
          format(RdfResource.RDF_XML, RdfSerializationFormat.RDF_XML),
          format(RdfResource.N_TRIPLES, RdfSerializationFormat.N_TRIPLES),
          format(RdfResource.JSON_LD, RdfSerializationFormat.JSON_LD));

  private final Authorizer authorizer;

  public LodResource(final Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @GET
  @Path("/{entityType}/{id}")
  @Produces({RdfResource.TURTLE, RdfResource.RDF_XML, RdfResource.N_TRIPLES, RdfResource.JSON_LD})
  @Operation(
      operationId = "dereferenceEntityIri",
      summary = "Dereference an OpenMetadata entity IRI",
      description =
          "Returns a 303 redirect to the entity's authorized RDF representation, selected by "
              + "the Accept header. The endpoint is hidden unless dereferenceable IRIs are enabled.")
  public Response dereference(
      @Context final UriInfo uriInfo,
      @Context final HttpHeaders headers,
      @Context final SecurityContext securityContext,
      @PathParam("entityType") final String requestedEntityType,
      @PathParam("id") final UUID entityId) {
    requireEnabled();
    final String entityType = RdfEntityTypeValidator.requireKnown(requestedEntityType);
    authorizeView(securityContext, entityType, entityId);
    final RdfSerializationFormat format = negotiate(headers.getAcceptableMediaTypes());
    final URI location = representationUri(uriInfo, entityType, entityId, format);
    return Response.seeOther(location).header(VARY, ACCEPT).build();
  }

  private static void requireEnabled() {
    final Boolean enabled =
        OpenMetadataApplicationConfigHolder.getInstance()
            .getRdfConfiguration()
            .getDereferenceableIris();
    if (!Boolean.TRUE.equals(enabled)) {
      throw new NotFoundException("Dereferenceable IRIs are disabled");
    }
  }

  private void authorizeView(
      final SecurityContext securityContext, final String entityType, final UUID entityId) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(entityType, entityId, null));
  }

  static RdfSerializationFormat negotiate(final List<MediaType> acceptedMediaTypes) {
    RdfSerializationFormat selected = RdfSerializationFormat.JSON_LD;
    for (final MediaType accepted : acceptedMediaTypes) {
      final NegotiatedFormat match = matchingFormat(accepted);
      if (match != null) {
        selected = match.format();
        break;
      }
    }
    return selected;
  }

  private static NegotiatedFormat matchingFormat(final MediaType accepted) {
    return FORMATS.stream()
        .filter(candidate -> !accepted.isWildcardType() && !accepted.isWildcardSubtype())
        .filter(candidate -> accepted.isCompatible(candidate.mediaType()))
        .findFirst()
        .orElse(null);
  }

  private static URI representationUri(
      final UriInfo uriInfo,
      final String entityType,
      final UUID entityId,
      final RdfSerializationFormat format) {
    return uriInfo
        .getBaseUriBuilder()
        .path(RDF_ENTITY_PATH)
        .path(entityType)
        .path(entityId.toString())
        .queryParam("format", format.externalName())
        .build();
  }

  private static NegotiatedFormat format(
      final String mediaType, final RdfSerializationFormat format) {
    return new NegotiatedFormat(MediaType.valueOf(mediaType), format);
  }

  private record NegotiatedFormat(MediaType mediaType, RdfSerializationFormat format) {}
}

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
package org.openmetadata.service.resources.services;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.SecurityContext;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.services.ServiceHealth;
import org.openmetadata.schema.api.services.ServicesOverview;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ServiceHealthProvider;
import org.openmetadata.service.jdbi3.ServicesOverviewRepository;
import org.openmetadata.service.jdbi3.ServicesOverviewRequest;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Cross-service-type read APIs.
 *
 * <p>Deliberately not a {@code ServiceEntityResource}: that base class decrypts and masks every
 * listed row's connection config, which this view must never do. Being a plain resource makes that
 * structural rather than a convention someone can regress.
 */
@Path("/v1/services")
@Tag(
    name = "Services",
    description = "Cross-service-type APIs spanning every kind of service in one request.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "servicesOverview")
public class ServicesOverviewResource {
  private final Authorizer authorizer;
  private final ServicesOverviewRepository repository;

  public ServicesOverviewResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    this.repository =
        new ServicesOverviewRepository(new ServiceHealthProvider(Entity.getCollectionDAO()));
  }

  @GET
  @Path("/overview")
  @Operation(
      operationId = "getServicesOverview",
      summary = "Get service counts and one merged, name-sorted page of services",
      description =
          "Returns per-entity-type counts, a per-connector-type breakdown, an optional per-health-state "
              + "breakdown, and one page of services sorted by name across every requested service type. "
              + "Connection configuration is never returned.\n\n"
              + "Filter semantics: `q` narrows the count maps as well as the list. The three selectors "
              + "(`listEntityType`, `serviceType`, `health`) narrow only `data` and `paging.total`, so a "
              + "client can use each count map as the option list for its own filter control without that "
              + "control eating its own menu.\n\n"
              + "`offset` + `limit` must not exceed 10000; use the per-service-type list APIs with cursor "
              + "paging for deeper traversal.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Service counts and one page of services",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ServicesOverview.class)))
      })
  public ServicesOverview getOverview(
      @Context SecurityContext securityContext,
      @Parameter(
              description =
                  "Service entity types forming the universe for the count maps. Repeatable. Defaults to all.")
          @QueryParam("entityType")
          @Size(max = 32)
          Set<String> entityTypes,
      @Parameter(
              description =
                  "Restrict `data` to these service entity types. Repeatable. Defaults to the universe.")
          @QueryParam("listEntityType")
          @Size(max = 32)
          Set<String> listEntityTypes,
      @Parameter(description = "Connector type, e.g. `Snowflake`. Repeatable. Affects `data` only.")
          @QueryParam("serviceType")
          @Size(max = 32)
          Set<String> serviceTypes,
      @Parameter(
              description =
                  "Health state. Repeatable. Affects `data` only. Implies `includeHealth`.")
          @QueryParam("health")
          @Size(max = 32)
          Set<ServiceHealth> healths,
      @Parameter(description = "Case-insensitive substring match on name and displayName.")
          @QueryParam("q")
          @Size(max = 256)
          String q,
      @Parameter(description = "Compute per-service health. Costs three extra batched queries.")
          @QueryParam("includeHealth")
          @DefaultValue("false")
          boolean includeHealth,
      @QueryParam("limit") @DefaultValue("500") @Min(0) @Max(1000) int limit,
      @QueryParam("offset") @DefaultValue("0") @Min(0) int offset,
      @Parameter(description = "Sort direction on name.")
          @QueryParam("sortOrder")
          @DefaultValue("asc")
          String sortOrder,
      @QueryParam("include") @DefaultValue("non-deleted") Include include,
      @Parameter(description = "Fully qualified name of a domain to restrict results to.")
          @QueryParam("domain")
          String domain,
      @Parameter(description = "Exclude services with this provider, e.g. `system`.")
          @QueryParam("excludeProvider")
          ProviderType excludeProvider) {
    ServicesOverviewRequest request =
        toRequest(
            entityTypes,
            listEntityTypes,
            serviceTypes,
            healths,
            q,
            includeHealth,
            limit,
            offset,
            sortOrder,
            include,
            domain,
            excludeProvider);
    authorizer.authorizeRequests(
        securityContext, authRequests(request.entityTypes()), AuthorizationLogic.ANY);
    return repository.getOverview(securityContext, request);
  }

  private ServicesOverviewRequest toRequest(
      Set<String> entityTypes,
      Set<String> listEntityTypes,
      Set<String> serviceTypes,
      Set<ServiceHealth> healths,
      String q,
      boolean includeHealth,
      int limit,
      int offset,
      String sortOrder,
      Include include,
      String domain,
      ProviderType excludeProvider) {
    validateWindow(offset, limit);
    Set<String> universe = resolveUniverse(present(entityTypes));
    Set<String> listTypes = resolveListTypes(present(listEntityTypes), universe);
    Set<ServiceHealth> healthFilter = present(healths);
    return new ServicesOverviewRequest(
        universe,
        listTypes,
        present(serviceTypes),
        healthFilter,
        q,
        includeHealth || !healthFilter.isEmpty(),
        limit,
        offset,
        !DESCENDING.equalsIgnoreCase(sortOrder),
        include,
        resolveDomainId(domain),
        excludeProvider);
  }

  private static final String DESCENDING = "desc";

  /**
   * Normalizes a repeatable selector to the values actually selected.
   *
   * <p>A bare {@code ?health=} or {@code ?serviceType=} means "nothing selected", which for a filter
   * has to mean "no filter" rather than "match nothing" — an empty control must not blank the list.
   * JAX-RS renders that as a one-element set holding {@code null} for an enum param, or the empty
   * string for a string param, so both are dropped here rather than being pushed into a predicate.
   */
  private <T> Set<T> present(Set<T> values) {
    Set<T> result = Set.of();
    if (values != null) {
      result =
          values.stream()
              .filter(value -> value != null && !String.valueOf(value).isBlank())
              .collect(Collectors.toCollection(LinkedHashSet::new));
    }
    return result;
  }

  private void validateWindow(int offset, int limit) {
    if ((long) offset + limit > ServicesOverviewRequest.MAX_WINDOW) {
      throw new BadRequestException(
          String.format(
              "offset + limit must not exceed %d; use the per-service-type list APIs with cursor paging for deeper paging",
              ServicesOverviewRequest.MAX_WINDOW));
    }
  }

  private Set<String> resolveUniverse(Set<String> requested) {
    Set<String> all = new LinkedHashSet<>(Entity.getServiceEntityTypes());
    Set<String> universe = all;
    if (!nullOrEmpty(requested)) {
      rejectUnknown(requested, all);
      universe = new LinkedHashSet<>(requested);
    }
    return universe;
  }

  private Set<String> resolveListTypes(Set<String> requested, Set<String> universe) {
    Set<String> listTypes = universe;
    if (!nullOrEmpty(requested)) {
      rejectUnknown(requested, universe);
      listTypes = new LinkedHashSet<>(requested);
    }
    return listTypes;
  }

  private void rejectUnknown(Set<String> requested, Set<String> allowed) {
    for (String entityType : requested) {
      if (!allowed.contains(entityType)) {
        throw new BadRequestException(
            String.format(
                "%s is not a service entity type in this request's universe", entityType));
      }
    }
  }

  private UUID resolveDomainId(String domain) {
    UUID domainId = null;
    if (!nullOrEmpty(domain)) {
      EntityReference reference =
          Entity.getEntityReferenceByName(Entity.DOMAIN, domain, Include.NON_DELETED);
      domainId = reference == null ? null : reference.getId();
    }
    return domainId;
  }

  private List<AuthRequest> authRequests(Set<String> entityTypes) {
    return entityTypes.stream()
        .map(
            entityType ->
                new AuthRequest(
                    new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
                    new ResourceContext<>(entityType)))
        .toList();
  }
}

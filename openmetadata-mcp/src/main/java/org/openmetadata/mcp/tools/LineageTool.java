package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class LineageTool implements McpTool {
  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> params) {
    EntityReference fromEntity = resolveEndpoint(params.get(FROM_ENTITY), FROM_ENTITY);
    EntityReference toEntity = resolveEndpoint(params.get(TO_ENTITY), TO_ENTITY);

    authorizer.authorize(
        catalogSecurityContext,
        new OperationContext(fromEntity.getType(), MetadataOperation.EDIT_LINEAGE),
        new ResourceContext<>(fromEntity.getType(), fromEntity.getId(), fromEntity.getName()));
    authorizer.authorize(
        catalogSecurityContext,
        new OperationContext(toEntity.getType(), MetadataOperation.EDIT_LINEAGE),
        new ResourceContext<>(toEntity.getType(), toEntity.getId(), toEntity.getName()));

    LOG.info(
        "Creating lineage edge from {}.{} to {}.{}",
        fromEntity.getType(),
        fromEntity.getName(),
        toEntity.getType(),
        toEntity.getName());

    AddLineage lineage =
        new AddLineage()
            .withEdge(new EntitiesEdge().withFromEntity(fromEntity).withToEntity(toEntity));
    String updatedBy = catalogSecurityContext.getUserPrincipal().getName();
    Entity.getLineageRepository().addLineage(lineage, updatedBy);
    return Map.of("result", "Lineage Edge created successfully");
  }

  private static final String FROM_ENTITY = "fromEntity";
  private static final String TO_ENTITY = "toEntity";
  private static final String FQN = "fqn";
  private static final String FULLY_QUALIFIED_NAME = "fullyQualifiedName";

  /**
   * Accepts an endpoint by {@code fqn} as well as by {@code id}.
   *
   * <p>This was the only tool addressed by UUID; every other one takes {@code (entityType, fqn)}. A
   * caller holding a search result, which names assets by FQN, had to spend a lookup resolving an
   * id - and that is why UUIDs could not simply be dropped from search hits. {@code fqn} is an alias
   * for {@code fullyQualifiedName}, the name every other tool uses.
   */
  private static EntityReference resolveEndpoint(Object raw, String paramName) {
    Map<String, Object> endpoint = asEndpointMap(raw, paramName);
    String type = (String) endpoint.get("type");
    Object fqn = endpoint.containsKey(FQN) ? endpoint.get(FQN) : endpoint.get(FULLY_QUALIFIED_NAME);
    if (type == null || (endpoint.get("id") == null && fqn == null)) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter '%s' is required and must include 'type' plus either 'fqn' or 'id'."
                  + " Prefer 'fqn' - it is what search results return.",
              paramName));
    }
    EntityReference result;
    if (endpoint.get("id") != null) {
      endpoint.remove(FQN);
      result = JsonUtils.convertValue(endpoint, EntityReference.class);
    } else {
      result = Entity.getEntityReferenceByName(type, fqn.toString(), Include.NON_DELETED);
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asEndpointMap(Object raw, String paramName) {
    if (!(raw instanceof Map)) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter '%s' must be an object with 'type' and 'fqn' (or 'id')", paramName));
    }
    return new java.util.HashMap<>((Map<String, Object>) raw);
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> map)
      throws IOException {
    throw new UnsupportedOperationException("LineageTool does not require limit validation.");
  }
}

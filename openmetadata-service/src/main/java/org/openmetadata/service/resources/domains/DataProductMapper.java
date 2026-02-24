package org.openmetadata.service.resources.domains;

import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import java.util.List;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class DataProductMapper implements EntityMapper<DataProduct, CreateDataProduct> {
  @Override
  public DataProduct createToEntity(CreateDataProduct create, String user) {
    List<String> experts = create.getExperts();
    return copy(new DataProduct(), create, user)
        .withFullyQualifiedName(create.getName())
        .withStyle(create.getStyle())
        .withExperts(
            EntityUtil.validateAndPopulateEntityReferences(
                getEntityReferences(Entity.USER, experts)));
  }
}

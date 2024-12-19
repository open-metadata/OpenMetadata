package org.openmetadata.service.resources.domains;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class DataProductMapper implements EntityMapper<DataProduct, CreateDataProduct> {
  @Override
  public DataProduct createToEntity(CreateDataProduct create, String user) {
    List<String> experts = create.getExperts();
    DataProduct dataProduct =
        copy(new DataProduct(), create, user)
            .withFullyQualifiedName(create.getName())
            .withStyle(create.getStyle())
            .withExperts(
                EntityUtil.populateEntityReferences(getEntityReferences(Entity.USER, experts)));
    dataProduct.withAssets(new ArrayList<>());
    for (EntityReference asset : listOrEmpty(create.getAssets())) {
      asset = Entity.getEntityReference(asset, Include.NON_DELETED);
      dataProduct.getAssets().add(asset);
      dataProduct.getAssets().sort(EntityUtil.compareEntityReference);
    }
    return dataProduct;
  }
}

/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.database.IcebergConnection;
import org.openmetadata.schema.services.connections.database.iceberg.DynamoDbCatalogConnection;
import org.openmetadata.schema.services.connections.database.iceberg.GlueCatalogConnection;
import org.openmetadata.schema.services.connections.database.iceberg.HiveCatalogConnection;
import org.openmetadata.schema.services.connections.database.iceberg.IcebergCatalog;
import org.openmetadata.schema.services.connections.database.iceberg.RestCatalogConnection;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `IcebergConnection` object. */
public class IcebergConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONNECTION_CLASSES =
      // The GlueCatalogConnection has a subschema of the DynamoDbCatalogConnection
      List.of(
          GlueCatalogConnection.class,
          DynamoDbCatalogConnection.class,
          HiveCatalogConnection.class,
          RestCatalogConnection.class);

  public IcebergConnectionClassConverter() {
    super(IcebergConnection.class);
  }

  @Override
  public Object convert(Object object) {
    IcebergConnection icebergConnection =
        (IcebergConnection) JsonUtils.convertValue(object, this.clazz);

    IcebergCatalog icebergCatalog = icebergConnection.getCatalog();

    tryToConvertOrFail(icebergCatalog.getConnection(), CONNECTION_CLASSES)
        .ifPresent(icebergCatalog::setConnection);

    icebergConnection.setCatalog(icebergCatalog);

    return icebergConnection;
  }
}

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

import static org.openmetadata.service.secrets.converter.ElasticSearchConnectionClassConverter.CERTIFICATES;
import static org.openmetadata.service.secrets.converter.ElasticSearchConnectionClassConverter.SSL_CERTIFICATE_CLASSES;

import java.util.List;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.search.OpenSearchConnection;
import org.openmetadata.schema.services.connections.search.elasticSearch.ESBasicAuth;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `OpenSearchConnection` object. */
public class OpenSearchConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> CONFIG_SOURCE_CLASSES =
      List.of(ESBasicAuth.class, AWSCredentials.class);

  public OpenSearchConnectionClassConverter() {
    super(OpenSearchConnection.class);
  }

  @Override
  public Object convert(Object object) {
    OpenSearchConnection openSearchConnection =
        (OpenSearchConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvert(openSearchConnection.getAuthType(), CONFIG_SOURCE_CLASSES)
        .ifPresent(openSearchConnection::setAuthType);

    // `SSLConfig.certificates` is a oneOf of its own, so it needs a second converter pass.
    if (openSearchConnection.getSslConfig() != null) {
      convertProperty(openSearchConnection.getSslConfig(), CERTIFICATES, SSL_CERTIFICATE_CLASSES);
    }

    return openSearchConnection;
  }
}

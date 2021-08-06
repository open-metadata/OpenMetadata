/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog;


import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import io.dropwizard.testing.junit5.DropwizardExtensionsSupport;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.catalog.resources.EmbeddedMySqlSupport;

import javax.ws.rs.client.WebTarget;

@ExtendWith(EmbeddedMySqlSupport.class)
@ExtendWith(DropwizardExtensionsSupport.class)
public abstract class CatalogApplicationTest {
  private static final String CONFIG_PATH;
  public static final DropwizardAppExtension<CatalogApplicationConfig> APP;

  static {
    CONFIG_PATH = ResourceHelpers.resourceFilePath("catalog-secure-test.yaml");
    APP = new DropwizardAppExtension<>(CatalogApplication.class, CONFIG_PATH);
  }

  public static WebTarget getResource(String collection) {
    String targetURI = "http://localhost:" + APP.getLocalPort() + "/api/v1/" + collection;
    return APP.client().target(targetURI);
  }
}
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

package org.openmetadata.catalog.resources;

import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.type.CollectionDescriptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotEquals;

public class CollectionRegistryTest {
  private static final Logger LOG = LoggerFactory.getLogger(CollectionRegistryTest.class);

  @Test
  public void testCollections() {
    CollectionRegistry.getInstance();
    Map<String, CollectionRegistry.CollectionDetails> descriptors = CollectionRegistry.getInstance().getCollectionMap();
    String path = "/v1";
    CollectionRegistry.CollectionDetails parent = descriptors.get(path);
    CollectionDescriptor[] children = parent.getChildCollections();
    assertNotEquals(0, children.length);

    path = "/v1/services";
    parent = descriptors.get(path);
    children = parent.getChildCollections();
    assertNotEquals(0, children.length);
  }
}

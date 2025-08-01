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

package org.openmetadata.service.resources.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.domains.DomainResourceTest;
import org.openmetadata.service.util.ResultList;

@Slf4j
public abstract class ServiceResourceTest<T extends EntityInterface, K extends CreateEntity>
    extends EntityResourceTest<T, K> {
  public ServiceResourceTest(
      String entityType,
      Class<T> entityClass,
      Class<? extends ResultList<T>> entityListClass,
      String collectionName,
      String fields) {
    super(entityType, entityClass, entityListClass, collectionName, fields);
    this.supportsPatch = false;
  }

  @Test
  void test_listWithDomainFilter(TestInfo test) throws HttpResponseException {
    DomainResourceTest domainTest = new DomainResourceTest();
    String domain1 =
        domainTest
            .createEntity(domainTest.createRequest(test, 1), ADMIN_AUTH_HEADERS)
            .getFullyQualifiedName();
    String domain2 =
        domainTest
            .createEntity(domainTest.createRequest(test, 2), ADMIN_AUTH_HEADERS)
            .getFullyQualifiedName();

    K c1 = createRequest(test, 1);
    c1.setDomains(List.of(domain1, domain2));
    T s1 = createEntity(c1, ADMIN_AUTH_HEADERS);

    K c2 = createRequest(test, 2);
    c2.setDomains(List.of(domain1));
    T s2 = createEntity(c2, ADMIN_AUTH_HEADERS);

    K c3 = createRequest(test, 3);
    c3.setDomains(List.of(domain2));
    T s3 = createEntity(c3, ADMIN_AUTH_HEADERS);

    K c4 = createRequest(test, 4);
    c4.setDomains(List.of(domain2));
    T s4 = createEntity(c4, ADMIN_AUTH_HEADERS);

    Map<String, String> params = new HashMap<>();
    params.put("domain", domain1);
    List<T> list = listEntities(params, ADMIN_AUTH_HEADERS).getData();
    assertEquals(2, list.size());
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(s1.getName())));
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(s2.getName())));

    params.put("domain", domain2);
    list = listEntities(params, ADMIN_AUTH_HEADERS).getData();
    assertEquals(3, list.size()); // appears in c1, c3 and c4
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(s3.getName())));
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(s4.getName())));
  }
}

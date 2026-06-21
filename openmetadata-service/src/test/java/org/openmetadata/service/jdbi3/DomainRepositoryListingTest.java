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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Guards the domain-listing query shape at scale. With ~20k nested domains, the cold landing-page
 * call ({@code GET /domains/assets/counts}) and the hierarchy tree previously resolved every
 * domain's parent and counted descendants one query at a time (N+1). These tests assert that a
 * page of domains issues no per-domain parent lookup unless owners/experts are requested, and that
 * {@code childrenCount} collapses to a single scan per parent instead of one {@code COUNT(*)} each.
 */
class DomainRepositoryListingTest {

  private CollectionDAO daoCollection;
  private CollectionDAO.DomainDAO domainDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private DomainRepository repository;

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    domainDAO = mock(CollectionDAO.DomainDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(daoCollection.domainDAO()).thenReturn(domainDAO);
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);
    Entity.setCollectionDAO(daoCollection);
    repository = new DomainRepository();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void listingWithoutInheritableFields_issuesNoPerDomainParentOrCountQueries() {
    List<Domain> domains = new ArrayList<>();
    for (int i = 0; i < 8; i++) {
      domains.add(domain("perf.d" + i));
    }

    repository.setFieldsInBulk(new Fields(Set.of()), domains);

    verify(relationshipDAO, never()).findFrom(any(UUID.class), anyString(), anyInt(), anyString());
    verify(relationshipDAO, never()).findFrom(any(UUID.class), anyString(), anyInt());
    verify(domainDAO, never()).countNestedDomains(anyString());
    verify(domainDAO, never()).listFqnHashesByPrefix(anyString());
    verify(domainDAO, never()).listAllFqnHashes();
    domains.forEach(domain -> assertNull(domain.getParent()));
  }

  @Test
  void childrenCount_isBatchedIntoOneScanPerParent() {
    Domain c0 = domain("perf.p.c0");
    Domain c1 = domain("perf.p.c1");
    String parentPrefix = FullyQualifiedName.buildHash("perf.p");
    List<String> descendants =
        List.of(
            FullyQualifiedName.buildHash("perf.p.c0"),
            FullyQualifiedName.buildHash("perf.p.c1"),
            FullyQualifiedName.buildHash("perf.p.c0.g0"),
            FullyQualifiedName.buildHash("perf.p.c0.g1"));
    when(domainDAO.listFqnHashesByPrefix(parentPrefix + ".%")).thenReturn(descendants);

    repository.setFieldsInBulk(
        new Fields(Set.of("childrenCount")), new ArrayList<>(List.of(c0, c1)));

    verify(domainDAO, times(1)).listFqnHashesByPrefix(parentPrefix + ".%");
    verify(domainDAO, never()).countNestedDomains(anyString());
    verify(domainDAO, never()).listAllFqnHashes();
    assertEquals(2, c0.getChildrenCount());
    assertEquals(0, c1.getChildrenCount());
  }

  @Test
  void childrenCount_forPageUnderCommonAncestor_usesOneSelectiveScan() {
    Domain c1 = domain("org.p1.c1");
    Domain c2 = domain("org.p2.c2");
    String commonAncestor = FullyQualifiedName.buildHash("org");
    when(domainDAO.listFqnHashesByPrefix(commonAncestor + ".%"))
        .thenReturn(
            List.of(
                FullyQualifiedName.buildHash("org.p1.c1"),
                FullyQualifiedName.buildHash("org.p2.c2"),
                FullyQualifiedName.buildHash("org.p1.c1.g")));

    repository.setFieldsInBulk(
        new Fields(Set.of("childrenCount")), new ArrayList<>(List.of(c1, c2)));

    // Domains under different parents but a shared top-level ancestor collapse to one selective
    // scan under that ancestor, not a full table scan.
    verify(domainDAO, times(1)).listFqnHashesByPrefix(commonAncestor + ".%");
    verify(domainDAO, never()).listAllFqnHashes();
    verify(domainDAO, never()).countNestedDomains(anyString());
    assertEquals(1, c1.getChildrenCount());
    assertEquals(0, c2.getChildrenCount());
  }

  @Test
  void childrenCount_forPageSpanningUnrelatedRoots_fallsBackToFullScan() {
    Domain a = domain("alpha.x");
    Domain b = domain("beta.y");
    when(domainDAO.listAllFqnHashes())
        .thenReturn(
            List.of(
                FullyQualifiedName.buildHash("alpha.x"),
                FullyQualifiedName.buildHash("beta.y"),
                FullyQualifiedName.buildHash("alpha.x.g")));

    repository.setFieldsInBulk(new Fields(Set.of("childrenCount")), new ArrayList<>(List.of(a, b)));

    // No shared ancestor across top-level domains → one full scan (still a single query).
    verify(domainDAO, times(1)).listAllFqnHashes();
    verify(domainDAO, never()).listFqnHashesByPrefix(anyString());
    assertEquals(1, a.getChildrenCount());
    assertEquals(0, b.getChildrenCount());
  }

  private Domain domain(String fqn) {
    String name = fqn.substring(fqn.lastIndexOf('.') + 1);
    return new Domain().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(fqn);
  }
}

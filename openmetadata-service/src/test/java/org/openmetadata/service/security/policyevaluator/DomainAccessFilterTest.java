/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * Unit tests for {@link DomainAccessFilter}, built on real {@link SubjectContext} instances so the
 * domain-hierarchy matching is exercised rather than stubbed. Users carry no teams, which keeps the
 * role lookup off the team hierarchy and out of the entity registry.
 */
class DomainAccessFilterTest {

  private static final String DOMAIN_ONLY_ACCESS_ROLE = "DomainOnlyAccessRole";
  private static final String OWN_DOMAIN = "Engineering";
  private static final String SUB_DOMAIN = "Engineering.Backend";
  private static final String FOREIGN_DOMAIN = "Finance";

  @Test
  @DisplayName("shouldApply: only non-admin subjects holding DomainOnlyAccessRole")
  void testShouldApply() {
    assertFalse(DomainAccessFilter.shouldApply(null), "a null subject narrows nothing");
    assertTrue(DomainAccessFilter.shouldApply(restrictedSubject(OWN_DOMAIN)));
    assertFalse(DomainAccessFilter.shouldApply(subjectWithoutRole()));

    User admin = restrictedUser(OWN_DOMAIN).withIsAdmin(true);
    assertFalse(DomainAccessFilter.shouldApply(new SubjectContext(admin, null)));
  }

  @Test
  @DisplayName("shouldApply: a bot holding the role is narrowed like any other subject (#30023)")
  void testShouldApplyToBots() {
    User restrictedBot = restrictedUser(OWN_DOMAIN).withIsBot(true);
    assertTrue(
        DomainAccessFilter.shouldApply(new SubjectContext(restrictedBot, null)),
        "a bot assigned DomainOnlyAccessRole must be narrowed, not exempted");

    User plainBot = userWithoutRole().withIsBot(true);
    assertFalse(
        DomainAccessFilter.shouldApply(new SubjectContext(plainBot, null)),
        "a bot without the role is untouched, so stock bots keep their current view");

    User adminBot = restrictedUser(OWN_DOMAIN).withIsBot(true).withIsAdmin(true);
    assertFalse(DomainAccessFilter.shouldApply(new SubjectContext(adminBot, null)));
  }

  @Test
  @DisplayName("isAccessible: a subject that is not narrowed sees every domain")
  void testIsAccessibleWithoutNarrowing() {
    assertTrue(DomainAccessFilter.isAccessible(null, List.of(domainRef(FOREIGN_DOMAIN))));
    assertTrue(
        DomainAccessFilter.isAccessible(subjectWithoutRole(), List.of(domainRef(FOREIGN_DOMAIN))));
  }

  @Test
  @DisplayName("isAccessible: own domain and its sub-domains pass, a foreign domain does not")
  void testIsAccessibleWhenNarrowed() {
    SubjectContext restricted = restrictedSubject(OWN_DOMAIN);

    assertTrue(DomainAccessFilter.isAccessible(restricted, List.of(domainRef(OWN_DOMAIN))));
    assertTrue(
        DomainAccessFilter.isAccessible(restricted, List.of(domainRef(SUB_DOMAIN))),
        "a parent-domain subject reaches its sub-domains");
    assertFalse(DomainAccessFilter.isAccessible(restricted, List.of(domainRef(FOREIGN_DOMAIN))));
    assertFalse(
        DomainAccessFilter.isAccessible(
            restrictedSubject(SUB_DOMAIN), List.of(domainRef(OWN_DOMAIN))),
        "a sub-domain subject does not reach the parent domain");
  }

  @Test
  @DisplayName("isAccessible: a domainless entity stays visible, matching hasDomain()")
  void testIsAccessibleForDomainlessEntity() {
    assertTrue(DomainAccessFilter.isAccessible(restrictedSubject(OWN_DOMAIN), null));
    assertTrue(DomainAccessFilter.isAccessible(restrictedSubject(OWN_DOMAIN), List.of()));
  }

  @Test
  @DisplayName("isAccessible: a subject with no domains of its own sees only domainless entities")
  void testIsAccessibleWhenSubjectHasNoDomains() {
    SubjectContext restricted = new SubjectContext(restrictedUser(), null);

    assertTrue(DomainAccessFilter.isAccessible(restricted, List.of()));
    assertFalse(DomainAccessFilter.isAccessible(restricted, List.of(domainRef(OWN_DOMAIN))));
  }

  @Test
  @DisplayName("retainAccessible: keeps own-domain, sub-domain and domainless entities")
  void testRetainAccessibleNarrows() {
    List<Table> tables =
        List.of(
            table("own", OWN_DOMAIN),
            table("sub", SUB_DOMAIN),
            table("foreign", FOREIGN_DOMAIN),
            table("domainless"));

    List<Table> visible =
        DomainAccessFilter.retainAccessible(tables, restrictedSubject(OWN_DOMAIN));

    assertEquals(
        List.of("own", "sub", "domainless"), visible.stream().map(Table::getName).toList());
  }

  @Test
  @DisplayName("retainAccessible: a subject that is not narrowed keeps every entity")
  void testRetainAccessibleWithoutNarrowing() {
    List<Table> tables = List.of(table("own", OWN_DOMAIN), table("foreign", FOREIGN_DOMAIN));

    assertEquals(2, DomainAccessFilter.retainAccessible(tables, subjectWithoutRole()).size());
    assertEquals(2, DomainAccessFilter.retainAccessible(tables, null).size());
  }

  @Test
  @DisplayName("retainAccessible: null input yields an empty list, never null")
  void testRetainAccessibleWithNullInput() {
    assertTrue(DomainAccessFilter.retainAccessible(null, restrictedSubject(OWN_DOMAIN)).isEmpty());
    assertTrue(DomainAccessFilter.retainAccessible(null, null).isEmpty());
  }

  @Test
  @DisplayName("retainAccessible: the caller never gets a handle on a mutable backing list")
  void testRetainAccessibleReturnsImmutableList() {
    List<Table> tables = new ArrayList<>(List.of(table("own", OWN_DOMAIN)));

    List<Table> unfiltered = DomainAccessFilter.retainAccessible(tables, subjectWithoutRole());
    assertThrows(UnsupportedOperationException.class, () -> unfiltered.add(table("added")));

    List<Table> filtered =
        DomainAccessFilter.retainAccessible(tables, restrictedSubject(OWN_DOMAIN));
    assertThrows(UnsupportedOperationException.class, () -> filtered.add(table("added")));
  }

  private SubjectContext restrictedSubject(String... domains) {
    return new SubjectContext(restrictedUser(domains), null);
  }

  private SubjectContext subjectWithoutRole() {
    return new SubjectContext(userWithoutRole(), null);
  }

  private User userWithoutRole() {
    return new User().withName("plain").withDomains(List.of());
  }

  private User restrictedUser(String... domains) {
    return new User()
        .withName("restricted")
        .withRoles(
            List.of(new EntityReference().withName(DOMAIN_ONLY_ACCESS_ROLE).withType(Entity.ROLE)))
        .withDomains(List.of(domains).stream().map(DomainAccessFilterTest::domainRef).toList());
  }

  private Table table(String name, String... domains) {
    return new Table()
        .withName(name)
        .withDomains(List.of(domains).stream().map(DomainAccessFilterTest::domainRef).toList());
  }

  private static EntityReference domainRef(String fqn) {
    return new EntityReference().withFullyQualifiedName(fqn).withType(Entity.DOMAIN);
  }
}

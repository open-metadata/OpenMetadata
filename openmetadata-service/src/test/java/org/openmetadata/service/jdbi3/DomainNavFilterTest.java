package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class DomainNavFilterTest {
  private static final String DOMAIN_ID = "11111111-1111-1111-1111-111111111111";

  @Test
  void shouldApply_dataAssetWithSelectedDomain() {
    assertTrue(DomainNavFilter.shouldApply(Entity.TABLE, true, false, DOMAIN_ID));
  }

  @Test
  void shouldNotApply_forExcludedType() {
    // user/team/tag/classification support domains but their lists are reference/settings surfaces.
    assertFalse(DomainNavFilter.shouldApply(Entity.USER, true, false, DOMAIN_ID));
    assertFalse(DomainNavFilter.shouldApply(Entity.TAG, true, false, DOMAIN_ID));
    assertFalse(DomainNavFilter.shouldApply(Entity.TEST_CASE, true, false, DOMAIN_ID));
  }

  @Test
  void shouldNotApply_whenEntityDoesNotSupportDomains() {
    assertFalse(DomainNavFilter.shouldApply(Entity.ROLE, false, false, DOMAIN_ID));
  }

  @Test
  void shouldNotApply_whenExplicitDomainAlreadyPresent() {
    // Backward-compat: an explicit ?domain= caller keeps control.
    assertFalse(DomainNavFilter.shouldApply(Entity.TABLE, true, true, DOMAIN_ID));
  }

  @Test
  void shouldNotApply_whenNoDomainSelected() {
    assertFalse(DomainNavFilter.shouldApply(Entity.TABLE, true, false, null));
    assertFalse(DomainNavFilter.shouldApply(Entity.TABLE, true, false, ""));
  }

  @Test
  void apply_explicitDomainEchoingTheSelectionGetsDescendantMatching() {
    // The UI sends the navbar pick as ?domain= on every list call; resources quote the id.
    ListFilter filter = new ListFilter();
    filter.addQueryParam("domainId", "'" + DOMAIN_ID + "'");
    DomainNavFilter.apply(filter, Entity.TABLE, true, DOMAIN_ID, "hAlpha");
    assertEquals(DOMAIN_ID, filter.getQueryParams().get("domainId"));
    assertEquals("hAlpha", filter.getQueryParams().get("domainFqnHash"));
  }

  @Test
  void apply_explicitOtherDomainKeepsControl() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("domainId", "'22222222-2222-2222-2222-222222222222'");
    DomainNavFilter.apply(filter, Entity.TABLE, true, DOMAIN_ID, "hAlpha");
    assertEquals("'22222222-2222-2222-2222-222222222222'", filter.getQueryParams().get("domainId"));
    assertNull(filter.getQueryParams().get("domainFqnHash"));
  }

  @Test
  void apply_stampsSelectedDomainHashForDescendantMatching() {
    ListFilter filter = new ListFilter();
    DomainNavFilter.apply(filter, Entity.TABLE, true, DOMAIN_ID, "hAlpha");
    assertEquals(DOMAIN_ID, filter.getQueryParams().get("domainId"));
    assertEquals("hAlpha", filter.getQueryParams().get("domainFqnHash"));
  }

  @Test
  void apply_unresolvedParentListsChildrenInFull() {
    ListFilter filter = new ListFilter();
    DomainNavFilter.apply(
        filter, Entity.TABLE, true, DOMAIN_ID, "hAlpha", DomainNavFilter.ParentScope.UNRESOLVED);
    assertNull(filter.getQueryParams().get("domainId"));
  }

  @Test
  void apply_unresolvedParentDropsTheEchoedSelection() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("domainId", "'" + DOMAIN_ID + "'");
    DomainNavFilter.apply(
        filter, Entity.TABLE, true, DOMAIN_ID, "hAlpha", DomainNavFilter.ParentScope.UNRESOLVED);
    assertNull(filter.getQueryParams().get("domainId"));
  }

  @Test
  void apply_parentInSelectionMatchesOwnDomainOrInheritedFromParent() {
    ListFilter filter = new ListFilter();
    DomainNavFilter.apply(
        filter, Entity.TABLE, true, DOMAIN_ID, "hAlpha", DomainNavFilter.ParentScope.IN_SELECTION);
    assertEquals(DOMAIN_ID, filter.getQueryParams().get("domainId"));
    assertEquals("hAlpha", filter.getQueryParams().get("domainFqnHash"));
    // own domain in the selection, or no own domain (inherits the parent's)
    assertEquals("true", filter.getQueryParams().get("domainAccessControl"));
  }

  @Test
  void apply_parentOutsideSelectionMatchesOwnDomainOnly() {
    ListFilter filter = new ListFilter();
    DomainNavFilter.apply(
        filter,
        Entity.TABLE,
        true,
        DOMAIN_ID,
        "hAlpha",
        DomainNavFilter.ParentScope.OUTSIDE_SELECTION);
    assertEquals(DOMAIN_ID, filter.getQueryParams().get("domainId"));
    assertNull(filter.getQueryParams().get("domainAccessControl"));
  }

  @Test
  void apply_parentScopedEchoIsReplacedByTheEffectiveDomainCondition() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("domainId", "'" + DOMAIN_ID + "'");
    DomainNavFilter.apply(
        filter,
        Entity.GLOSSARY_TERM,
        true,
        DOMAIN_ID,
        "hAlpha",
        DomainNavFilter.ParentScope.IN_SELECTION);
    assertEquals(DOMAIN_ID, filter.getQueryParams().get("domainId"));
    assertEquals("true", filter.getQueryParams().get("domainAccessControl"));
  }

  @Test
  void apply_parentScopedListKeepsAnExplicitOtherDomain() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("domainId", "'22222222-2222-2222-2222-222222222222'");
    DomainNavFilter.apply(
        filter,
        Entity.DATABASE,
        true,
        DOMAIN_ID,
        "hAlpha",
        DomainNavFilter.ParentScope.IN_SELECTION);
    assertEquals("'22222222-2222-2222-2222-222222222222'", filter.getQueryParams().get("domainId"));
    assertNull(filter.getQueryParams().get("domainAccessControl"));
  }

  @Test
  void apply_doesNotStampEntityType() {
    // entityType is a list param with resource-specific meaning (e.g. the type of the entity a
    // list is "about"); the domain condition doesn't need it, so the filter must not add it.
    ListFilter filter = new ListFilter();
    DomainNavFilter.apply(filter, Entity.TABLE, true, DOMAIN_ID, "hAlpha");
    assertEquals(DOMAIN_ID, filter.getQueryParams().get("domainId"));
    assertNull(filter.getQueryParams().get("entityType"));
  }
}

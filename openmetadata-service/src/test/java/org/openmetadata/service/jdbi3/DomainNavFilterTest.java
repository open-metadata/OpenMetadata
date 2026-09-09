package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
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
}

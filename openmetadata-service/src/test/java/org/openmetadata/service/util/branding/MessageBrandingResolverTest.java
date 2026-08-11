package org.openmetadata.service.util.branding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;

class MessageBrandingResolverTest {

  @Test
  void testResolverReturnsNonNull() {
    assertNotNull(MessageBrandingResolver.get());
  }

  @Test
  void testDefaultProductName() {
    assertEquals("OpenMetadata", MessageBrandingResolver.get().getProductName());
  }

  @Test
  void testDefaultLogoUrl() {
    assertEquals(
        "https://cdn.getcollate.io/omd_logo192.png", MessageBrandingResolver.get().getLogoUrl());
  }

  @Test
  void testDefaultPriority() {
    assertEquals(0, MessageBrandingResolver.get().getPriority());
  }
}

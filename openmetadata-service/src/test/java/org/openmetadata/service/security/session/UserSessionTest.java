package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class UserSessionTest {

  /** An older pod does not know the field, so a single-host session must not mention it. */
  @Test
  void omitsIdpRedirectUriWhenUnset() {
    String json = JsonUtils.pojoToJson(UserSession.builder().id("session-1").build());

    assertFalse(json.contains("idpRedirectUri"));
  }

  @Test
  void roundTripsIdpRedirectUri() {
    UserSession session =
        UserSession.builder()
            .id("session-1")
            .idpRedirectUri("https://dr.example.com/callback")
            .build();

    UserSession read = JsonUtils.readValue(JsonUtils.pojoToJson(session), UserSession.class);

    assertEquals("https://dr.example.com/callback", read.getIdpRedirectUri());
  }

  /** A session written by a newer build must still load on an older pod mid rolling upgrade. */
  @Test
  void ignoresPropertiesItDoesNotKnow() {
    UserSession read =
        JsonUtils.readValue(
            "{\"id\":\"session-1\",\"addedByANewerBuild\":\"value\"}", UserSession.class);

    assertEquals("session-1", read.getId());
    assertNull(read.getIdpRedirectUri());
  }
}

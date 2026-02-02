package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

public class ValidationHttpUtilTest {

  @Test
  void testHttpResponseData_WithStatusAndBody() {
    ValidationHttpUtil.HttpResponseData response =
        new ValidationHttpUtil.HttpResponseData(200, "success");

    assertEquals(200, response.getStatusCode());
    assertEquals("success", response.getBody());
    assertNull(response.getLocationHeader());
  }

  @Test
  void testHttpResponseData_WithAllFields() {
    ValidationHttpUtil.HttpResponseData response =
        new ValidationHttpUtil.HttpResponseData(302, "redirect", "https://example.com/redirect");

    assertEquals(302, response.getStatusCode());
    assertEquals("redirect", response.getBody());
    assertEquals("https://example.com/redirect", response.getLocationHeader());
  }

  @Test
  void testHttpResponseData_WithNullBody() {
    ValidationHttpUtil.HttpResponseData response =
        new ValidationHttpUtil.HttpResponseData(404, null);

    assertEquals(404, response.getStatusCode());
    assertEquals("", response.getBody());
    assertNull(response.getLocationHeader());
  }

  @Test
  void testCreateBasicAuthHeader_ValidCredentials() {
    String header = ValidationHttpUtil.createBasicAuthHeader("admin", "password123");

    assertNotNull(header);
    assertTrue(header.startsWith("Basic "));
    assertEquals("Basic YWRtaW46cGFzc3dvcmQxMjM=", header);
  }

  @Test
  void testCreateBasicAuthHeader_WithSpecialCharacters() {
    String header = ValidationHttpUtil.createBasicAuthHeader("user@example.com", "p@ss:word!");

    assertNotNull(header);
    assertTrue(header.startsWith("Basic "));
    assertEquals("Basic dXNlckBleGFtcGxlLmNvbTpwQHNzOndvcmQh", header);
  }

  @Test
  void testCreateBasicAuthHeader_EmptyPassword() {
    String header = ValidationHttpUtil.createBasicAuthHeader("user", "");

    assertNotNull(header);
    assertTrue(header.startsWith("Basic "));
    assertEquals("Basic dXNlcjo=", header);
  }

  @Test
  void testCreateBearerAuthHeader_ValidToken() {
    String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    String header = ValidationHttpUtil.createBearerAuthHeader(token);

    assertNotNull(header);
    assertEquals("Bearer " + token, header);
  }

  @Test
  void testCreateBearerAuthHeader_EmptyToken() {
    String header = ValidationHttpUtil.createBearerAuthHeader("");

    assertNotNull(header);
    assertEquals("Bearer ", header);
  }

  @Test
  void testValidateUrl_InvalidUrl() {
    assertThrows(
        IllegalArgumentException.class, () -> ValidationHttpUtil.validateUrl("not-a-valid-url"));
  }

  @Test
  void testValidateUrl_InvalidScheme() {
    assertThrows(
        IllegalArgumentException.class, () -> ValidationHttpUtil.validateUrl("ftp://example.com"));
  }

  @Test
  void testValidateUrl_EmptyUrl() {
    assertThrows(IllegalArgumentException.class, () -> ValidationHttpUtil.validateUrl(""));
  }

  @Test
  void testValidateUrl_NullUrl() {
    assertThrows(IllegalArgumentException.class, () -> ValidationHttpUtil.validateUrl(null));
  }
}

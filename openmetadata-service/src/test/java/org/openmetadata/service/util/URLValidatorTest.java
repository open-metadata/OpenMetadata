package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;

public class URLValidatorTest {

  @Test
  void testValidPublicUrls() {
    assertDoesNotThrow(() -> URLValidator.validateURL("https://example.com"));
    assertDoesNotThrow(() -> URLValidator.validateURL("http://example.com"));
    assertDoesNotThrow(
        () ->
            URLValidator.validateURL(
                "https://dev-96705996-admin.okta.com/.well-known/openid-configuration"));
    assertDoesNotThrow(() -> URLValidator.validateURL("https://api.github.com/repos"));
  }

  @Test
  void testValidOktaUrlsWithFdPrefix() {
    assertDoesNotThrow(
        () -> URLValidator.validateURL("https://fdxxx.okta.com/.well-known/openid-configuration"));
    assertDoesNotThrow(
        () -> URLValidator.validateURL("https://fd123.okta.com/.well-known/openid-configuration"));
    assertDoesNotThrow(
        () ->
            URLValidator.validateURL("https://fd-test.okta.com/.well-known/openid-configuration"));
    assertDoesNotThrow(() -> URLValidator.validateURL("https://fddomain.example.com/api"));
  }

  @Test
  void testValidUrlsWithFcPrefix() {
    assertDoesNotThrow(() -> URLValidator.validateURL("https://fcdomain.com/api"));
    assertDoesNotThrow(() -> URLValidator.validateURL("https://fc123.example.com"));
  }

  @Test
  void testValidUrlsWithFe80Prefix() {
    assertDoesNotThrow(() -> URLValidator.validateURL("https://fe80-test.com/api"));
    assertDoesNotThrow(() -> URLValidator.validateURL("https://fe80domain.example.com"));
  }

  @Test
  void testPrivateIpv4AddressesBlocked() {
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://127.0.0.1"));
    assertThrows(
        BadRequestException.class, () -> URLValidator.validateURL("http://127.0.0.1:8080/api"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://10.0.0.1"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://10.1.2.3:80"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://172.16.0.1"));
    assertThrows(
        BadRequestException.class, () -> URLValidator.validateURL("http://172.31.255.255"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://192.168.1.1"));
    assertThrows(
        BadRequestException.class, () -> URLValidator.validateURL("http://192.168.0.1:3000"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://169.254.1.1"));
    assertThrows(
        BadRequestException.class, () -> URLValidator.validateURL("http://169.254.169.254"));
  }

  @Test
  void testPrivateIpv6AddressesBlocked() {
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[::1]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[::1]:8080"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fc00::]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fc00::1]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fcaa::1]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fd00::]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fd00::1]"));
    assertThrows(
        BadRequestException.class, () -> URLValidator.validateURL("http://[fd12:3456:789a::]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fe80::]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fe80::1]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[fe8a::1]"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://[feb0::1]"));
  }

  @Test
  void testInvalidUrlSchemes() {
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("ftp://example.com"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("file:///etc/passwd"));
    assertThrows(
        BadRequestException.class, () -> URLValidator.validateURL("javascript:alert('xss')"));
  }

  @Test
  void testEmptyAndNullUrls() {
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL(null));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL(""));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("   "));
  }

  @Test
  void testMalformedUrls() {
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("not a url"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("://example.com"));
  }

  /**
   * Internal targets whose host text does not look like a private IP, so the literal-form pattern
   * never matches them and only address resolution catches them. All of these were accepted before
   * resolution was added: {@code localhost} and {@code 2130706433} both reach 127.0.0.1, and
   * {@code 0.0.0.0} is the wildcard address. None of them needs DNS — {@code localhost} comes from
   * the hosts file and the other two are parsed as literals — so this holds on an offline machine.
   */
  @Test
  void testInternalHostsMissedByLiteralPatternAreRejected() {
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://localhost"));
    assertThrows(
        BadRequestException.class, () -> URLValidator.validateURL("http://localhost:8586/api"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://2130706433"));
    assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://0.0.0.0"));
  }

  /**
   * Deployments that genuinely webhook to a loopback sidecar can opt out, but only for hosts that
   * need resolving — a URL written as a literal private IP stays blocked either way, so the opt-out
   * cannot be used to turn the check off wholesale.
   */
  @Test
  void testInternalTargetsAllowedWhenOptedOut() {
    System.setProperty("OPENMETADATA_ALLOW_INTERNAL_URL_TARGETS", "true");
    try {
      assertDoesNotThrow(() -> URLValidator.validateURL("http://localhost:8585/api"));
      assertThrows(BadRequestException.class, () -> URLValidator.validateURL("http://127.0.0.1"));
    } finally {
      System.clearProperty("OPENMETADATA_ALLOW_INTERNAL_URL_TARGETS");
    }
  }
}

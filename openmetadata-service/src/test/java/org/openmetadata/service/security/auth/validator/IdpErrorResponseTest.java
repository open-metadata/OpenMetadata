package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class IdpErrorResponseTest {

  /**
   * Trimmed from the page Microsoft Entra ID returns with HTTP 400 when the application requires
   * signed requests and the sign-in request is unsigned. Nothing on the page is visible text; the
   * reason sits in the {@code $Config} script object, past the first 500 bytes.
   */
  static final String ENTRA_UNSIGNED_REQUEST_PAGE =
      """
      <!-- Copyright (C) Microsoft Corporation. All rights reserved. -->
      <!DOCTYPE html>
      <html dir="ltr" class="" lang="en">
      <head>
          <title>Sign in to your account</title>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
          <meta http-equiv="Pragma" content="no-cache">
          <meta http-equiv="Expires" content="-1">
          <link rel="preconnect" href="https://aadcdn.msftauth.net" crossorigin>
          <meta http-equiv="x-dns-prefetch-control" content="on">
          <link rel="dns-prefetch" href="//aadcdn.msftauth.net">
          <link rel="dns-prefetch" href="//aadcdn.msauth.net">
          <meta name="PageID" content="ConvergedError" />
          <meta name="robots" content="none" />
          <script type="text/javascript" nonce='test'>//<![CDATA[
      $Config={"iErrorDesc":0,"iErrorTitle":0,"strMainMessage":"We received a bad request.","strAdditionalMessage":"","fEnableXssFix":true,"strServiceExceptionMessage":"AADSTS76021: The request sent by client is not signed while the application requires signed requests","iErrorCode":76021,"iHttpErrorCode":400,"iViewId":1,"urlCancel":"","pgid":"ConvergedError"};
      //]]></script>
      </head>
      <body data-bind="defineGlobals: ServerData, bodyCssClass" class="cb" style="display: none">
          <script type="text/javascript" nonce='test'>//<![CDATA[
      !function(){var e=window,o=e.document;o&&o.body&&(o.body.style.display="block")}();
      //]]></script>
      </body>
      </html>
      """;

  static final String ENTRA_UNSIGNED_REQUEST_REASON =
      "AADSTS76021: The request sent by client is not signed while the application requires signed requests";

  @Test
  void reasonOfReadsTheEntraServiceExceptionMessage() {
    assertEquals(
        Optional.of(ENTRA_UNSIGNED_REQUEST_REASON),
        IdpErrorResponse.reasonOf(ENTRA_UNSIGNED_REQUEST_PAGE));
  }

  @Test
  void reasonOfUnescapesTheEntraJsonString() {
    String page =
        "<script>$Config={\"strServiceExceptionMessage\":\"AADSTS700016: Application with"
            + " identifier \\u0027https://sp.example.com\\u0027 was not found in the directory"
            + " \\\"Contoso\\\".\",\"iErrorCode\":700016};</script>";

    assertEquals(
        Optional.of(
            "AADSTS700016: Application with identifier 'https://sp.example.com' was not found in"
                + " the directory \"Contoso\"."),
        IdpErrorResponse.reasonOf(page));
  }

  /** Entra HTML-escapes the message inside the JSON string, as on its unknown-tenant page. */
  @Test
  void reasonOfDecodesHtmlEntitiesInTheEntraMessage() {
    String page =
        "<script>$Config={\"strServiceExceptionMessage\":\"AADSTS90002: Tenant"
            + " &#39;00000000-0000-0000-0000-000000000001&#39; not found.\"};</script>";

    assertEquals(
        Optional.of("AADSTS90002: Tenant '00000000-0000-0000-0000-000000000001' not found."),
        IdpErrorResponse.reasonOf(page));
  }

  @Test
  void reasonOfKeepsAnEntraMessageWithAnEscapeJsonRejects() {
    String page =
        "<script>$Config={\"strServiceExceptionMessage\":\"AADSTS1: path C:\\x\"};</script>";

    assertEquals(Optional.of("AADSTS1: path C:\\x"), IdpErrorResponse.reasonOf(page));
  }

  @Test
  void reasonOfDoesNotOfferTheTitleOfAnEntraPageWithoutAReason() {
    String page =
        ENTRA_UNSIGNED_REQUEST_PAGE.replace(
            "\"strServiceExceptionMessage\":\"" + ENTRA_UNSIGNED_REQUEST_REASON + "\",", "");

    assertEquals(Optional.empty(), IdpErrorResponse.reasonOf(page));
  }

  @Test
  void reasonOfFallsBackToTheVisibleTextOfOtherProviders() {
    String page =
        """
        <html><head><title>Sign in to master</title><style>.kc { color: red; }</style></head>
        <body><script>window.kc = {};</script>
        <div id="kc-error-message"><h1>We are sorry...</h1>
        <p class="instruction">Invalid requester</p></div></body></html>
        """;

    assertEquals(Optional.of("We are sorry... Invalid requester"), IdpErrorResponse.reasonOf(page));
  }

  @Test
  void reasonOfReadsPlainTextBodies() {
    assertEquals(
        Optional.of("invalid saml request"), IdpErrorResponse.reasonOf("invalid saml request\n"));
  }

  @Test
  void entraReasonOfReadsOnlyEntraErrorPages() {
    assertEquals(
        Optional.of(ENTRA_UNSIGNED_REQUEST_REASON),
        IdpErrorResponse.entraReasonOf(ENTRA_UNSIGNED_REQUEST_PAGE));
    assertEquals(
        Optional.empty(),
        IdpErrorResponse.entraReasonOf("<html><body><p>internal-only page</p></body></html>"));
    assertEquals(Optional.empty(), IdpErrorResponse.entraReasonOf(null));
  }

  @Test
  void reasonOfIsEmptyForBlankBodies() {
    assertEquals(Optional.empty(), IdpErrorResponse.reasonOf(null));
    assertEquals(Optional.empty(), IdpErrorResponse.reasonOf(""));
    assertEquals(Optional.empty(), IdpErrorResponse.reasonOf(" \n\t "));
  }

  @Test
  void reasonOfShortensLongPageTextToOneLine() {
    String reason = IdpErrorResponse.reasonOf("line one\n\n" + "x".repeat(1000)).orElseThrow();

    assertEquals(IdpErrorResponse.MAX_PAGE_TEXT_LENGTH + 1, reason.length());
    assertTrue(reason.startsWith("line one x"));
    assertTrue(reason.endsWith("…"));
  }

  @Test
  void reasonOfKeepsALongEntraMessageWhole() {
    String message =
        "AADSTS700016: Application with identifier 'https://openmetadata.example.com/entity' was"
            + " not found in the directory 'Contoso'. This can happen if the application has not"
            + " been installed by the administrator of the tenant or consented to by any user in"
            + " the tenant. You may have sent your authentication request to the wrong tenant.";
    String page = "<script>$Config={\"strServiceExceptionMessage\":\"" + message + "\"};</script>";

    assertTrue(message.length() > IdpErrorResponse.MAX_PAGE_TEXT_LENGTH);
    assertEquals(Optional.of(message), IdpErrorResponse.reasonOf(page));
  }
}

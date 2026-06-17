package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.MockitoAnnotations;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.resources.system.IndexResource;

public class OpenMetadataAssetServletTest {

  private OpenMetadataAssetServlet servlet;

  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private ServletContext servletContext;
  @Mock private OMWebConfiguration webConfiguration;
  @Mock private ServletOutputStream outputStream;

  @BeforeEach
  public void setup() throws Exception {
    MockitoAnnotations.openMocks(this);
    when(request.getServletContext()).thenReturn(servletContext);
    when(response.getOutputStream()).thenReturn(outputStream);

    // Initialize servlet with /assets as resource path
    servlet = new OpenMetadataAssetServlet("/", "/assets", "/", "index.html", webConfiguration);
  }

  @Test
  public void testServeGzipAsset() throws Exception {
    // Setup request for test.js
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("gzip, deflate");
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");

    try {
      servlet.doGet(request, response);
    } catch (Exception e) {
      e.printStackTrace();
      throw e;
    }

    // Verify Content-Encoding header is set
    verify(response).setHeader("Content-Encoding", "gzip");
    // Verify Content-Type is set to javascript (not octet-stream or whatever .gz might imply)
    verify(response).setContentType("application/javascript");
  }

  @Test
  public void testServeNormalAssetIfGzipMissing() throws Exception {
    // Setup request for normal.js (which has no .gz version)
    String path = "/normal.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("gzip, deflate");
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);

    servlet.doGet(request, response);

    // Verify Content-Encoding is NOT set
    verify(response, never()).setHeader(eq("Content-Encoding"), anyString());
  }

  @Test
  public void testServeNormalAssetIfGzipNotAccepted() throws Exception {
    // Setup request for test.js (which HAS .gz version)
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn(null);
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);

    servlet.doGet(request, response);

    // Verify Content-Encoding is NOT set
    verify(response, never()).setHeader(eq("Content-Encoding"), anyString());
  }

  @Test
  public void testServeBrotliAsset() throws Exception {
    // Setup request for test.js (which has .br version)
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("br"); // Only asking for br
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");

    try {
      servlet.doGet(request, response);
    } catch (Exception e) {
      e.printStackTrace();
      throw e;
    }

    // Verify Content-Encoding is br
    verify(response).setHeader("Content-Encoding", "br");
    verify(response).setContentType("application/javascript");
  }

  @Test
  public void testPrioritizeBrotliOverGzip() throws Exception {
    // Setup request for test.js (which has BOTH .br and .gz)
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("gzip, deflate, br"); // Asking for both
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");

    try {
      servlet.doGet(request, response);
    } catch (Exception e) {
      e.printStackTrace();
      throw e;
    }

    // Verify Content-Encoding is br (Prioritized)
    verify(response).setHeader("Content-Encoding", "br");
    verify(response).setContentType("application/javascript");
  }

  @Test
  public void testFallbackToGzipIfBrotliMissing() throws Exception {
    // Setup request for gzip_only.js (which has .gz but NO .br)
    String path = "/gzip_only.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("gzip, deflate, br"); // Asking for both
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");

    try {
      servlet.doGet(request, response);
    } catch (Exception e) {
      e.printStackTrace();
      throw e;
    }

    // Verify Content-Encoding is gzip (Fallback)
    verify(response).setHeader("Content-Encoding", "gzip");
    verify(response).setContentType("application/javascript");
  }

  @Test
  public void testServeCompressedSetsVaryHeader() throws Exception {
    // Vary: Accept-Encoding tells shared caches the response body depends on this request
    // header. Without it a CDN may serve a .br body to a client that asked only for gzip.
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("gzip, br");
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");

    servlet.doGet(request, response);

    verify(response).setHeader("Vary", "Accept-Encoding");
  }

  @Test
  public void testServeCompressedMergesAllVaryHeaders() throws Exception {
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("gzip, br");
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");
    when(response.getHeaders("Vary")).thenReturn(List.of("Origin", "Accept-Language, origin"));

    servlet.doGet(request, response);

    verify(response).setHeader("Vary", "Origin, Accept-Language, Accept-Encoding");
  }

  @Test
  public void testNonZeroQValueIsAccepted() throws Exception {
    // The previous implementation matched the substring "q=0" anywhere in the entry, so
    // "br;q=0.5" was incorrectly treated as "br disabled" and we'd fall back to gzip / raw.
    // Verify that any positive q now serves brotli.
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("br;q=0.5, gzip;q=0.8");
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");

    servlet.doGet(request, response);

    verify(response).setHeader("Content-Encoding", "br");
  }

  @Test
  public void testZeroQValueExplicitlyDisablesEncoding() throws Exception {
    // br;q=0 must be honored as "client refuses brotli" — fall back to gzip.
    String path = "/test.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn("br;q=0, gzip");
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);
    when(servletContext.getMimeType(anyString())).thenReturn("application/javascript");

    servlet.doGet(request, response);

    verify(response).setHeader("Content-Encoding", "gzip");
    verify(response, never()).setHeader("Content-Encoding", "br");
  }

  @Test
  public void testHashedAssetGetsImmutableCacheControl() throws Exception {
    String path = "/assets/index-Z3O_FBkA.js";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn(null);
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);

    servlet.doGet(request, response);

    // Hashed filenames are content-addressed, so they're safe to cache forever.
    verify(response).setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  @Test
  public void testHashedImageGetsImmutableCacheControl() throws Exception {
    String path = "/images/landing-page-header-bg-DcT5-tmD.svg";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn(null);
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);

    servlet.doGet(request, response);

    verify(response).setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  @Test
  public void testUnhashedAssetDoesNotGetImmutableCacheControl() throws Exception {
    // {@code manifest.json} ships under {@code /assets/} without a content hash,
    // so the immutable header would be wrong (a future deploy could change the file
    // body while the URL stays the same).
    String path = "/assets/manifest.json";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn(null);
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);

    servlet.doGet(request, response);

    verify(response, never())
        .setHeader(eq("Cache-Control"), eq("public, max-age=31536000, immutable"));
  }

  @Test
  public void testSpaRouteGetsRevalidateCacheControl() throws Exception {
    // SPA routes (e.g. /table/foo.bar) serve the index.html shell, which must NOT
    // be long-cached or clients keep the stale shell pointing at chunks that no
    // longer exist after a deploy.
    String path = "/table/service.db.schema.table";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getPathInfo()).thenReturn(path);
    when(request.getServletPath()).thenReturn("");
    when(request.getHeader("Accept-Encoding")).thenReturn(null);
    when(request.getMethod()).thenReturn("GET");
    when(request.getDateHeader(anyString())).thenReturn(-1L);
    when(request.getHeader("If-None-Match")).thenReturn(null);
    when(request.getHeader("If-Modified-Since")).thenReturn(null);

    servlet.doGet(request, response);

    verify(response).setHeader("Cache-Control", "no-cache, must-revalidate");
  }

  @Test
  public void testRootPathEmits304WhenIfNoneMatchMatches() throws Exception {
    // When the client sends If-None-Match equal to the current shell's ETag AND no per-request
    // CSP nonce is in play, the server short-circuits with 304 and writes no body. This is the
    // dominant code path on a tab reload — saves the ~5 KB HTML download every time.
    String path = "/";
    String etag = "\"abcDEF123456\"";
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getAttribute("cspNonce")).thenReturn(null);
    when(request.getHeader("If-None-Match")).thenReturn(etag);

    try (MockedStatic<IndexResource> indexResource =
        org.mockito.Mockito.mockStatic(IndexResource.class)) {
      indexResource.when(() -> IndexResource.getIndexEtag("/")).thenReturn(etag);
      servlet.doGet(request, response);
    }

    verify(response).setHeader("ETag", etag);
    verify(response).setStatus(HttpServletResponse.SC_NOT_MODIFIED);
    // Body must NOT be written when answering 304 — that's what makes the response cheap.
    verify(response, never()).getWriter();
  }

  @Test
  public void testRootPathEmits200AndBodyWhenIfNoneMatchDiffers() throws Exception {
    String path = "/";
    String currentEtag = "\"currentETag\"";
    String staleEtag = "\"staleClientETag\"";
    StringWriter bodyCapture = new StringWriter();
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getAttribute("cspNonce")).thenReturn(null);
    when(request.getHeader("If-None-Match")).thenReturn(staleEtag);
    when(response.getWriter()).thenReturn(new PrintWriter(bodyCapture));

    try (MockedStatic<IndexResource> indexResource =
        org.mockito.Mockito.mockStatic(IndexResource.class)) {
      indexResource.when(() -> IndexResource.getIndexEtag("/")).thenReturn(currentEtag);
      indexResource
          .when(() -> IndexResource.getIndexFile("/", null))
          .thenReturn("<html>fresh</html>");
      servlet.doGet(request, response);
    }

    verify(response).setHeader("ETag", currentEtag);
    verify(response, never()).setStatus(HttpServletResponse.SC_NOT_MODIFIED);
    assertTrue(bodyCapture.toString().contains("<html>fresh</html>"));
  }

  @Test
  public void testRootPathSkipsEtagWhenCspPolicyUsesNonce() throws Exception {
    // When the configured CSP policy contains __CSP_NONCE__ — meaning every request emits a
    // unique CSP header that the response body's inline scripts must match — the servlet must
    // not emit an ETag or attempt a 304. A cached body would carry a stale nonce that the
    // next request's CSP header would reject.
    String path = "/";
    String nonce = "request-nonce-abc";
    StringWriter bodyCapture = new StringWriter();

    // Wire a CSP factory whose policy uses the __CSP_NONCE__ placeholder. The servlet's
    // cspRequiresPerRequestBody() calls build() on the factory; build() returns an empty
    // map unless {@code enabled} is true, so both flags need setting.
    org.openmetadata.service.config.web.CspHeaderFactory cspFactory =
        new org.openmetadata.service.config.web.CspHeaderFactory();
    cspFactory.setEnabled(true);
    cspFactory.setPolicy("script-src 'nonce-__CSP_NONCE__'");
    when(webConfiguration.getCspHeaderFactory()).thenReturn(cspFactory);

    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getAttribute("cspNonce")).thenReturn(nonce);
    when(request.getHeader("If-None-Match")).thenReturn("\"anything\"");
    when(response.getWriter()).thenReturn(new PrintWriter(bodyCapture));

    try (MockedStatic<IndexResource> indexResource =
        org.mockito.Mockito.mockStatic(IndexResource.class)) {
      indexResource
          .when(() -> IndexResource.getIndexFile("/", nonce))
          .thenReturn("<html>nonce=" + nonce + "</html>");
      servlet.doGet(request, response);
    }

    verify(response, never()).setHeader(eq("ETag"), anyString());
    verify(response, never()).setStatus(HttpServletResponse.SC_NOT_MODIFIED);
    assertTrue(bodyCapture.toString().contains(nonce));
  }

  @Test
  public void testRootPathEmitsEtagWhenCspIsNotConfigured() throws Exception {
    // The common case: no CSP header is configured. CspNonceHandler still populates the
    // request attribute with a fresh value (it runs unconditionally) but the nonce is
    // decorative — no CSP header polices the body's inline scripts. The servlet must emit
    // ETag and honour 304 here; this is the test that would have caught the original bug.
    String path = "/";
    String nonce = "request-nonce-abc";
    String etag = "\"shellEtag\"";
    when(webConfiguration.getCspHeaderFactory()).thenReturn(null);
    when(request.getRequestURI()).thenReturn(path);
    when(request.getContextPath()).thenReturn("");
    when(request.getAttribute("cspNonce")).thenReturn(nonce);
    when(request.getHeader("If-None-Match")).thenReturn(etag);

    try (MockedStatic<IndexResource> indexResource =
        org.mockito.Mockito.mockStatic(IndexResource.class)) {
      indexResource.when(() -> IndexResource.getIndexEtag("/")).thenReturn(etag);
      servlet.doGet(request, response);
    }

    verify(response).setHeader("ETag", etag);
    verify(response).setStatus(HttpServletResponse.SC_NOT_MODIFIED);
  }

  @Test
  public void testSpaRouteWithDotSeparatedEntityFqn() {
    assertTrue(servlet.isSpaRoute("/table/service.db.schema.table"));
  }

  @Test
  public void testStaticAssetsAreNotSpaRoutes() {
    assertFalse(servlet.isSpaRoute("/assets/index.js"));
    assertFalse(servlet.isSpaRoute("/images/logo.png"));
    assertFalse(servlet.isSpaRoute("/favicons/favicon-32x32.png"));
  }

  @Test
  public void testApiPathsAreNotSpaRoutes() {
    assertFalse(servlet.isSpaRoute("/api/v1/system/version"));
    assertFalse(servlet.isSpaRoute("/openapi.json"));
  }
}

package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.service.config.OMWebConfiguration;

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

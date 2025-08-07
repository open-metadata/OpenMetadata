package org.openmetadata.service.search.opensearch.aws;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpEntityEnclosingRequest;
import org.apache.http.HttpHost;
import org.apache.http.HttpRequest;
import org.apache.http.HttpRequestInterceptor;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.protocol.HttpContext;
import org.apache.http.protocol.HttpCoreContext;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.signer.Aws4Signer;
import software.amazon.awssdk.auth.signer.params.Aws4SignerParams;
import software.amazon.awssdk.http.SdkHttpFullRequest;
import software.amazon.awssdk.http.SdkHttpMethod;
import software.amazon.awssdk.regions.Region;

/**
 * Apache HttpClient interceptor that signs requests with AWS SigV4 using AWS SDK v2.
 * It converts the outgoing Apache request into an SdkHttpFullRequest, signs it, and
 * applies the signed headers back to the Apache request.
 */
public class SigV4RequestSigningInterceptor implements HttpRequestInterceptor {

  private final String serviceName;
  private final Region region;
  private final AwsCredentialsProvider credentialsProvider;
  private final Aws4Signer signer;

  public SigV4RequestSigningInterceptor(
      String serviceName, Region region, AwsCredentialsProvider credentialsProvider) {
    this.serviceName = serviceName;
    this.region = region;
    this.credentialsProvider = credentialsProvider;
    this.signer = Aws4Signer.create();
  }

  @Override
  public void process(HttpRequest request, HttpContext context) throws IOException {
    HttpHost host = (HttpHost) context.getAttribute(HttpCoreContext.HTTP_TARGET_HOST);
    if (host == null) {
      return;
    }

    String method = request.getRequestLine().getMethod();
    String rawUri = request.getRequestLine().getUri();
    String scheme = host.getSchemeName();
    String hostname = host.getHostName();
    int port = host.getPort();

    String path = rawUri;
    String query = null;
    try {
      // rawUri can be relative (path + optional query)
      URI uri = new URI(rawUri);
      path = uri.getRawPath() == null ? "/" : uri.getRawPath();
      query = uri.getRawQuery();
    } catch (URISyntaxException ignored) {
      // Fallback to using the raw URI as path
    }

    SdkHttpFullRequest.Builder sdkReq =
        SdkHttpFullRequest.builder()
            .protocol(scheme)
            .host(hostname)
            .encodedPath(path)
            .method(SdkHttpMethod.fromValue(method));
    if (port > 0) {
      sdkReq.port(port);
    }

    // Copy headers
    for (Header h : request.getAllHeaders()) {
      String name = h.getName();
      String value = h.getValue();
      // SdkHttpFullRequest is case-insensitive, but we add as provided
      sdkReq.putHeader(name, value);
    }

    // Copy query params
    if (query != null && !query.isEmpty()) {
      for (String pair : query.split("&")) {
        if (pair.isEmpty()) continue;
        int idx = pair.indexOf('=');
        String k = idx >= 0 ? pair.substring(0, idx) : pair;
        String v = idx >= 0 ? pair.substring(idx + 1) : "";
        // Values may repeat for same key, support multi-values
        sdkReq.putRawQueryParameter(k, v);
      }
    }

    // Copy body if present to a repeatable entity and request content
    byte[] bodyBytes = new byte[0];
    if (request instanceof HttpEntityEnclosingRequest enclosing) {
      HttpEntity entity = enclosing.getEntity();
      if (entity != null) {
        bodyBytes = entity.getContent().readAllBytes();
        enclosing.setEntity(new ByteArrayEntity(bodyBytes));
      }
    }
    if (bodyBytes.length > 0) {
      byte[] finalBody = bodyBytes; // effectively final reference for lambda
      sdkReq.contentStreamProvider(() -> new ByteArrayInputStream(finalBody));
    }

    // Sign using AWS SDK v2
    Aws4SignerParams params =
        Aws4SignerParams.builder()
            .awsCredentials(credentialsProvider.resolveCredentials())
            .signingName(serviceName)
            .signingRegion(region)
            .build();
    SdkHttpFullRequest signed = signer.sign(sdkReq.build(), params);

    // Apply signed headers back to Apache request
    // Clear and re-add headers from signed request (preserve Host and others from signed)
    // Build a flat list of headers from the signed map
    List<Header> newHeaders = new ArrayList<>();
    for (Map.Entry<String, List<String>> e : signed.headers().entrySet()) {
      final String name = e.getKey();
      for (String val : e.getValue()) {
        newHeaders.add(new org.apache.http.message.BasicHeader(name, val));
      }
    }

    // remove all current headers
    for (Header h : request.getAllHeaders()) {
      request.removeHeader(h);
    }
    // add signed headers
    for (Header h : newHeaders) {
      request.addHeader(h);
    }
  }
}

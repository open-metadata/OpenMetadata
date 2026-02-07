package org.openmetadata.service.search;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.protocol.HttpClientContext;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.EntityDetails;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpException;
import org.apache.hc.core5.http.HttpHost;
import org.apache.hc.core5.http.HttpRequest;
import org.apache.hc.core5.http.HttpRequestInterceptor;
import org.apache.hc.core5.http.io.entity.ByteArrayEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.message.BasicHeader;
import org.apache.hc.core5.http.protocol.HttpContext;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.signer.Aws4Signer;
import software.amazon.awssdk.auth.signer.params.Aws4SignerParams;
import software.amazon.awssdk.http.SdkHttpFullRequest;
import software.amazon.awssdk.http.SdkHttpMethod;
import software.amazon.awssdk.regions.Region;

/**
 * HTTP request interceptor for Apache HttpClient 5.x (HC5) that signs requests using AWS Signature
 * Version 4 (SigV4). This is required for authenticating requests to AWS-managed OpenSearch or
 * Elasticsearch services using IAM credentials.
 */
@Slf4j
public class SigV4Hc5RequestSigningInterceptor implements HttpRequestInterceptor {

  private final AwsCredentialsProvider awsCredentialsProvider;
  private final Region region;
  private final String serviceName;
  private final Aws4Signer signer;

  public SigV4Hc5RequestSigningInterceptor(
      AwsCredentialsProvider awsCredentialsProvider, Region region, String serviceName) {
    this.awsCredentialsProvider = awsCredentialsProvider;
    this.region = region;
    this.serviceName = serviceName;
    this.signer = Aws4Signer.create();
  }

  private static final String UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
  private static final String X_AMZ_CONTENT_SHA256 = "x-amz-content-sha256";

  @Override
  public void process(HttpRequest request, EntityDetails entity, HttpContext context)
      throws HttpException, IOException {
    HttpHost targetHost = null;
    if (context instanceof HttpClientContext httpClientContext) {
      var route = httpClientContext.getHttpRoute();
      if (route != null) {
        targetHost = route.getTargetHost();
      }
    }
    if (targetHost == null) {
      throw new IllegalStateException(
          "No target host found in HTTP context, cannot perform SigV4 signing for AWS OpenSearch");
    }

    BodyExtractionResult bodyResult = extractRequestBody(request, entity);
    SdkHttpFullRequest sdkRequest =
        buildSdkRequest(request, targetHost, bodyResult.body, bodyResult.useUnsignedPayload);
    SdkHttpFullRequest signedRequest = signRequest(sdkRequest);

    applySignedHeaders(request, signedRequest);

    LOG.debug("Successfully signed request with AWS SigV4 for service: {}", serviceName);
  }

  private record BodyExtractionResult(byte[] body, boolean useUnsignedPayload) {}

  private BodyExtractionResult extractRequestBody(HttpRequest request, EntityDetails entity)
      throws IOException {
    if (entity != null
        && request instanceof org.apache.hc.core5.http.ClassicHttpRequest classicHttpRequest) {
      var httpEntity = classicHttpRequest.getEntity();
      if (httpEntity != null) {
        byte[] content = EntityUtils.toByteArray(httpEntity);
        classicHttpRequest.setEntity(new ByteArrayEntity(content, ContentType.APPLICATION_JSON));
        return new BodyExtractionResult(content, false);
      }
    }
    // For async requests or requests without accessible body, use UNSIGNED-PAYLOAD
    // This tells AWS to skip body verification (safe over HTTPS)
    boolean hasBody = entity != null && entity.getContentLength() != 0;
    if (hasBody) {
      LOG.debug("Cannot extract body from async request, using UNSIGNED-PAYLOAD for SigV4 signing");
    }
    return new BodyExtractionResult(null, hasBody);
  }

  private SdkHttpFullRequest buildSdkRequest(
      HttpRequest request, HttpHost host, byte[] body, boolean useUnsignedPayload) {
    String uri = request.getRequestUri();
    String path = uri.split("\\?")[0];

    var builder =
        SdkHttpFullRequest.builder()
            .method(SdkHttpMethod.fromValue(request.getMethod()))
            .protocol(host.getSchemeName())
            .host(host.getHostName())
            .port(host.getPort())
            .encodedPath(path);

    if (uri.contains("?")) {
      String queryString = uri.substring(uri.indexOf("?") + 1);
      for (String param : queryString.split("&")) {
        String[] keyValue = param.split("=", 2);
        builder.appendRawQueryParameter(keyValue[0], keyValue.length > 1 ? keyValue[1] : "");
      }
    }

    for (Header header : request.getHeaders()) {
      String headerName = header.getName().toLowerCase();
      if (!headerName.equals("host")
          && !headerName.equals("content-length")
          && !headerName.equals("content-type")
          && !headerName.equals("transfer-encoding")
          && !headerName.equals(X_AMZ_CONTENT_SHA256)) {
        builder.appendHeader(header.getName(), header.getValue());
      }
    }

    if (useUnsignedPayload) {
      // For async requests where body can't be extracted, use UNSIGNED-PAYLOAD
      // AWS will skip body verification (safe over HTTPS to AWS-managed services)
      builder.appendHeader(X_AMZ_CONTENT_SHA256, UNSIGNED_PAYLOAD);
      builder.appendHeader("Content-Type", "application/json");
    } else if (body != null && body.length > 0) {
      final byte[] finalBody = body;
      builder.contentStreamProvider(() -> new ByteArrayInputStream(finalBody));
      builder.appendHeader("Content-Type", "application/json");
    }

    return builder.build();
  }

  private SdkHttpFullRequest signRequest(SdkHttpFullRequest sdkRequest) {
    var signerParams =
        Aws4SignerParams.builder()
            .awsCredentials(awsCredentialsProvider.resolveCredentials())
            .signingName(serviceName)
            .signingRegion(region)
            .build();

    return signer.sign(sdkRequest, signerParams);
  }

  private void applySignedHeaders(HttpRequest request, SdkHttpFullRequest signedRequest) {
    for (Header header : request.getHeaders()) {
      request.removeHeader(header);
    }

    signedRequest
        .headers()
        .forEach(
            (name, values) ->
                values.forEach(value -> request.addHeader(new BasicHeader(name, value))));
  }
}

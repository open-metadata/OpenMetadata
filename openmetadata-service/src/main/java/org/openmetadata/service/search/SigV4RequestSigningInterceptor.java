package org.openmetadata.service.search;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpEntityEnclosingRequest;
import org.apache.http.HttpHost;
import org.apache.http.HttpRequest;
import org.apache.http.HttpRequestInterceptor;
import org.apache.http.entity.BasicHttpEntity;
import org.apache.http.message.BasicHeader;
import org.apache.http.protocol.HttpContext;
import org.apache.http.util.EntityUtils;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.signer.Aws4Signer;
import software.amazon.awssdk.auth.signer.params.Aws4SignerParams;
import software.amazon.awssdk.http.SdkHttpFullRequest;
import software.amazon.awssdk.http.SdkHttpMethod;
import software.amazon.awssdk.regions.Region;

@Slf4j
public class SigV4RequestSigningInterceptor implements HttpRequestInterceptor {

  private final AwsCredentialsProvider awsCredentialsProvider;
  private final Region region;
  private final String serviceName;
  private final Aws4Signer signer;

  public SigV4RequestSigningInterceptor(
      AwsCredentialsProvider awsCredentialsProvider, Region region, String serviceName) {
    this.awsCredentialsProvider = awsCredentialsProvider;
    this.region = region;
    this.serviceName = serviceName;
    this.signer = Aws4Signer.create();
  }

  @Override
  public void process(HttpRequest request, HttpContext context) throws IOException {
    if (!(context.getAttribute("http.target_host") instanceof HttpHost host)) {
      LOG.warn("No target host found in HTTP context, skipping SigV4 signing");
      return;
    }

    var requestBody = extractRequestBody(request);
    var sdkRequest = buildSdkRequest(request, host, requestBody);
    var signedRequest = signRequest(sdkRequest);

    applySignedHeaders(request, signedRequest);
    restoreRequestBody(request, requestBody);

    LOG.debug("Successfully signed request with AWS SigV4 for service: {}", serviceName);
  }

  private byte[] extractRequestBody(HttpRequest request) throws IOException {
    if (request instanceof HttpEntityEnclosingRequest entityRequest) {
      HttpEntity entity = entityRequest.getEntity();
      if (entity != null) {
        return EntityUtils.toByteArray(entity);
      }
    }
    return null;
  }

  private SdkHttpFullRequest buildSdkRequest(HttpRequest request, HttpHost host, byte[] body) {
    String uri = request.getRequestLine().getUri();
    String path = uri.split("\\?")[0];

    var builder =
        SdkHttpFullRequest.builder()
            .method(SdkHttpMethod.fromValue(request.getRequestLine().getMethod()))
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

    for (Header header : request.getAllHeaders()) {
      String headerName = header.getName().toLowerCase();
      if (!headerName.equals("host")
          && !headerName.equals("content-length")
          && !headerName.equals("content-type")
          && !headerName.equals("transfer-encoding")) {
        builder.appendHeader(header.getName(), header.getValue());
      }
    }

    if (body != null) {
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
    for (Header header : request.getAllHeaders()) {
      request.removeHeader(header);
    }

    signedRequest
        .headers()
        .forEach(
            (name, values) ->
                values.forEach(value -> request.addHeader(new BasicHeader(name, value))));
  }

  private void restoreRequestBody(HttpRequest request, byte[] body) {
    if (body != null && request instanceof HttpEntityEnclosingRequest entityRequest) {
      var newEntity = new BasicHttpEntity();
      newEntity.setContent(new ByteArrayInputStream(body));
      newEntity.setContentLength(body.length);
      newEntity.setContentType("application/json");
      entityRequest.setEntity(newEntity);
    }
  }
}

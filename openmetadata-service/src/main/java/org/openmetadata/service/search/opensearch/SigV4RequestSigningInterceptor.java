package org.openmetadata.service.search.opensearch;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.Header;
import org.apache.http.HttpEntityEnclosingRequest;
import org.apache.http.HttpException;
import org.apache.http.HttpRequest;
import org.apache.http.HttpRequestInterceptor;
import org.apache.http.RequestLine;
import org.apache.http.entity.BasicHttpEntity;
import org.apache.http.protocol.HttpContext;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.signer.Aws4Signer;
import software.amazon.awssdk.auth.signer.params.Aws4SignerParams;
import software.amazon.awssdk.http.SdkHttpFullRequest;
import software.amazon.awssdk.http.SdkHttpMethod;
import software.amazon.awssdk.regions.Region;

@Slf4j
public class SigV4RequestSigningInterceptor implements HttpRequestInterceptor {
  private final AwsCredentialsProvider credentialsProvider;
  private final Aws4Signer signer;
  private final Region region;
  private final String serviceName;

  public SigV4RequestSigningInterceptor(
      AwsCredentialsProvider credentialsProvider, Region region, String serviceName) {
    this.credentialsProvider = credentialsProvider;
    this.region = region;
    this.serviceName = serviceName;
    this.signer = Aws4Signer.create();
  }

  @Override
  public void process(HttpRequest request, HttpContext context) throws HttpException, IOException {
    RequestLine requestLine = request.getRequestLine();
    String method = requestLine.getMethod();
    URI uri = URI.create(requestLine.getUri());

    Map<String, List<String>> headers = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    for (Header header : request.getAllHeaders()) {
      headers.computeIfAbsent(header.getName(), k -> new ArrayList<>()).add(header.getValue());
    }

    final InputStream contentStream;
    if (request instanceof HttpEntityEnclosingRequest entityRequest) {
      if (entityRequest.getEntity() != null) {
        contentStream = entityRequest.getEntity().getContent();
      } else {
        contentStream = null;
      }
    } else {
      contentStream = null;
    }

    SdkHttpFullRequest.Builder requestBuilder =
        SdkHttpFullRequest.builder()
            .method(SdkHttpMethod.fromValue(method))
            .uri(uri)
            .headers(headers);

    if (contentStream != null) {
      requestBuilder.contentStreamProvider(() -> contentStream);
    }

    SdkHttpFullRequest sdkRequest = requestBuilder.build();

    Aws4SignerParams signerParams =
        Aws4SignerParams.builder()
            .awsCredentials(credentialsProvider.resolveCredentials())
            .signingName(serviceName)
            .signingRegion(region)
            .build();

    SdkHttpFullRequest signedRequest = signer.sign(sdkRequest, signerParams);

    request.removeHeaders("Authorization");
    request.removeHeaders("X-Amz-Date");
    request.removeHeaders("X-Amz-Security-Token");

    signedRequest
        .headers()
        .forEach(
            (headerName, headerValues) -> {
              for (String headerValue : headerValues) {
                request.addHeader(headerName, headerValue);
              }
            });

    if (request instanceof HttpEntityEnclosingRequest entityRequest
        && entityRequest.getEntity() != null) {
      if (signedRequest.contentStreamProvider().isPresent()) {
        try {
          InputStream signedStream = signedRequest.contentStreamProvider().get().newStream();
          BasicHttpEntity entity = new BasicHttpEntity();
          entity.setContent(signedStream);
          entityRequest.setEntity(entity);
        } catch (Exception e) {
          LOG.error("Error setting signed entity", e);
        }
      }
    }
  }
}

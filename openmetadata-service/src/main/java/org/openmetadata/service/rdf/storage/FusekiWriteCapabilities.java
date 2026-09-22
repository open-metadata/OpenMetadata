/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.rdf.storage;

import static java.net.HttpURLConnection.HTTP_FORBIDDEN;
import static java.net.HttpURLConnection.HTTP_NOT_FOUND;
import static java.net.HttpURLConnection.HTTP_UNAUTHORIZED;

import java.net.http.HttpHeaders;
import java.util.List;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * What a Fuseki dataset guarantees for indexing, read from its {@code OPTIONS /<dataset>/data}
 * response. The OpenMetadata Graph Store extension advertises these guarantees, but it is
 * optional: without it the dataset stays usable and each unmet guarantee is reported instead. A
 * bound of {@link Long#MAX_VALUE} means the server advertised none, so the client's own upload
 * budget and write deadline apply.
 */
record FusekiWriteCapabilities(long timeoutMillis, long maxBytes, List<String> missingGuarantees) {
  static final String REQUEST_ID = "Fuseki-Request-Id";
  static final String DEADLINE = "X-OpenMetadata-Write-Timeout-Ms";
  static final String LIMIT = "X-OpenMetadata-Max-Upload-Bytes";
  static final String UNION = "X-OpenMetadata-Union-Default-Graph";
  static final String QUERY = "X-OpenMetadata-Query-Timeout-Ms";
  static final String UPDATE = "X-OpenMetadata-Update-Timeout-Ms";

  private static final String REJECTED_CREDENTIALS =
      "Fuseki rejected the RDF credentials for %s (HTTP 401): check rdf.username and rdf.password";
  private static final String UNAUTHORIZED_USER =
      "The RDF user is not authorized for %s (HTTP 403): grant it write access to this dataset in"
          + " Fuseki's shiro.ini";
  private static final String UNUSABLE_ENDPOINT =
      "Fuseki dataset endpoint %s is not usable (HTTP %d)";

  private static final long NOT_ADVERTISED = Long.MAX_VALUE;
  private static final Pattern POSITIVE_LONG = Pattern.compile("[1-9]\\d{0,17}");
  private static final Predicate<String> IS_POSITIVE =
      value -> POSITIVE_LONG.matcher(value).matches();

  private static final List<Guarantee> GUARANTEES =
      List.of(
          new Guarantee(
              UNION,
              Boolean::parseBoolean,
              "tdb2:unionDefaultGraph is not enabled, so SPARQL without a GRAPH clause cannot"
                  + " see indexed entities"),
          new Guarantee(
              QUERY,
              IS_POSITIVE,
              "arq:queryTimeout is not set, so abandoned queries keep running on Fuseki"),
          new Guarantee(
              UPDATE,
              IS_POSITIVE,
              "arq:updateTimeout is not set, so an abandoned update keeps holding Fuseki's write"
                  + " lock"),
          new Guarantee(
              DEADLINE,
              IS_POSITIVE,
              "the extension advertised no usable write deadline, so the client deadline applies"),
          new Guarantee(
              LIMIT,
              IS_POSITIVE,
              "the extension advertised no usable upload limit, so the client budget applies"));

  static final List<String> EXTENSION_HEADERS = GUARANTEES.stream().map(Guarantee::header).toList();

  private static final FusekiWriteCapabilities WITHOUT_EXTENSION =
      new FusekiWriteCapabilities(
          NOT_ADVERTISED,
          NOT_ADVERTISED,
          List.of(
              "the OpenMetadata Graph Store extension is not installed: uploads hold Fuseki's write"
                  + " lock while they transfer and have no server-side deadline, and"
                  + " tdb2:unionDefaultGraph and the arq timeouts cannot be verified"));

  FusekiWriteCapabilities {
    missingGuarantees = List.copyOf(missingGuarantees);
  }

  /**
   * Interprets the probe of {@code dataset} on {@code server}. Throws only when the dataset cannot
   * be used at all; an absent or partially configured extension becomes {@link #missingGuarantees}.
   */
  static FusekiWriteCapabilities negotiate(
      final int status, final HttpHeaders headers, final String server, final String dataset) {
    requireUsableStatus(status, server, dataset);
    requireRegisteredDataset(headers, server, dataset);
    return hasExtension(headers) ? advertisedBy(headers) : WITHOUT_EXTENSION;
  }

  private static void requireUsableStatus(
      final int status, final String server, final String dataset) {
    if (status / 100 != 2) {
      throw new IllegalStateException(unusableStatusMessage(status, server, dataset));
    }
  }

  private static String unusableStatusMessage(
      final int status, final String server, final String dataset) {
    final String endpoint = server + "/" + dataset;
    return switch (status) {
      case HTTP_UNAUTHORIZED -> REJECTED_CREDENTIALS.formatted(endpoint);
      case HTTP_FORBIDDEN -> UNAUTHORIZED_USER.formatted(endpoint);
      case HTTP_NOT_FOUND -> missingDatasetMessage(server, dataset, "HTTP 404");
      default -> UNUSABLE_ENDPOINT.formatted(endpoint, status);
    };
  }

  /**
   * Jetty answers {@code OPTIONS} with 200 for any path, so a success status alone does not prove a
   * dataset exists; only a Fuseki service handling the request adds the request id.
   */
  private static void requireRegisteredDataset(
      final HttpHeaders headers, final String server, final String dataset) {
    if (!hasExtension(headers) && headers.firstValue(REQUEST_ID).isEmpty()) {
      throw new IllegalStateException(
          missingDatasetMessage(
              server,
              dataset,
              "no "
                  + REQUEST_ID
                  + " on the response: nothing is registered under that name, or the endpoint is"
                  + " not Fuseki"));
    }
  }

  private static String missingDatasetMessage(
      final String server, final String dataset, final String evidence) {
    return "Fuseki dataset '%s' does not exist at %s (%s)".formatted(dataset, server, evidence);
  }

  private static boolean hasExtension(final HttpHeaders headers) {
    return EXTENSION_HEADERS.stream().anyMatch(header -> headers.firstValue(header).isPresent());
  }

  private static FusekiWriteCapabilities advertisedBy(final HttpHeaders headers) {
    final List<String> missing =
        GUARANTEES.stream()
            .filter(guarantee -> !guarantee.isMetBy(headers))
            .map(Guarantee::missingGuarantee)
            .toList();
    return new FusekiWriteCapabilities(bound(headers, DEADLINE), bound(headers, LIMIT), missing);
  }

  private static long bound(final HttpHeaders headers, final String header) {
    final String value = headers.firstValue(header).orElse("");
    return IS_POSITIVE.test(value) ? Long.parseLong(value) : NOT_ADVERTISED;
  }

  private record Guarantee(String header, Predicate<String> isMet, String missingGuarantee) {
    boolean isMetBy(final HttpHeaders headers) {
      return headers.firstValue(header).map(isMet::test).orElse(false);
    }
  }
}

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
package org.openmetadata.fuseki;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.function.LongSupplier;
import org.apache.jena.fuseki.servlets.GSP_RW;
import org.apache.jena.fuseki.servlets.GraphTarget;
import org.apache.jena.fuseki.servlets.HttpAction;
import org.apache.jena.fuseki.servlets.ServletOps;
import org.apache.jena.fuseki.system.UploadDetails;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.ARQ;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFLanguages;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.riot.lang.StreamRDFCounting;
import org.apache.jena.riot.system.StreamRDF;
import org.apache.jena.riot.system.StreamRDFLib;
import org.apache.jena.riot.system.StreamRDFWrapper;
import org.apache.jena.sparql.core.DatasetGraph;
import org.apache.jena.sparql.core.Quad;
import org.apache.jena.tdb2.TDB2;

/** Receives bounded uploads before acquiring the writer, then rolls back expired mutations. */
public final class BoundedGraphStore extends GSP_RW {
  public static final String DEADLINE_HEADER = "X-OpenMetadata-Write-Timeout-Ms";
  public static final String LIMIT_HEADER = "X-OpenMetadata-Max-Upload-Bytes";
  public static final String UNION_HEADER = "X-OpenMetadata-Union-Default-Graph";
  public static final String QUERY_TIMEOUT_HEADER = "X-OpenMetadata-Query-Timeout-Ms";
  public static final String UPDATE_TIMEOUT_HEADER = "X-OpenMetadata-Update-Timeout-Ms";
  private static final long DEFAULT_TIMEOUT_MS = 50_000;
  private static final long DEFAULT_MAX_BYTES = 64L * 1024 * 1024;

  private final long timeoutMillis;
  private final long maxBytes;
  private final LongSupplier nanoTime;

  public BoundedGraphStore() {
    this(
        Long.getLong("openmetadata.fuseki.writeTimeoutMs", DEFAULT_TIMEOUT_MS),
        Long.getLong("openmetadata.fuseki.maxUploadBytes", DEFAULT_MAX_BYTES));
  }

  BoundedGraphStore(final long timeoutMillis, final long maxBytes) {
    this(timeoutMillis, maxBytes, System::nanoTime);
  }

  BoundedGraphStore(final long timeoutMillis, final long maxBytes, final LongSupplier nanoTime) {
    if (timeoutMillis <= 0 || maxBytes <= 0) {
      throw new IllegalArgumentException("Graph Store timeout and upload limit must be positive");
    }
    this.timeoutMillis = timeoutMillis;
    this.maxBytes = maxBytes;
    this.nanoTime = nanoTime;
  }

  @Override
  protected void doOptions(final HttpAction action) {
    action.setResponseHeader(DEADLINE_HEADER, Long.toString(timeoutMillis));
    action.setResponseHeader(LIMIT_HEADER, Long.toString(maxBytes));
    action.setResponseHeader(
        UNION_HEADER, Boolean.toString(action.getContext().isTrue(TDB2.symUnionDefaultGraph)));
    action.setResponseHeader(
        QUERY_TIMEOUT_HEADER, action.getContext().getAsString(ARQ.queryTimeout, "0"));
    action.setResponseHeader(
        UPDATE_TIMEOUT_HEADER, action.getContext().getAsString(ARQ.updateTimeout, "0"));
    super.doOptions(action);
  }

  @Override
  protected void doPutPostGSP(final HttpAction action, final boolean overwrite) {
    upload(action, overwrite, false);
  }

  @Override
  protected void doPutPostQuads(final HttpAction action, final boolean overwrite) {
    upload(action, overwrite, true);
  }

  private void upload(final HttpAction action, final boolean overwrite, final boolean quads) {
    final Lang language = requireLanguage(action);
    final WriteDeadline deadline = deadline(action);
    try (StagedUpload upload = StagedUpload.receive(action, deadline, maxBytes)) {
      final UploadResult result =
          apply(action, new UploadRequest(upload.path(), language, overwrite, quads, deadline));
      ServletOps.success(action, result.existed() ? 200 : 201);
      ServletOps.sendJson(
          action,
          UploadDetails.detailsJson(
              result.triples() + result.quads(), result.triples(), result.quads()));
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      ServletOps.error(408, "Graph Store upload interrupted");
    } catch (TimeoutException | WriteDeadline.Expired exception) {
      ServletOps.error(408, exception.getMessage());
    } catch (ExecutionException exception) {
      uploadFailure(exception.getCause());
    } catch (IOException exception) {
      ServletOps.errorOccurred("Unable to stage Graph Store upload", exception);
    }
  }

  private static Lang requireLanguage(final HttpAction action) {
    final Lang language = RDFLanguages.contentTypeToLang(action.getRequestContentType());
    if (language == null) {
      ServletOps.error(415, "Unsupported RDF Content-Type");
    }
    return language;
  }

  private WriteDeadline deadline(final HttpAction action) {
    final String requested = action.getRequestHeader(DEADLINE_HEADER);
    long effective = timeoutMillis;
    if (requested != null) {
      try {
        effective = Math.min(timeoutMillis, Long.parseLong(requested));
      } catch (NumberFormatException exception) {
        ServletOps.errorBadRequest("Invalid Graph Store write timeout");
      }
    }
    if (effective <= 0) {
      ServletOps.errorBadRequest("Graph Store write timeout must be positive");
    }
    return new WriteDeadline(Duration.ofMillis(effective), nanoTime);
  }

  private static void uploadFailure(final Throwable failure) {
    if (failure instanceof StagedUpload.TooLarge) {
      ServletOps.error(413, failure.getMessage());
    } else if (failure instanceof WriteDeadline.Expired) {
      ServletOps.error(408, failure.getMessage());
    } else {
      ServletOps.errorBadRequest("Unable to receive RDF upload: " + failure.getMessage());
    }
  }

  private UploadResult apply(final HttpAction action, final UploadRequest request) {
    request.deadline().check();
    action.beginWrite();
    try {
      request.deadline().check();
      final DatasetGraph dataset = decideDataset(action);
      final Target target = target(action, dataset, request);
      final StreamRDFCounting sink =
          StreamRDFLib.count(withDeadline(target.sink(), request.deadline()));
      RDFParser.source(request.path())
          .base(action.getRequestRequestURL())
          .lang(request.language())
          .parse(sink);
      request.deadline().check();
      action.commit();
      return new UploadResult(sink.countTriples(), sink.countQuads(), target.existed());
    } catch (RuntimeException exception) {
      action.abortSilent();
      throw exception;
    } finally {
      action.endWrite();
    }
  }

  private static Target target(
      final HttpAction action, final DatasetGraph dataset, final UploadRequest request) {
    if (request.quads()) {
      if (request.overwrite()) {
        dataset.clear();
      }
      return new Target(StreamRDFLib.dataset(dataset), true);
    }
    final GraphTarget graph = GraphTarget.determineTargetGSP(dataset, action);
    if (graph.isUnion()) {
      ServletOps.errorBadRequest("Cannot load into the union graph");
    }
    final boolean existed = graph.exists();
    if (request.overwrite()) {
      graph.graph().clear();
      graph.graph().getPrefixMapping().clearNsPrefixMap();
    }
    return new Target(StreamRDFLib.graph(graph.graph()), existed);
  }

  static StreamRDF withDeadline(final StreamRDF sink, final WriteDeadline deadline) {
    return new StreamRDFWrapper(sink) {
      @Override
      public void triple(final Triple triple) {
        deadline.check();
        super.triple(triple);
        deadline.check();
      }

      @Override
      public void quad(final Quad quad) {
        deadline.check();
        super.quad(quad);
        deadline.check();
      }
    };
  }

  private record UploadRequest(
      Path path, Lang language, boolean overwrite, boolean quads, WriteDeadline deadline) {}

  private record Target(StreamRDF sink, boolean existed) {}

  private record UploadResult(long triples, long quads, boolean existed) {}
}

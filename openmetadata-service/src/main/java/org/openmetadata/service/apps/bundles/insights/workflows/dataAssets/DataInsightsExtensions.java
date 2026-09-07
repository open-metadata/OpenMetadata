package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.ServiceLoader;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataInsightsExtension.RunContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataInsightsExtension.Session;

/** Keeps extension state local to one DI run, including cleanup after startup or indexing failure. */
public final class DataInsightsExtensions implements AutoCloseable {
  public static final String RUN_ID = "diRunId";
  public static final String CAPTURED_AT = "diCapturedAt";

  private final RunContext context;
  private final List<Session> sessions = new ArrayList<>();

  private DataInsightsExtensions(RunContext context) {
    this.context = context;
  }

  public static DataInsightsExtensions open(RunContext context) {
    return open(context, ServiceLoader.load(DataInsightsExtension.class));
  }

  static DataInsightsExtensions open(
      RunContext context, Iterable<DataInsightsExtension> extensions) {
    DataInsightsExtensions run = new DataInsightsExtensions(context);
    try {
      extensions.forEach(extension -> run.sessions.add(extension.open(context)));
    } catch (RuntimeException | Error failure) {
      try {
        run.close();
      } catch (RuntimeException cleanupFailure) {
        failure.addSuppressed(cleanupFailure);
      }
      throw failure;
    }
    return run;
  }

  public void enrich(Map<String, Object> snapshot) {
    context.requireActive();
    snapshot.put(RUN_ID, context.runId());
    snapshot.put(CAPTURED_AT, context.capturedAt());
    sessions.forEach(session -> session.enrich(snapshot));
  }

  public void complete() {
    context.requireActive();
    sessions.forEach(Session::complete);
  }

  public void beforeBatch(List<? extends EntityInterface> entities) {
    context.requireActive();
    sessions.forEach(session -> session.beforeBatch(entities));
  }

  @Override
  public void close() {
    RuntimeException failure = null;
    for (Session session : sessions.reversed()) {
      try {
        session.close();
      } catch (RuntimeException exception) {
        if (failure == null) {
          failure = exception;
        } else {
          failure.addSuppressed(exception);
        }
      }
    }
    if (failure != null) {
      throw failure;
    }
  }
}

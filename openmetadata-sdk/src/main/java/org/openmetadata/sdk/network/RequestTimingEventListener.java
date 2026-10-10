package org.openmetadata.sdk.network;

import java.io.IOException;
import java.util.List;
import okhttp3.Call;
import okhttp3.EventListener;
import okhttp3.HttpUrl;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Bridges OkHttp's call lifecycle to {@link RequestListener}s. OkHttp creates one instance per
 * call.
 *
 * <p>{@code callEnd} rather than an interceptor around {@code chain.proceed()}: an interceptor
 * returns once the response headers arrive, before the client has read the body, which is most of
 * the time on a large list or search response.
 */
final class RequestTimingEventListener extends EventListener {

  private static final Logger LOG = LoggerFactory.getLogger(RequestTimingEventListener.class);

  private final List<RequestListener> listeners;
  // An async call starts on the caller's thread and finishes on OkHttp's dispatcher.
  private volatile long startedAtNanos;
  private volatile int statusCode = CompletedRequest.NO_RESPONSE;

  RequestTimingEventListener(final List<RequestListener> listeners) {
    this.listeners = listeners;
  }

  @Override
  public void callStart(final Call call) {
    startedAtNanos = System.nanoTime();
  }

  @Override
  public void responseHeadersEnd(final Call call, final Response response) {
    statusCode = response.code();
  }

  @Override
  public void callEnd(final Call call) {
    publish(call);
  }

  @Override
  public void callFailed(final Call call, final IOException ioe) {
    publish(call);
  }

  private void publish(final Call call) {
    final HttpUrl url = call.request().url();
    final CompletedRequest completed =
        new CompletedRequest(
            call.request().method(),
            url.encodedPath(),
            url.encodedQuery(),
            statusCode,
            System.nanoTime() - startedAtNanos);
    for (final RequestListener listener : listeners) {
      try {
        listener.onRequestCompleted(completed);
      } catch (RuntimeException e) {
        LOG.warn("RequestListener {} failed; ignoring", listener, e);
      }
    }
  }
}

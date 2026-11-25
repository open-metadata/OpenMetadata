package org.openmetadata.sdk.network;

/**
 * Observes every HTTP call an {@link OpenMetadataHttpClient} makes, for client-side latency
 * metrics. Register through {@code OpenMetadataConfig.builder().requestListener(...)}.
 *
 * <p>Called on whichever thread completes the call — OkHttp's dispatcher for the async methods —
 * so implementations must be thread-safe and cheap. An exception thrown from here is logged and
 * dropped: observing a request must never fail it.
 */
@FunctionalInterface
public interface RequestListener {
  void onRequestCompleted(CompletedRequest request);
}

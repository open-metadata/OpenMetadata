package org.openmetadata.service.search.opensearch;

import java.nio.ByteBuffer;
import java.util.List;
import org.apache.hc.core5.concurrent.FutureCallback;
import org.apache.hc.core5.http.EntityDetails;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpException;
import org.apache.hc.core5.http.HttpResponse;
import org.apache.hc.core5.http.nio.AsyncResponseConsumer;
import org.apache.hc.core5.http.nio.CapacityChannel;
import org.apache.hc.core5.http.protocol.HttpContext;

/**
 * Adapts Elastic's fix for elastic/elasticsearch-java#1046 (PR #1049) to opensearch-java.
 * opensearch-project/opensearch-java#1969 tracks the same bug upstream, still unfixed in 3.4.0.
 *
 * <p>HC5's {@code SingleCoreIOReactor.execute()} separates {@code Exception} (routed to the
 * exception callback, reactor keeps running) from {@code Throwable} (caught by the "any" branch
 * that calls {@code close(IMMEDIATE)} + rethrow, reactor transitions to {@code SHUT_DOWN}
 * permanently). Any {@code Error} thrown from a user-provided consumer — an allocation failure,
 * a bug, a StackOverflowError — permanently kills the reactor. No callback can save it because
 * callbacks are typed {@code Callback<Exception>}.
 *
 * <p>This wrapper catches {@code Throwable} from every {@code AsyncResponseConsumer} method and
 * rethrows {@code Error} as {@code RuntimeException}. The original request still fails, but the
 * reactor stays alive because the failure now flows through the Exception path, not the "any"
 * path.
 */
public class SafeResponseConsumer<T> implements AsyncResponseConsumer<T> {

  private final AsyncResponseConsumer<T> delegate;

  public SafeResponseConsumer(AsyncResponseConsumer<T> delegate) {
    this.delegate = delegate;
  }

  @SuppressWarnings("unchecked")
  private static <E extends Throwable> void throwUnchecked(Throwable t) throws E {
    throw (E) t;
  }

  @Override
  public void consumeResponse(
      HttpResponse response,
      EntityDetails entityDetails,
      HttpContext context,
      FutureCallback<T> resultCallback)
      throws HttpException, java.io.IOException {
    try {
      delegate.consumeResponse(response, entityDetails, context, resultCallback);
    } catch (Exception e) {
      throwUnchecked(e);
    } catch (Throwable e) {
      throw new RuntimeException("Error consuming response", e);
    }
  }

  @Override
  public void informationResponse(HttpResponse response, HttpContext context)
      throws HttpException, java.io.IOException {
    try {
      delegate.informationResponse(response, context);
    } catch (Exception e) {
      throwUnchecked(e);
    } catch (Throwable e) {
      throw new RuntimeException("Error on information response", e);
    }
  }

  @Override
  public void failed(Exception cause) {
    try {
      delegate.failed(cause);
    } catch (Exception e) {
      throwUnchecked(e);
    } catch (Throwable e) {
      throw new RuntimeException("Error handling failure", e);
    }
  }

  @Override
  public void updateCapacity(CapacityChannel capacityChannel) throws java.io.IOException {
    try {
      delegate.updateCapacity(capacityChannel);
    } catch (Exception e) {
      throwUnchecked(e);
    } catch (Throwable e) {
      throw new RuntimeException("Error updating capacity", e);
    }
  }

  @Override
  public void consume(ByteBuffer src) throws java.io.IOException {
    try {
      delegate.consume(src);
    } catch (Exception e) {
      throwUnchecked(e);
    } catch (Throwable e) {
      throw new RuntimeException("Error consuming body", e);
    }
  }

  @Override
  public void streamEnd(List<? extends Header> trailers) throws HttpException, java.io.IOException {
    try {
      delegate.streamEnd(trailers);
    } catch (Exception e) {
      throwUnchecked(e);
    } catch (Throwable e) {
      throw new RuntimeException("Error at stream end", e);
    }
  }

  @Override
  public void releaseResources() {
    try {
      delegate.releaseResources();
    } catch (Exception e) {
      throwUnchecked(e);
    } catch (Throwable e) {
      throw new RuntimeException("Error releasing resources", e);
    }
  }
}

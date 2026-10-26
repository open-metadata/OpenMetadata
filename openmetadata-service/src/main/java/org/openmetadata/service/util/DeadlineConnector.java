package org.openmetadata.service.util;

import jakarta.ws.rs.ProcessingException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.client.ClientRequest;
import org.glassfish.jersey.client.ClientResponse;
import org.glassfish.jersey.client.HttpUrlConnectorProvider;
import org.glassfish.jersey.client.spi.AsyncConnectorCallback;
import org.glassfish.jersey.client.spi.Connector;

/**
 * Bounds one whole HTTP exchange in time. The connect and read timeouts only bound a wait for the
 * next bytes, so a receiver that never reads what is sent, or answers a byte at a time, could hold
 * the sending thread forever. Each exchange runs on its own virtual thread; at the deadline that
 * thread is interrupted, which closes its socket, and the send fails. The response body is read
 * inside the same deadline, up to a bound, so a slow or endless body cannot hold it either.
 */
public final class DeadlineConnector implements Connector {

  static final int MAX_RESPONSE_BYTES = 1024 * 1024;

  private final Connector delegate;
  private final Duration deadline;

  DeadlineConnector(Connector delegate, Duration deadline) {
    this.delegate = delegate;
    this.deadline = deadline;
  }

  /** A client configuration whose every exchange ends by the deadline. */
  public static ClientConfig within(Duration deadline) {
    return new ClientConfig()
        .connectorProvider(
            (client, configuration) ->
                new DeadlineConnector(
                    new HttpUrlConnectorProvider().getConnector(client, configuration), deadline));
  }

  @Override
  public ClientResponse apply(ClientRequest request) {
    FutureTask<ClientResponse> exchange =
        new FutureTask<>(() -> withBodyRead(delegate.apply(request)));
    Thread.ofVirtual().name("outbound-exchange").start(exchange);
    return awaitWithinDeadline(exchange, request);
  }

  @Override
  public Future<?> apply(ClientRequest request, AsyncConnectorCallback callback) {
    FutureTask<Void> exchange = new FutureTask<>(() -> answer(request, callback), null);
    Thread.ofVirtual().name("outbound-exchange-async").start(exchange);
    return exchange;
  }

  @Override
  public String getName() {
    return delegate.getName() + " within " + deadline.toSeconds() + " s";
  }

  @Override
  public void close() {
    delegate.close();
  }

  private void answer(ClientRequest request, AsyncConnectorCallback callback) {
    try {
      callback.response(apply(request));
    } catch (ProcessingException e) {
      callback.failure(e);
    }
  }

  private ClientResponse awaitWithinDeadline(
      FutureTask<ClientResponse> exchange, ClientRequest request) {
    try {
      return exchange.get(deadline.toMillis(), TimeUnit.MILLISECONDS);
    } catch (TimeoutException | CancellationException e) {
      exchange.cancel(true);
      throw new ProcessingException(
          String.format(
              "Timed out after %d s sending to %s", deadline.toSeconds(), request.getUri()));
    } catch (InterruptedException e) {
      exchange.cancel(true);
      Thread.currentThread().interrupt();
      throw new ProcessingException("Interrupted while sending to " + request.getUri(), e);
    } catch (ExecutionException e) {
      throw asProcessingException(e.getCause());
    }
  }

  private static ProcessingException asProcessingException(Throwable cause) {
    return cause instanceof ProcessingException failed
        ? failed
        : new ProcessingException(cause.getMessage(), cause);
  }

  // Read here, inside the deadline: a body read later by the caller would be bounded only by the
  // read timeout, which restarts with every byte.
  private static ClientResponse withBodyRead(ClientResponse response) {
    if (response.hasEntity()) {
      try (InputStream body = response.getEntityStream()) {
        response.setEntityStream(new ByteArrayInputStream(body.readNBytes(MAX_RESPONSE_BYTES)));
      } catch (IOException e) {
        throw new UncheckedIOException(e);
      }
    }
    return response;
  }
}

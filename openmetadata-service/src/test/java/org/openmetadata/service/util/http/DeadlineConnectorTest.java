package org.openmetadata.service.util.http;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.Test;

/** One outbound exchange ends by its deadline, however the receiver behaves. */
class DeadlineConnectorTest {

  private static final Duration DEADLINE = Duration.ofSeconds(1);
  private static final int SIXTEEN_MEGABYTES = 16 * 1024 * 1024;

  // Through the factory every caller uses: 5 s to connect and 10 s to read give a 15 s deadline,
  // while a write the receiver never reads would otherwise block forever.
  @Test
  void aReceiverThatNeverReadsWhatIsSentEndsTheSendAtTheDeadline() throws IOException {
    try (ServerSocket neverReads = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
        Client client = OutboundHttpClients.newClient(5, 10)) {
      List<Socket> held = acceptAndHold(neverReads);
      String body = "x".repeat(SIXTEEN_MEGABYTES);

      ProcessingException failed =
          assertTimeoutPreemptively(
              Duration.ofSeconds(30),
              () ->
                  assertThrows(
                      ProcessingException.class,
                      () -> client.target(urlOf(neverReads)).request().post(Entity.text(body))));

      assertTrue(failed.getMessage().contains("Timed out"), failed.getMessage());
      closeAll(held);
    }
  }

  @Test
  void aReceiverThatAnswersAByteAtATimeEndsTheSendAtTheDeadline() throws IOException {
    try (ServerSocket trickles = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
        Client client = OutboundHttpClients.newClient(5, 10, DEADLINE)) {
      CountDownLatch testIsOver = new CountDownLatch(1);
      Thread.ofVirtual().start(() -> trickleAnAnswer(trickles, testIsOver));

      ProcessingException failed =
          assertTimeoutPreemptively(
              Duration.ofSeconds(8),
              () ->
                  assertThrows(
                      ProcessingException.class,
                      () -> client.target(urlOf(trickles)).request().post(Entity.text("event"))));

      assertTrue(failed.getMessage().contains("Timed out"), failed.getMessage());
      testIsOver.countDown();
    }
  }

  @Test
  void aReceiverThatAnswersIsUnchanged() throws IOException {
    HttpServer answers =
        HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    answers.createContext(
        "/",
        exchange -> {
          exchange.getRequestBody().readAllBytes();
          byte[] ok = "ok".getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, ok.length);
          exchange.getResponseBody().write(ok);
          exchange.close();
        });
    answers.start();
    try (Client client = OutboundHttpClients.newClient(5, 10, DEADLINE)) {
      String url = "http://localhost:" + answers.getAddress().getPort() + "/hook";
      try (Response response = client.target(url).request().post(Entity.text("event"))) {
        assertEquals(200, response.getStatus());
        assertEquals("ok", response.readEntity(String.class));
      }
    } finally {
      answers.stop(0);
    }
  }

  private static List<Socket> acceptAndHold(ServerSocket server) {
    List<Socket> held = new ArrayList<>();
    Thread.ofVirtual()
        .start(
            () -> {
              try {
                held.add(server.accept());
              } catch (IOException closed) {
                // The test is over.
              }
            });
    return held;
  }

  // Headers that never end: the status line and the start of a header, then nothing, so only a
  // whole-exchange deadline can end the send before the read timeout.
  private static void trickleAnAnswer(ServerSocket server, CountDownLatch testIsOver) {
    try (Socket socket = server.accept()) {
      OutputStream out = socket.getOutputStream();
      out.write("HTTP/1.1 200 OK\r\nX-Slow: ".getBytes(StandardCharsets.US_ASCII));
      out.flush();
      testIsOver.await();
    } catch (IOException | InterruptedException ended) {
      // The client hung up, which is what the test expects.
    }
  }

  private static void closeAll(List<Socket> sockets) throws IOException {
    for (Socket socket : sockets) {
      socket.close();
    }
  }

  private static String urlOf(ServerSocket server) {
    return "http://localhost:" + server.getLocalPort() + "/hook";
  }
}

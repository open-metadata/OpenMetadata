package org.openmetadata.it.sso.browser;

import io.socket.client.IO;
import io.socket.client.Socket;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.awaitility.Awaitility;

/**
 * A push-feed socket opened the way the single-page app opens one: socket.io over the websocket
 * transport only, with the bearer token in the handshake query and no automatic reconnection, so a
 * close the server makes stays visible to the test.
 */
public final class PushFeedSocket implements AutoCloseable {
  public static final String SERVER_DISCONNECT = "io server disconnect";
  public static final String TOKEN_EXPIRED_CHANNEL = "tokenExpiredChannel";
  private static final String DISCONNECTED_PREFIX = "disconnect: ";
  private static final String PATH = "/api/v1/push/feed";
  private static final String WEBSOCKET = "websocket";
  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(20);

  private final Socket socket;
  private final AtomicBoolean connected = new AtomicBoolean();
  private final AtomicReference<String> connectError = new AtomicReference<>();
  private final List<String> received = new CopyOnWriteArrayList<>();

  private PushFeedSocket(Socket socket) {
    this.socket = socket;
    socket.on(Socket.EVENT_CONNECT, args -> connected.set(true));
    socket.on(Socket.EVENT_CONNECT_ERROR, args -> connectError.set(firstOf(args)));
    socket.on(TOKEN_EXPIRED_CHANNEL, args -> received.add(TOKEN_EXPIRED_CHANNEL));
    socket.on(Socket.EVENT_DISCONNECT, args -> onDisconnect(firstOf(args)));
  }

  /** Opens a socket on {@code baseUrl} and waits until the server accepts its handshake. */
  public static PushFeedSocket open(String baseUrl, String token) {
    PushFeedSocket feed = new PushFeedSocket(IO.socket(URI.create(baseUrl), options(token)));
    feed.connect();
    return feed;
  }

  public boolean isConnected() {
    return connected.get();
  }

  /** What the socket received, in order: the token expired notice and the disconnect reason. */
  public List<String> received() {
    return List.copyOf(received);
  }

  public static String disconnectedBy(String reason) {
    return DISCONNECTED_PREFIX + reason;
  }

  @Override
  public void close() {
    socket.off();
    socket.close();
  }

  private void connect() {
    socket.connect();
    Awaitility.await("push-feed handshake")
        .atMost(CONNECT_TIMEOUT)
        .until(() -> connected.get() || connectError.get() != null);
    if (!connected.get()) {
      throw new AssertionError("The push feed refused the handshake: " + connectError.get());
    }
  }

  // Recorded before the state flips, so a test that waits on isConnected sees the reason too.
  private void onDisconnect(String reason) {
    received.add(disconnectedBy(reason));
    connected.set(false);
  }

  // Every socket gets its own connection: a shared one would reuse the first socket's token.
  private static IO.Options options(String token) {
    IO.Options options = new IO.Options();
    options.path = PATH;
    options.query = "token=" + token;
    options.transports = new String[] {WEBSOCKET};
    options.reconnection = false;
    options.forceNew = true;
    return options;
  }

  private static String firstOf(Object[] args) {
    return args.length > 0 ? String.valueOf(args[0]) : null;
  }
}

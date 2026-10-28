package org.openmetadata.it.sso;

import com.sun.net.httpserver.HttpExchange;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedDeque;

/** Every request a mock identity provider received, newest last, capped in size. */
public final class MockRequestJournal {
  private static final int CAPACITY = 500;

  private final Deque<RecordedRequest> requests = new ConcurrentLinkedDeque<>();

  public void record(HttpExchange exchange, Map<String, String> parameters) {
    requests.addLast(
        new RecordedRequest(
            exchange.getRequestMethod(),
            exchange.getRequestURI().getPath(),
            Map.copyOf(parameters),
            exchange.getRequestHeaders().getFirst(MockHttp.AUTHORIZATION)));
    while (requests.size() > CAPACITY) {
      requests.pollFirst();
    }
  }

  public List<RecordedRequest> requests() {
    return List.copyOf(requests);
  }

  public List<RecordedRequest> requestsTo(String path) {
    return requests.stream().filter(request -> request.path().equals(path)).toList();
  }

  public void clear() {
    requests.clear();
  }

  /** One request as the mock saw it; {@code authorization} is the raw header, or null. */
  public record RecordedRequest(
      String method, String path, Map<String, String> parameters, String authorization) {
    public String parameter(String name) {
      return parameters.get(name);
    }
  }
}

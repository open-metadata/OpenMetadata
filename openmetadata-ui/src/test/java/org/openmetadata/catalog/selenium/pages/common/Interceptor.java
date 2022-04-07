package org.openmetadata.catalog.selenium.pages.common;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.devtools.v95.fetch.Fetch;

@RequiredArgsConstructor
public class Interceptor {
  static DevTools devTools;

  public Interceptor(DevTools devTools) {
    Interceptor.devTools = devTools;
  }

  public void interceptor(String content, String replaceContent) {
    devTools.createSession();
    devTools.send(Fetch.enable(Optional.empty(), Optional.empty()));
    devTools.addListener(
        Fetch.requestPaused(),
        request -> {
          if (request.getRequest().getUrl().contains(content)) {
            String mockedUrl = request.getRequest().getUrl().replace(content, replaceContent);
            devTools.send(
                Fetch.continueRequest(
                    request.getRequestId(),
                    Optional.of(mockedUrl),
                    Optional.of(request.getRequest().getMethod()),
                    Optional.empty(),
                    Optional.empty(),
                    Optional.empty()));
          } else {
            devTools.send(
                Fetch.continueRequest(
                    request.getRequestId(),
                    Optional.of(request.getRequest().getUrl()),
                    Optional.of(request.getRequest().getMethod()),
                    Optional.empty(),
                    Optional.empty(),
                    Optional.empty()));
          }
        });
  }
}

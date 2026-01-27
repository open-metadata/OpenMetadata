package org.openmetadata.service.notifications.channels;

import lombok.experimental.UtilityClass;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

@UtilityClass
public final class HtmlSanitizer {

  private static final PolicyFactory EMAIL_POLICY =
      new HtmlPolicyBuilder()
          .allowElements("p", "br", "div", "span")
          .allowAttributes("style", "class")
          .onElements("div", "pre", "code")
          .allowElements("ul", "ol", "li")
          .allowElements("strong", "b", "em", "i", "u", "s", "del")
          .allowElements("pre", "code")
          .allowElements("blockquote")
          .allowElements("h1", "h2", "h3", "h4", "h5", "h6")
          .allowElements("table", "thead", "tbody", "tr", "td", "th")
          .allowAttributes("class")
          .onElements("table", "thead", "tbody", "tr", "td", "th")
          .allowElements("a")
          .allowAttributes("href", "title")
          .onElements("a")
          .allowElements("img")
          .allowAttributes("src", "alt", "title", "width", "height")
          .onElements("img")
          .allowUrlProtocols("https", "http")
          .requireRelNofollowOnLinks()
          .toFactory();

  public static String sanitize(String html) {
    if (html == null || html.isEmpty()) {
      return "";
    }
    return EMAIL_POLICY.sanitize(html);
  }
}

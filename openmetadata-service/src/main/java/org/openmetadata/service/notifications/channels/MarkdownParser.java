package org.openmetadata.service.notifications.channels;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.commonmark.Extension;
import org.commonmark.ext.autolink.AutolinkExtension;
import org.commonmark.ext.gfm.strikethrough.StrikethroughExtension;
import org.commonmark.ext.gfm.tables.TablesExtension;
import org.commonmark.node.Node;
import org.commonmark.parser.Parser;

@Slf4j
public final class MarkdownParser {

  private MarkdownParser() {}

  private static final Parser PARSER;
  private static final int MAX_INPUT_LENGTH = 50_000;

  static {
    List<Extension> extensions =
        List.of(
            AutolinkExtension.create(), StrikethroughExtension.create(), TablesExtension.create());
    PARSER = Parser.builder().extensions(extensions).build();
  }

  public static Node parse(String markdown) {
    if (markdown == null || markdown.isEmpty()) {
      return PARSER.parse("");
    }

    if (markdown.length() > MAX_INPUT_LENGTH) {
      LOG.warn("Markdown input too large: {} characters", markdown.length());
      throw new IllegalArgumentException(
          "Markdown content exceeds maximum length of " + MAX_INPUT_LENGTH);
    }

    return PARSER.parse(markdown);
  }
}

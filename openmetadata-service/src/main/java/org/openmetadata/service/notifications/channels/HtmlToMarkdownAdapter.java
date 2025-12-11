package org.openmetadata.service.notifications.channels;

import com.vladsch.flexmark.html2md.converter.FlexmarkHtmlConverter;
import com.vladsch.flexmark.html2md.converter.HtmlMarkdownWriter;
import com.vladsch.flexmark.html2md.converter.HtmlNodeConverterContext;
import com.vladsch.flexmark.html2md.converter.HtmlNodeRenderer;
import com.vladsch.flexmark.html2md.converter.HtmlNodeRendererFactory;
import com.vladsch.flexmark.html2md.converter.HtmlNodeRendererHandler;
import com.vladsch.flexmark.util.data.DataHolder;
import com.vladsch.flexmark.util.data.MutableDataSet;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.jsoup.nodes.Element;

@Slf4j
public class HtmlToMarkdownAdapter implements TemplateFormatAdapter {

  private static final FlexmarkHtmlConverter CONVERTER =
      FlexmarkHtmlConverter.builder(new MutableDataSet())
          .htmlNodeRendererFactory(new CodeAndPreRenderer.Factory())
          .htmlNodeRendererFactory(new InlineElementRenderer.Factory())
          .build();
  private static final HtmlToMarkdownAdapter INSTANCE = new HtmlToMarkdownAdapter();

  private HtmlToMarkdownAdapter() {}

  public static HtmlToMarkdownAdapter getInstance() {
    return INSTANCE;
  }

  @Override
  public String adapt(String templateContent) {
    if (templateContent == null || templateContent.isEmpty()) return "";
    try {
      return CONVERTER.convert(templateContent);
    } catch (Exception e) {
      LOG.error("Failed to convert HTML to Markdown", e);
      return "";
    }
  }

  /** Handles both <pre> and <code> so we can decide inline vs fenced. */
  static class CodeAndPreRenderer implements HtmlNodeRenderer {
    CodeAndPreRenderer(DataHolder options) {}

    @Override
    public @NotNull Set<HtmlNodeRendererHandler<?>> getHtmlNodeRendererHandlers() {
      return new HashSet<>(
          Arrays.asList(
              new HtmlNodeRendererHandler<>("pre", Element.class, this::renderPre),
              new HtmlNodeRendererHandler<>("code", Element.class, this::renderCode)));
    }

    /** Let children render; we don't output anything for <pre> itself. */
    private void renderPre(Element pre, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      // Delegate to children so the <code> handler gets invoked.
      ctx.renderChildren(pre, false, null);
    }

    /** Render <code> as fenced block if parent is <pre>; otherwise inline code. */
    private void renderCode(Element code, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      boolean isBlock = code.parent() != null && "pre".equalsIgnoreCase(code.parent().tagName());

      if (isBlock) {
        writeFenced(code, out);
      } else {
        writeInline(code, out);
      }
    }

    /** Fenced block renderer for <pre><code>…</code></pre>. */
    private void writeFenced(Element code, HtmlMarkdownWriter out) {
      // Preserve whitespace/newlines exactly as in HTML <pre>
      String codeText = code.wholeText();

      // Optional language from class="language-xyz" or "lang-xyz"
      String lang = "";
      String klass = code.className();
      if (!klass.isEmpty()) {
        for (String c : klass.split("\\s+")) {
          if (c.startsWith("language-")) {
            lang = c.substring("language-".length());
            break;
          }
          if (c.startsWith("lang-")) {
            lang = c.substring("lang-".length());
            break;
          }
        }
      }

      // Choose a fence that won't collide with content
      String fence = codeText.contains("```") ? "~~~~" : "```";

      out.blankLine();
      out.append(fence);
      if (!lang.isEmpty()) out.append(lang);
      out.line();

      out.append(codeText);
      if (!codeText.endsWith("\n")) out.line();

      out.append(fence);
      out.blankLine();
    }

    /** Inline code renderer for bare <code>…</code>. */
    private void writeInline(Element code, HtmlMarkdownWriter out) {
      // For inline, collapse newlines to spaces and trim outer whitespace
      String text = code.text().replace('\n', ' ').replace('\r', ' ').trim();

      // If the inline text contains backticks, use double backticks as the fence
      boolean hasBacktick = text.indexOf('`') >= 0;
      String tick = hasBacktick ? "``" : "`";

      out.append(tick).append(text).append(tick);
    }

    static class Factory implements HtmlNodeRendererFactory {
      @Override
      public HtmlNodeRenderer apply(DataHolder options) {
        return new CodeAndPreRenderer(options);
      }
    }
  }

  /** Handles inline formatting elements to prevent unwanted spacing. */
  static class InlineElementRenderer implements HtmlNodeRenderer {
    InlineElementRenderer(DataHolder options) {}

    @Override
    public @NotNull Set<HtmlNodeRendererHandler<?>> getHtmlNodeRendererHandlers() {
      return new HashSet<>(
          Arrays.asList(
              new HtmlNodeRendererHandler<>("strong", Element.class, this::renderStrong),
              new HtmlNodeRendererHandler<>("b", Element.class, this::renderStrong),
              new HtmlNodeRendererHandler<>("em", Element.class, this::renderEmphasis),
              new HtmlNodeRendererHandler<>("i", Element.class, this::renderEmphasis),
              new HtmlNodeRendererHandler<>("s", Element.class, this::renderStrikethrough),
              new HtmlNodeRendererHandler<>("del", Element.class, this::renderStrikethrough),
              new HtmlNodeRendererHandler<>("strike", Element.class, this::renderStrikethrough),
              new HtmlNodeRendererHandler<>("a", Element.class, this::renderLink)));
    }

    private void renderStrong(Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      out.append("**");
      ctx.renderChildren(elem, false, null);
      out.append("**");
    }

    private void renderEmphasis(
        Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      out.append("*");
      ctx.renderChildren(elem, false, null);
      out.append("*");
    }

    private void renderStrikethrough(
        Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      out.append("~~");
      ctx.renderChildren(elem, false, null);
      out.append("~~");
    }

    private void renderLink(Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      String href = elem.attr("href");
      if (href.isEmpty()) {
        ctx.renderChildren(elem, false, null);
        return;
      }

      // Collect link text
      out.append("[");
      ctx.renderChildren(elem, false, null);
      out.append("](").append(href).append(")");
    }

    static class Factory implements HtmlNodeRendererFactory {
      @Override
      public HtmlNodeRenderer apply(DataHolder options) {
        return new InlineElementRenderer(options);
      }
    }
  }
}

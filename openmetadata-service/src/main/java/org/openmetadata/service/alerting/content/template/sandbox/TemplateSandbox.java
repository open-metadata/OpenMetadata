package org.openmetadata.service.alerting.content.template.sandbox;

import com.github.jknack.handlebars.Context;
import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.context.MapValueResolver;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.service.alerting.content.template.handlebars.HandlebarsHelper;

/**
 * The one engine that renders templates written by users. A template reads plain data through the
 * helpers it is given and nothing else: no Java object, method, file or other template is reachable
 * from it. See ADR:2026-11-03-user-notification-templates-render-in-a-closed-sandbox.
 */
public final class TemplateSandbox {

  private final Handlebars handlebars;
  private final TemplateConstructScanner scanner;

  public TemplateSandbox(List<HandlebarsHelper> helpers) {
    SandboxHelperRegistry registry = new SandboxHelperRegistry();
    this.handlebars =
        new Handlebars(new RefusingTemplateLoader())
            .with(registry)
            .with(EscapingStrategy.HTML_ENTITY);
    helpers.forEach(helper -> helper.register(handlebars));
    registry.seal();
    this.scanner = new TemplateConstructScanner(registry.helperNames());
  }

  /** Refuses a template that does not compile or uses a construct the sandbox does not offer. */
  public void check(String template) throws IOException {
    compile(template);
  }

  public String render(String template, Map<String, Object> context) throws IOException {
    Context data =
        Context.newBuilder(TemplateData.of(context))
            .resolver(MapValueResolver.INSTANCE, ListLengthResolver.INSTANCE)
            .build();
    try {
      return compile(template).apply(data);
    } finally {
      data.destroy();
    }
  }

  private Template compile(String template) throws IOException {
    scanner.requireSupported(template);
    return handlebars.compileInline(template);
  }
}

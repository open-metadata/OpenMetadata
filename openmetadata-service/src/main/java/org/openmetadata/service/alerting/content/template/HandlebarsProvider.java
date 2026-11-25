package org.openmetadata.service.alerting.content.template;

import java.util.List;
import org.openmetadata.service.alerting.content.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.alerting.content.template.handlebars.helpers.*;
import org.openmetadata.service.alerting.content.template.sandbox.TemplateSandbox;

/** Provider of the template sandbox, configured with all helpers for notification templates. */
public class HandlebarsProvider {

  private static final TemplateSandbox INSTANCE = new TemplateSandbox(getAllHelpers());

  private HandlebarsProvider() {
    /* Private constructor for singleton */
  }

  public static TemplateSandbox getInstance() {
    return INSTANCE;
  }

  private static List<HandlebarsHelper> getAllHelpers() {
    return List.of(
        new PluckHelper(),
        new StartsWithHelper(),
        new EndsWithHelper(),
        new EqHelper(),
        new OrHelper(),
        new AndHelper(),
        new NotHelper(),
        new TextDiffHelper(),
        new TruncateHelper(),
        new CamelCaseToTitleHelper(),
        new ResolveDomainHelper(),
        new FormatDateHelper(),
        new GroupEventChangesHelper(),
        new HasFieldInChangesHelper(),
        new SplitHelper(),
        new BuildEntityUrlHelper(),
        new ParseEntityLinkHelper(),
        new ProcessMentionsHelper(),
        new FilterHelper(),
        new LengthHelper(),
        new LimitHelper(),
        new MathHelper(),
        new GtHelper(),
        new RenderTableSampleHelper());
  }

  /**
   * Get all helper instances for metadata extraction. Used by API endpoint to discover available
   * helpers.
   *
   * @return List of all registered helpers
   */
  public static List<HandlebarsHelper> getAllHelperInstances() {
    return getAllHelpers();
  }
}

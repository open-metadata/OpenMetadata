package org.openmetadata.service.notifications.template.handlebars;

import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.notifications.template.handlebars.helpers.AndHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.BuildEntityUrlHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.CamelCaseToTitleHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.EndsWithHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.EqHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.FilterHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.FormatDateHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.GroupEventChangesHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.GtHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.HasFieldInChangesHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.LengthHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.LimitHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.MathHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.NotHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.OrHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.ParseEntityLinkHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.PluckHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.ProcessMentionsHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.ResolveDomainHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.SplitHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.StartsWithHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.TextDiffHelper;
import org.openmetadata.service.notifications.template.handlebars.helpers.TruncateHelper;

/**
 * Provider for Handlebars instances configured with all custom helpers for notification templates.
 */
public class HandlebarsProvider {

  private static final Handlebars INSTANCE = createInstance();

  private HandlebarsProvider() {
    /* Private constructor for singleton */
  }

  public static Handlebars getInstance() {
    return INSTANCE;
  }

  private static Handlebars createInstance() {
    Handlebars handlebars = new Handlebars().with(EscapingStrategy.HTML_ENTITY);

    for (HandlebarsHelper helper : getAllHelpers()) {
      helper.register(handlebars);
    }

    return handlebars;
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
        new GtHelper());
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

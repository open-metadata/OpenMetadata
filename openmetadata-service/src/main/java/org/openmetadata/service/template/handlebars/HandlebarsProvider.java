package org.openmetadata.service.template.handlebars;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.template.handlebars.helpers.BuildEntityUrlHelper;
import org.openmetadata.service.template.handlebars.helpers.DiffHelper;
import org.openmetadata.service.template.handlebars.helpers.EndsWithHelper;
import org.openmetadata.service.template.handlebars.helpers.EqHelper;
import org.openmetadata.service.template.handlebars.helpers.FormatColumnValueHelper;
import org.openmetadata.service.template.handlebars.helpers.FormatDateHelper;
import org.openmetadata.service.template.handlebars.helpers.GroupEventChangesHelper;
import org.openmetadata.service.template.handlebars.helpers.JoinListHelper;
import org.openmetadata.service.template.handlebars.helpers.OrHelper;
import org.openmetadata.service.template.handlebars.helpers.ResolveDomainHelper;
import org.openmetadata.service.template.handlebars.helpers.SplitHelper;
import org.openmetadata.service.template.handlebars.helpers.StartsWithHelper;

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
    Handlebars handlebars = new Handlebars();

    for (HandlebarsHelper helper : getAllHelpers()) {
      helper.register(handlebars);
    }

    return handlebars;
  }

  private static List<HandlebarsHelper> getAllHelpers() {
    return List.of(
        new JoinListHelper(),
        new StartsWithHelper(),
        new EndsWithHelper(),
        new EqHelper(),
        new OrHelper(),
        new DiffHelper(),
        new ResolveDomainHelper(),
        new FormatDateHelper(),
        new FormatColumnValueHelper(),
        new GroupEventChangesHelper(),
        new SplitHelper(),
        new BuildEntityUrlHelper());
  }
}

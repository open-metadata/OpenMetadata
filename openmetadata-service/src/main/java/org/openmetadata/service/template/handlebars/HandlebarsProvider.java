package org.openmetadata.service.template.handlebars;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import org.openmetadata.service.template.handlebars.helpers.*;

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

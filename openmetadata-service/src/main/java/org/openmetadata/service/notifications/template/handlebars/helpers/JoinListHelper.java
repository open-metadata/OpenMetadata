package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;

/**
 * Helper to join lists into comma-separated strings. Usage: {{joinList tags}}
 *
 * <p>Handles TagLabel objects specially by extracting their FQN.
 */
public class JoinListHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "joinList";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return "";
          }

          if (context instanceof Collection<?> collection) {
            return collection.stream()
                .map(this::extractDisplayValue)
                .collect(Collectors.joining(", "));
          }

          return context.toString();
        });
  }

  /**
   * Extracts the display value from an item based on its type.
   * For TagLabel objects, returns the tag FQN.
   * For Maps with tagFQN field, returns that value.
   * Otherwise returns the string representation.
   */
  private String extractDisplayValue(Object item) {
    return switch (item) {
      case TagLabel tagLabel -> {
        String fqn = tagLabel.getTagFQN();
        yield fqn != null ? fqn : "";
      }
      case Map<?, ?> map -> {
        Object tagFQN = map.get("tagFQN");
        yield tagFQN != null ? tagFQN.toString() : item.toString();
      }
      case null -> "";
      default -> item.toString();
    };
  }
}

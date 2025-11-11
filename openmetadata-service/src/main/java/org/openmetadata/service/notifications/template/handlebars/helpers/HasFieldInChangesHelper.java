package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import java.util.stream.Stream;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;
import org.openmetadata.service.notifications.template.handlebars.helpers.GroupEventChangesHelper.ChangeGroups;

/**
 * Helper to check if a specific field name exists in any change category (updates/adds/deletes).
 * Usage: {{#if (hasFieldInChanges changes 'testCaseResult')}}...{{/if}}
 *
 * <p>This helper is typically used with the output of groupEventChanges:
 * {{#with (groupEventChanges event.changeDescription) as |changes|}}
 *   {{#if (hasFieldInChanges changes 'fieldName')}}...{{/if}}
 * {{/with}}
 */
public class HasFieldInChangesHelper implements HandlebarsHelper {

  @Override
  public String getName() {
    return "hasFieldInChanges";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          // Context should be ChangeGroups from groupEventChanges helper
          if (!(context instanceof ChangeGroups groups)) {
            return false;
          }

          // First parameter should be the field name to search for
          if (options.params == null || options.params.length == 0) {
            return false;
          }

          String fieldName = options.param(0).toString();

          // Search for field name in all three lists: updates, adds, deletes
          return Stream.of(groups.updates(), groups.adds(), groups.deletes())
              .flatMap(list -> list.stream())
              .anyMatch(fieldChange -> fieldName.equals(fieldChange.getName()));
        });
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("hasFieldInChanges")
        .withDescription(
            "Checks if a specific field name exists in any change category (updates, adds, or deletes) within a change event.")
        .withCursorOffset(20)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{hasFieldInChanges }}")
                    .withExample(
                        "{{#if (hasFieldInChanges changes \"testCaseResult\")}}Test results changed{{/if}}")));
  }
}

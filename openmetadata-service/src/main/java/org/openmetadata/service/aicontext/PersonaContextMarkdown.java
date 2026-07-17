/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.aicontext;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.Instant;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.aicontext.FieldContext;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.schema.type.aicontext.TableContext;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.schema.type.personaContext.ManifestEntry;
import org.openmetadata.schema.type.personaContext.RuleResult;
import org.openmetadata.schema.type.personaContext.SharedKnowledge;

/** Renders a materialized persona context with monotonic full/compact/manifest degradation. */
final class PersonaContextMarkdown {
  private static final int COMPACT_MAX_CHARS = 1200;
  private static final int DOCUMENT_OVERHEAD_RESERVE = 1024;
  private static final String ASSET_CONTEXT_TOOL = "get_asset_context";

  private PersonaContextMarkdown() {}

  static PersonaContextBuilder.MaterializedPersonaContext render(
      Persona persona,
      PersonaContextDefinition definition,
      List<PersonaContextBuilder.RuleMaterialization> rules,
      PersonaContext context,
      boolean knowledgeOverflowed) {
    int maxChars = PersonaContextBuilder.characterBudget(definition);
    int headingChars = rules.stream().mapToInt(PersonaContextMarkdown::ruleHeadingEstimate).sum();
    Map<PersonaContextBuilder.RuleMaterialization, RuleRenderResult> renderedKnowledge =
        new IdentityHashMap<>();
    int mandatoryKnowledgeChars = 0;
    for (PersonaContextBuilder.RuleMaterialization rule : rules) {
      if (PersonaContextBuilder.isKnowledgeEntityType(rule.rule().getEntityType())) {
        RuleRenderResult rendered = renderKnowledgeRule(rule);
        renderedKnowledge.put(rule, rendered);
        mandatoryKnowledgeChars += rendered.body().length();
      }
    }
    String sharedKnowledge = renderSharedKnowledge(context.getSharedKnowledge());
    mandatoryKnowledgeChars += sharedKnowledge.length();
    int contentBudget = Math.max(0, maxChars - headingChars - DOCUMENT_OVERHEAD_RESERVE);
    BudgetTracker budget = new BudgetTracker(Math.max(0, contentBudget - mandatoryKnowledgeChars));
    List<RuleResult> ruleResults = new ArrayList<>();
    List<ManifestEntry> manifest = new ArrayList<>();
    StringBuilder body = new StringBuilder();
    RenderTier tier = RenderTier.FULL;

    for (PersonaContextBuilder.RuleMaterialization rule : rules) {
      RuleRenderResult rendered =
          PersonaContextBuilder.isKnowledgeEntityType(rule.rule().getEntityType())
              ? renderedKnowledge.get(rule)
              : renderAssetRule(rule, budget, tier, manifest);
      if (!PersonaContextBuilder.isKnowledgeEntityType(rule.rule().getEntityType())) {
        tier = rendered.nextTier();
      }
      ruleResults.add(rendered.result());
      body.append(ruleHeading(rule, rendered.result())).append(rendered.body());
    }
    body.append(sharedKnowledge);
    appendManifest(body, manifest);

    boolean truncated =
        knowledgeOverflowed || mandatoryKnowledgeChars > contentBudget || !manifest.isEmpty();
    context.withRules(ruleResults).withManifest(manifest).withTruncated(truncated);

    String definitionHash = PersonaContextHash.definitionHash(definition);
    context.withFingerprint(definitionHash);
    int tokensEstimate = Math.max(1, (renderTitle(persona).length() + body.length()) / 4);
    String deterministicContent = renderTitle(persona) + body;
    context.withFingerprint(
        definitionHash + ':' + PersonaContextHash.contentHash(deterministicContent));
    String markdown =
        (frontmatter(context, maxChars, tokensEstimate) + renderTitle(persona) + body).strip()
            + "\n";
    return new PersonaContextBuilder.MaterializedPersonaContext(context, markdown);
  }

  private static RuleRenderResult renderKnowledgeRule(
      PersonaContextBuilder.RuleMaterialization rule) {
    StringBuilder body = new StringBuilder();
    List<AIContext> entities = new ArrayList<>();
    for (PersonaContextBuilder.SelectedEntity selected : rule.entities()) {
      body.append(renderKnowledgeEntity(selected, Set.of(), true));
      entities.add(selected.context());
    }
    RuleResult result =
        new RuleResult()
            .withRuleName(rule.rule().getName())
            .withEntityType(rule.rule().getEntityType())
            .withMatched(rule.matched())
            .withRenderedFull(entities.size())
            .withRenderedCompact(0)
            .withManifestOnly(0)
            .withEntities(entities);
    return new RuleRenderResult(result, body.toString(), RenderTier.FULL);
  }

  private static String renderKnowledgeEntity(
      PersonaContextBuilder.SelectedEntity selected,
      Set<ContextSection> sections,
      boolean fullyRendered) {
    KnowledgeItem item = selected.knowledgeItem();
    if (item == null) {
      return "";
    }
    StringBuilder markdown = new StringBuilder();
    markdown
        .append("\n## ")
        .append(knowledgeTypeLabel(item))
        .append(": ")
        .append(labelOf(item))
        .append('\n');
    if (!nullOrEmpty(item.getFullyQualifiedName())) {
      markdown.append('`').append(item.getFullyQualifiedName()).append("`\n");
    }
    EntityInterface entity = selected.knowledgeEntity();
    if (entity == null) {
      if (!nullOrEmpty(item.getContent())) {
        markdown.append('\n').append(item.getContent().strip()).append('\n');
      }
      return markdown.toString();
    }
    appendKnowledgeSections(markdown, entity, sections, fullyRendered);
    return markdown.toString();
  }

  private static void appendKnowledgeSections(
      StringBuilder markdown,
      EntityInterface entity,
      Set<ContextSection> sections,
      boolean fullyRendered) {
    if (entity instanceof Page page) {
      appendArticleSections(markdown, page, sections, fullyRendered);
    } else if (entity instanceof Metric metric) {
      appendMetricSections(markdown, metric, sections, fullyRendered);
    } else if (entity instanceof GlossaryTerm term) {
      appendGlossarySections(markdown, term, sections, fullyRendered);
    }
  }

  private static void appendArticleSections(
      StringBuilder markdown, Page page, Set<ContextSection> sections, boolean all) {
    String content = page.getDescription();
    if ((all || sections.contains(ContextSection.TITLE_SUMMARY)) && !nullOrEmpty(content)) {
      appendSection(markdown, "Summary", firstLine(content));
    }
    if ((all || sections.contains(ContextSection.FULL_BODY)) && !nullOrEmpty(content)) {
      appendSection(markdown, "Full Body", content);
    }
    if (all || sections.contains(ContextSection.TAGS)) {
      appendTags(markdown, page.getTags());
    }
    if (all || sections.contains(ContextSection.GLOSSARY_TERMS)) {
      appendGlossaryTags(markdown, page.getTags());
    }
    if (all || sections.contains(ContextSection.RELATED_ASSETS)) {
      appendReferences(markdown, "Related Assets", page.getRelatedEntities());
    }
  }

  private static void appendMetricSections(
      StringBuilder markdown, Metric metric, Set<ContextSection> sections, boolean all) {
    if ((all || sections.contains(ContextSection.DEFINITION))
        && !nullOrEmpty(metric.getDescription())) {
      appendSection(markdown, "Definition", metric.getDescription());
    }
    if ((all || sections.contains(ContextSection.FORMULA_EXPRESSION))
        && metric.getMetricExpression() != null
        && !nullOrEmpty(metric.getMetricExpression().getCode())) {
      String language =
          metric.getMetricExpression().getLanguage() == null
              ? "text"
              : metric.getMetricExpression().getLanguage().value().toLowerCase();
      appendSection(
          markdown,
          "Formula / Expression",
          "```" + language + '\n' + metric.getMetricExpression().getCode() + "\n```");
    }
    if (all || sections.contains(ContextSection.UNIT_GRAIN)) {
      List<String> values = new ArrayList<>();
      if (!nullOrEmpty(metric.getCustomUnitOfMeasurement())) {
        values.add("Unit: " + metric.getCustomUnitOfMeasurement());
      } else if (metric.getUnitOfMeasurement() != null) {
        values.add("Unit: " + metric.getUnitOfMeasurement().value());
      }
      if (metric.getGranularity() != null) {
        values.add("Grain: " + metric.getGranularity().value());
      }
      if (!values.isEmpty()) {
        appendSection(markdown, "Unit & Grain", String.join("\n\n", values));
      }
    }
    if (all || sections.contains(ContextSection.OWNER)) {
      appendReferences(markdown, "Owners", metric.getOwners());
    }
    if (all || sections.contains(ContextSection.TAGS)) {
      appendTags(markdown, metric.getTags());
    }
    if (all || sections.contains(ContextSection.RELATED_ASSETS)) {
      appendReferences(markdown, "Related Assets", metric.getAssets());
    }
  }

  private static void appendGlossarySections(
      StringBuilder markdown, GlossaryTerm term, Set<ContextSection> sections, boolean all) {
    if ((all || sections.contains(ContextSection.DEFINITION))
        && !nullOrEmpty(term.getDescription())) {
      appendSection(markdown, "Definition", term.getDescription());
    }
    if ((all || sections.contains(ContextSection.SYNONYMS))
        && !listOrEmpty(term.getSynonyms()).isEmpty()) {
      appendSection(markdown, "Synonyms", String.join(", ", term.getSynonyms()));
    }
    if (all || sections.contains(ContextSection.RELATED_TERMS)) {
      appendRelatedTerms(markdown, term.getRelatedTerms());
    }
    if (all || sections.contains(ContextSection.TAGS)) {
      appendTags(markdown, term.getTags());
    }
    if (all || sections.contains(ContextSection.RELATED_ASSETS)) {
      appendSection(
          markdown,
          "Related Assets",
          "Resolve assets tagged with `" + term.getFullyQualifiedName() + "` in Explore.");
    }
  }

  private static void appendSection(StringBuilder markdown, String heading, String content) {
    if (!nullOrEmpty(content)) {
      markdown.append("\n### ").append(heading).append("\n\n").append(content.strip()).append('\n');
    }
  }

  private static void appendTags(StringBuilder markdown, List<TagLabel> tags) {
    List<String> labels =
        listOrEmpty(tags).stream()
            .filter(
                tag ->
                    tag.getSource() == null
                        || !"Glossary".equalsIgnoreCase(tag.getSource().value()))
            .map(TagLabel::getTagFQN)
            .filter(value -> !nullOrEmpty(value))
            .toList();
    if (!labels.isEmpty()) {
      appendSection(markdown, "Tags", String.join(", ", labels));
    }
  }

  private static void appendGlossaryTags(StringBuilder markdown, List<TagLabel> tags) {
    List<String> labels =
        listOrEmpty(tags).stream()
            .filter(
                tag ->
                    tag.getSource() != null && "Glossary".equalsIgnoreCase(tag.getSource().value()))
            .map(TagLabel::getTagFQN)
            .filter(value -> !nullOrEmpty(value))
            .toList();
    if (!labels.isEmpty()) {
      appendSection(markdown, "Related Glossary Terms", String.join(", ", labels));
    }
  }

  private static void appendReferences(
      StringBuilder markdown, String heading, List<EntityReference> references) {
    List<String> labels =
        listOrEmpty(references).stream()
            .map(PersonaContextMarkdown::referenceLabel)
            .filter(value -> !nullOrEmpty(value))
            .map(value -> "- `" + value + '`')
            .toList();
    if (!labels.isEmpty()) {
      appendSection(markdown, heading, String.join("\n", labels));
    }
  }

  private static void appendRelatedTerms(StringBuilder markdown, List<TermRelation> relations) {
    List<String> labels =
        listOrEmpty(relations).stream()
            .filter(relation -> relation.getTerm() != null)
            .map(
                relation ->
                    "- `"
                        + referenceLabel(relation.getTerm())
                        + "` ("
                        + relation.getRelationType()
                        + ')')
            .toList();
    if (!labels.isEmpty()) {
      appendSection(markdown, "Related Terms", String.join("\n", labels));
    }
  }

  private static String referenceLabel(EntityReference reference) {
    if (reference == null) {
      return null;
    }
    return !nullOrEmpty(reference.getFullyQualifiedName())
        ? reference.getFullyQualifiedName()
        : !nullOrEmpty(reference.getDisplayName())
            ? reference.getDisplayName()
            : reference.getName();
  }

  private static RuleRenderResult renderAssetRule(
      PersonaContextBuilder.RuleMaterialization rule,
      BudgetTracker budget,
      RenderTier currentTier,
      List<ManifestEntry> manifest) {
    StringBuilder body = new StringBuilder();
    List<AIContext> renderedEntities = new ArrayList<>();
    int full = 0;
    int compact = 0;
    int omitted = 0;
    RenderTier tier = currentTier;
    Set<ContextSection> sections = PersonaContextBuilder.selectedSections(rule.rule());

    for (PersonaContextBuilder.SelectedEntity selected : rule.entities()) {
      AIContext entity = selected.context();
      if (tier == RenderTier.FULL) {
        String fragment = renderFullEntity(entity, sections);
        if (budget.tryConsume(fragment)) {
          body.append(fragment);
          renderedEntities.add(entity);
          full++;
          continue;
        }
        tier = RenderTier.COMPACT;
      }
      if (tier == RenderTier.COMPACT) {
        String fragment = renderCompactEntity(entity);
        if (budget.tryConsume(fragment)) {
          body.append(fragment);
          renderedEntities.add(entity);
          manifest.add(manifestEntry(entity, ManifestEntry.Reason.COMPACT));
          compact++;
          continue;
        }
        tier = RenderTier.MANIFEST;
      }
      manifest.add(manifestEntry(entity, ManifestEntry.Reason.OMITTED));
      omitted++;
    }

    RuleResult result =
        new RuleResult()
            .withRuleName(rule.rule().getName())
            .withEntityType(rule.rule().getEntityType())
            .withMatched(rule.matched())
            .withRenderedFull(full)
            .withRenderedCompact(compact)
            .withManifestOnly(omitted)
            .withEntities(renderedEntities);
    return new RuleRenderResult(result, body.toString(), tier);
  }

  private static String renderFullEntity(AIContext context, Set<ContextSection> sections) {
    StringBuilder markdown = new StringBuilder();
    markdown
        .append("\n## ")
        .append(entityTypeLabel(context.getEntityType()))
        .append(": ")
        .append(titleOf(context))
        .append('\n');
    if (!nullOrEmpty(context.getFullyQualifiedName())) {
      markdown.append('`').append(context.getFullyQualifiedName()).append("`\n");
    }
    AIContextMarkdown.appendEntitySections(markdown, context, sections, "###");
    if (sections.contains(ContextSection.PROFILE)) {
      boolean hasProfileSummary =
          context.getObservability() != null && context.getObservability().getRowCount() != null;
      if (!hasProfileSummary) {
        markdown.append("\n### Data Profile\n");
      }
      if (context.getObservability() != null
          && context.getObservability().getProfiledAt() != null) {
        markdown
            .append("\n**Profiled at:** ")
            .append(Instant.ofEpochMilli(context.getObservability().getProfiledAt()))
            .append('\n');
      }
      markdown
          .append("\n_Column-level profile details are caller-sensitive; fetch ")
          .append(contextToolCall(context.getEntityType(), context.getFullyQualifiedName()))
          .append(" for the latest permitted profile._\n");
    }
    return markdown.toString();
  }

  private static String renderCompactEntity(AIContext context) {
    String marker =
        "\n_Compact rendering — fetch "
            + contextToolCall(context.getEntityType(), context.getFullyQualifiedName())
            + " for the complete asset context._\n";
    StringBuilder compact = new StringBuilder();
    compact
        .append("\n## ")
        .append(entityTypeLabel(context.getEntityType()))
        .append(": ")
        .append(titleOf(context))
        .append('\n');
    if (!nullOrEmpty(context.getFullyQualifiedName())) {
      compact.append('`').append(context.getFullyQualifiedName()).append("`\n");
    }
    String description = firstLine(context.getDescription());
    if (!nullOrEmpty(description)) {
      compact.append('\n').append(description).append('\n');
    }
    appendCompactColumns(compact, context);
    int contentLimit = Math.max(0, COMPACT_MAX_CHARS - marker.length());
    String content =
        compact.length() > contentLimit ? compact.substring(0, contentLimit) : compact.toString();
    return content.stripTrailing() + marker;
  }

  private static void appendCompactColumns(StringBuilder markdown, AIContext context) {
    if (context.getAssetContext() == null || context.getAssetContext().getTable() == null) {
      return;
    }
    TableContext table = context.getAssetContext().getTable();
    if (listOrEmpty(table.getColumns()).isEmpty()) {
      return;
    }
    markdown.append("\n**Columns:** ");
    int count = 0;
    for (FieldContext column : table.getColumns()) {
      if (count > 0) {
        markdown.append(", ");
      }
      markdown.append('`').append(column.getName());
      if (!nullOrEmpty(column.getDataType())) {
        markdown.append(':').append(column.getDataType());
      }
      markdown.append('`');
      count++;
      if (count == 40) {
        markdown.append(", …");
        break;
      }
    }
    markdown.append('\n');
  }

  private static String renderSharedKnowledge(SharedKnowledge shared) {
    if (shared == null
        || (listOrEmpty(shared.getGlossaryTerms()).isEmpty()
            && listOrEmpty(shared.getMetrics()).isEmpty()
            && listOrEmpty(shared.getArticles()).isEmpty())) {
      return "";
    }
    StringBuilder markdown = new StringBuilder("\n# Shared Knowledge\n");
    appendSharedKnowledge(markdown, shared.getGlossaryTerms());
    appendSharedKnowledge(markdown, shared.getMetrics());
    appendSharedKnowledge(markdown, shared.getArticles());
    return markdown.toString();
  }

  private static void appendSharedKnowledge(StringBuilder markdown, List<KnowledgeItem> items) {
    for (KnowledgeItem item : listOrEmpty(items)) {
      markdown.append(renderKnowledgeItem(item));
    }
  }

  private static String renderKnowledgeItem(KnowledgeItem item) {
    StringBuilder markdown =
        new StringBuilder("\n## ")
            .append(knowledgeTypeLabel(item))
            .append(": ")
            .append(labelOf(item))
            .append('\n');
    // Emit a ready-to-cite chat entity link so the agent renders this metric / glossary term /
    // article as a clickable link (like it does for tables), instead of leaving it as plain text.
    // Fall back to the bare backticked FQN for types with no chat-linkable form (e.g. knowledge
    // pills). See the entity-link format in SharedChatGuardrails (FORMATTING_RULES).
    String chatLink = chatEntityLink(item);
    if (chatLink != null) {
      markdown.append(chatLink).append('\n');
    } else if (!nullOrEmpty(item.getFullyQualifiedName())) {
      markdown.append('`').append(item.getFullyQualifiedName()).append("`\n");
    }
    if (!nullOrEmpty(item.getContent())) {
      markdown.append('\n').append(item.getContent().strip()).append('\n');
    }
    return markdown.toString();
  }

  /**
   * Builds a chat entity link ({@code [label](#entityType/fqn)}) for a knowledge item so the agent
   * can cite it directly. Returns null when the item has no fqn or its type has no chat-linkable
   * form (a context-memory knowledge pill is not a browsable entity). The fqn path segment is
   * percent-encoded for the characters the chat UI expects (space, parentheses), matching the entity
   * link format the agent's formatting rules use.
   */
  private static String chatEntityLink(KnowledgeItem item) {
    if (item.getType() == null || nullOrEmpty(item.getFullyQualifiedName())) {
      return null;
    }
    String entityType =
        switch (item.getType()) {
          case METRIC -> "metric";
          case GLOSSARY_TERM -> "glossaryTerm";
          case PAGE -> "page";
          default -> null;
        };
    if (entityType == null) {
      return null;
    }
    String encodedFqn =
        item.getFullyQualifiedName().replace(" ", "%20").replace("(", "%28").replace(")", "%29");
    // Escape Markdown link-text delimiters so a display name like "Revenue [YTD]" does not
    // terminate the link text early and produce a broken link.
    String label = labelOf(item).replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]");
    return "[" + label + "](#" + entityType + "/" + encodedFqn + ")";
  }

  private static void appendManifest(StringBuilder markdown, List<ManifestEntry> manifest) {
    if (manifest.isEmpty()) {
      return;
    }
    markdown.append("\n# Overflow Manifest\n");
    for (ManifestEntry entry : manifest) {
      markdown
          .append("\n- `")
          .append(entry.getFullyQualifiedName())
          .append("` (")
          .append(entry.getEntityType())
          .append(") — ")
          .append(entry.getReason().value())
          .append("; fetch ")
          .append(contextToolCall(entry.getEntityType(), entry.getFullyQualifiedName()));
    }
    markdown.append('\n');
  }

  private static String frontmatter(
      PersonaContext context, int characterBudget, int tokensEstimate) {
    int matched =
        listOrEmpty(context.getRules()).stream().mapToInt(rule -> value(rule.getMatched())).sum();
    int rendered =
        listOrEmpty(context.getRules()).stream()
            .mapToInt(rule -> value(rule.getRenderedFull()) + value(rule.getRenderedCompact()))
            .sum();
    return "---\n"
        + "kind: personaContext\n"
        + "persona: "
        + yamlQuote(
            context.getPersona() == null ? null : context.getPersona().getFullyQualifiedName())
        + "\n"
        + "generated_at: "
        + yamlQuote(Instant.ofEpochMilli(context.getGeneratedAt()).toString())
        + "\n"
        + "budget: "
        + characterBudget
        + "\n"
        + "tokens_est: "
        + tokensEstimate
        + "\n"
        + "fingerprint: "
        + yamlQuote(context.getFingerprint())
        + "\n"
        + "rules: "
        + listOrEmpty(context.getRules()).size()
        + "\n"
        + "matched: "
        + matched
        + "\n"
        + "rendered: "
        + rendered
        + "\n"
        + "truncated: "
        + Boolean.TRUE.equals(context.getTruncated())
        + "\n---\n";
  }

  private static String renderTitle(Persona persona) {
    String title =
        !nullOrEmpty(persona.getDisplayName()) ? persona.getDisplayName() : persona.getName();
    StringBuilder markdown = new StringBuilder("\n# Persona context: ").append(title).append('\n');
    if (!nullOrEmpty(persona.getDescription())) {
      markdown.append('\n').append(persona.getDescription().strip()).append('\n');
    }
    return markdown.toString();
  }

  private static String ruleHeading(
      PersonaContextBuilder.RuleMaterialization rule, RuleResult rendered) {
    int renderedCount = value(rendered.getRenderedFull()) + value(rendered.getRenderedCompact());
    return "\n# Rule: "
        + rule.rule().getName()
        + " ("
        + rule.rule().getEntityType()
        + ") — "
        + rule.matched()
        + " matched, "
        + renderedCount
        + " rendered\n";
  }

  private static int ruleHeadingEstimate(PersonaContextBuilder.RuleMaterialization rule) {
    return rule.rule().getName().length() + rule.rule().getEntityType().length() + 96;
  }

  private static ManifestEntry manifestEntry(AIContext context, ManifestEntry.Reason reason) {
    return new ManifestEntry()
        .withEntityType(context.getEntityType())
        .withFullyQualifiedName(context.getFullyQualifiedName())
        .withReason(reason);
  }

  static String contextToolCall(String entityType, String fqn) {
    return ASSET_CONTEXT_TOOL
        + "(entityType=`"
        + AIContextMarkdown.inlineCodeValue(entityType)
        + "`, fqn=`"
        + AIContextMarkdown.inlineCodeValue(fqn)
        + "`)";
  }

  private static String entityTypeLabel(String entityType) {
    if (nullOrEmpty(entityType)) {
      return "Entity";
    }
    String spaced = entityType.replaceAll("([a-z])([A-Z])", "$1 $2");
    return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
  }

  private static String knowledgeTypeLabel(KnowledgeItem item) {
    return item.getType() == null
        ? "Knowledge"
        : switch (item.getType()) {
          case GLOSSARY_TERM -> "Glossary Term";
          case METRIC -> "Metric";
          case PAGE -> "Article";
          case CONTEXT_MEMORY -> "Knowledge Pill";
        };
  }

  private static String titleOf(AIContext context) {
    return !nullOrEmpty(context.getDisplayName())
        ? context.getDisplayName()
        : context.getFullyQualifiedName();
  }

  private static String labelOf(KnowledgeItem item) {
    return !nullOrEmpty(item.getDisplayName()) ? item.getDisplayName() : item.getName();
  }

  private static String firstLine(String value) {
    if (nullOrEmpty(value)) {
      return null;
    }
    String line = value.strip().split("\n", 2)[0].strip();
    return line.length() > 240 ? line.substring(0, 240) + "…" : line;
  }

  private static String yamlQuote(String value) {
    String safe = value == null ? "" : value;
    return '"'
        + safe.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ")
        + '"';
  }

  private static int value(Integer number) {
    return number == null ? 0 : number;
  }

  private enum RenderTier {
    FULL,
    COMPACT,
    MANIFEST
  }

  private record RuleRenderResult(RuleResult result, String body, RenderTier nextTier) {}
}

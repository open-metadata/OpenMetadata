package org.openmetadata.service.context;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.security.Authorizer;

/** Builds prompt-safe structured context from files and pages attached to a chat request. */
public class ContextEntityPromptService {
  static final int TOTAL_TOKEN_BUDGET = 2500;
  static final int MAX_ENTITIES = 5;
  static final int MAX_TOKENS_PER_ENTITY = 900;
  private static final int MAX_RELEVANT_CHUNKS = 3;
  private static final int CHUNK_TARGET_CHARS = 1600;
  private static final int CHUNK_OVERLAP_CHARS = 250;
  private static final Pattern NON_WORD = Pattern.compile("[^a-z0-9]+");
  private static final Set<String> STOP_WORDS =
      Set.of(
          "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "how", "i",
          "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "what", "when", "where",
          "which", "who", "why", "with");

  private final ContextEntityPromptLoader loader;

  public ContextEntityPromptService(Authorizer authorizer) {
    this(new DefaultContextEntityPromptLoader(authorizer));
  }

  ContextEntityPromptService(ContextEntityPromptLoader loader) {
    this.loader = loader;
  }

  public ContextPromptInjectionResult assemble(
      SecurityContext securityContext, List<EntityReference> contextEntities) {
    return assemble(securityContext, contextEntities, null);
  }

  public ContextPromptInjectionResult assemble(
      SecurityContext securityContext, List<EntityReference> contextEntities, String query) {
    if (contextEntities == null || contextEntities.isEmpty()) {
      return ContextPromptInjectionResult.empty();
    }

    List<EntityReference> deduplicated = deduplicate(contextEntities);
    List<EntityReference> usedEntityRefs = new ArrayList<>();
    StringBuilder prompt = new StringBuilder();
    int totalTokens = 0;

    for (EntityReference reference : deduplicated) {
      if (usedEntityRefs.size() >= MAX_ENTITIES || totalTokens >= TOTAL_TOKEN_BUDGET) {
        break;
      }

      Optional<ResolvedContextEntity> resolved = loader.load(securityContext, reference);
      if (resolved.isEmpty()) {
        continue;
      }

      String section =
          buildSection(
              resolved.get(),
              query,
              Math.min(TOTAL_TOKEN_BUDGET - totalTokens, MAX_TOKENS_PER_ENTITY));
      if (nullOrEmpty(section)) {
        continue;
      }

      prompt.append(section).append("\n\n");
      usedEntityRefs.add(resolved.get().reference());
      totalTokens += TokenCounter.countTokens(section);
    }

    if (prompt.isEmpty()) {
      return ContextPromptInjectionResult.empty();
    }

    String formatted = "<context_entities>\n" + prompt.toString().trim() + "\n</context_entities>";
    return new ContextPromptInjectionResult(formatted, List.copyOf(usedEntityRefs), totalTokens);
  }

  private List<EntityReference> deduplicate(List<EntityReference> contextEntities) {
    LinkedHashMap<String, EntityReference> deduplicated = new LinkedHashMap<>();
    for (EntityReference reference : contextEntities) {
      if (reference == null || reference.getId() == null || nullOrEmpty(reference.getType())) {
        continue;
      }
      deduplicated.putIfAbsent(reference.getType() + ":" + reference.getId(), reference);
    }
    return new ArrayList<>(deduplicated.values());
  }

  private String buildSection(ResolvedContextEntity entity, String query, int maxTokens) {
    if (maxTokens <= 0) {
      return "";
    }

    StringBuilder header = new StringBuilder();
    header.append("### ").append(entity.label()).append(": ").append(entity.title()).append("\n");
    if (!nullOrEmpty(entity.location())) {
      header.append("Reference: ").append(entity.location()).append("\n");
    }
    if (!nullOrEmpty(entity.summary())) {
      header.append("Summary: ").append(entity.summary()).append("\n");
    }

    String headerText = header.toString();
    int headerTokens = TokenCounter.countTokens(headerText);
    if (headerTokens >= maxTokens) {
      return truncateToTokens(headerText, maxTokens);
    }

    String body = selectRelevantBody(entity.body(), query, maxTokens - headerTokens);
    if (nullOrEmpty(body)) {
      return headerText.trim();
    }
    return (headerText + "Content:\n" + body).trim();
  }

  private String selectRelevantBody(String body, String query, int maxTokens) {
    if (nullOrEmpty(body) || maxTokens <= 0) {
      return "";
    }
    if (TokenCounter.countTokens(body) <= maxTokens) {
      return body;
    }
    List<String> queryTerms = extractQueryTerms(query);
    if (queryTerms.isEmpty()) {
      return truncateToTokens(body, maxTokens);
    }

    List<ChunkCandidate> chunks = buildChunks(body);
    if (chunks.isEmpty()) {
      return truncateToTokens(body, maxTokens);
    }

    List<ChunkCandidate> ranked =
        chunks.stream()
            .map(chunk -> chunk.withScore(scoreChunk(chunk.text(), query, queryTerms)))
            .filter(chunk -> chunk.score() > 0)
            .sorted(
                Comparator.comparingInt(ChunkCandidate::score)
                    .reversed()
                    .thenComparingInt(ChunkCandidate::index))
            .limit(MAX_RELEVANT_CHUNKS)
            .toList();

    if (ranked.isEmpty()) {
      return truncateToTokens(body, maxTokens);
    }

    List<ChunkCandidate> ordered =
        ranked.stream().sorted(Comparator.comparingInt(ChunkCandidate::index)).toList();
    StringBuilder builder = new StringBuilder();
    for (ChunkCandidate chunk : ordered) {
      if (builder.length() > 0) {
        builder.append("\n...\n");
      }
      builder.append(chunk.text());
      String assembled = truncateToTokens(builder.toString(), maxTokens);
      if (!assembled.isEmpty() && !assembled.endsWith("[truncated]")) {
        builder = new StringBuilder(assembled);
        continue;
      }
      return assembled;
    }
    return truncateToTokens(builder.toString(), maxTokens);
  }

  private List<String> extractQueryTerms(String query) {
    if (nullOrEmpty(query)) {
      return List.of();
    }
    LinkedHashSet<String> terms = new LinkedHashSet<>();
    for (String raw : NON_WORD.split(query.toLowerCase())) {
      if (raw.length() < 3 || STOP_WORDS.contains(raw)) {
        continue;
      }
      terms.add(raw);
    }
    return List.copyOf(terms);
  }

  private List<ChunkCandidate> buildChunks(String body) {
    String normalized = body.trim();
    if (normalized.isEmpty()) {
      return List.of();
    }

    List<ChunkCandidate> chunks = new ArrayList<>();
    int index = 0;
    int start = 0;
    int overlap = Math.min(CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS / 2);
    while (start < normalized.length()) {
      int end = Math.min(normalized.length(), start + CHUNK_TARGET_CHARS);
      if (end < normalized.length()) {
        int paragraphBreak = normalized.lastIndexOf("\n\n", end);
        if (paragraphBreak > start + (CHUNK_TARGET_CHARS / 2)) {
          end = paragraphBreak;
        } else {
          int lineBreak = normalized.lastIndexOf('\n', end);
          if (lineBreak > start + (CHUNK_TARGET_CHARS / 2)) {
            end = lineBreak;
          }
        }
      }

      String chunk = normalized.substring(start, end).trim();
      if (!chunk.isEmpty()) {
        chunks.add(new ChunkCandidate(index++, chunk, 0));
      }
      if (end >= normalized.length()) {
        break;
      }
      start = Math.max(end - overlap, start + 1);
    }
    return chunks;
  }

  private int scoreChunk(String chunk, String query, List<String> queryTerms) {
    String lowerChunk = chunk.toLowerCase();
    String lowerQuery = query == null ? "" : query.toLowerCase().trim();
    int score = 0;

    if (!lowerQuery.isEmpty() && lowerChunk.contains(lowerQuery)) {
      score += 20;
    }

    int matchedTerms = 0;
    for (String term : queryTerms) {
      int count = countOccurrences(lowerChunk, term);
      if (count > 0) {
        matchedTerms++;
        score += Math.min(count, 4) * 4;
      }
    }

    if (matchedTerms == queryTerms.size() && !queryTerms.isEmpty()) {
      score += 10;
    } else {
      score += matchedTerms * 2;
    }

    return score;
  }

  private int countOccurrences(String text, String term) {
    int count = 0;
    int start = 0;
    while (start >= 0) {
      start = text.indexOf(term, start);
      if (start < 0) {
        break;
      }
      count++;
      start += term.length();
    }
    return count;
  }

  static String truncateToTokens(String text, int maxTokens) {
    if (nullOrEmpty(text) || maxTokens <= 0) {
      return "";
    }
    if (TokenCounter.countTokens(text) <= maxTokens) {
      return text;
    }

    String suffix = "\n[truncated]";
    int low = 0;
    int high = text.length();
    String best = "";
    while (low <= high) {
      int mid = (low + high) >>> 1;
      String candidate = text.substring(0, mid).trim();
      if (candidate.isEmpty()) {
        low = mid + 1;
        continue;
      }

      String candidateWithSuffix = candidate + suffix;
      if (TokenCounter.countTokens(candidateWithSuffix) <= maxTokens) {
        best = candidateWithSuffix;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  private record ChunkCandidate(int index, String text, int score) {
    private ChunkCandidate withScore(int newScore) {
      return new ChunkCandidate(index, text, newScore);
    }
  }
}

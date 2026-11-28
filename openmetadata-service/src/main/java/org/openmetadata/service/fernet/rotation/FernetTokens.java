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

package org.openmetadata.service.fernet.rotation;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import com.macasaet.fernet.Token;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;

/**
 * The pure core of the rotation: what one stored value holds, and the same value with every token
 * an older key opens sealed again under the primary key. Substitution happens in the raw text, so
 * everything around the tokens stays byte for byte as the store returned it, and the plaintext of a
 * token never changes.
 */
@Slf4j
final class FernetTokens {
  /**
   * A token's alphabet needs no escaping in JSON, XML or Java's modified UTF-8, so a token reads
   * the same at any depth. The match may run past the token: in bytes the next byte can be a letter.
   * Pre-release {@code fernet:bound:} tokens are also matched so they are reported as {@link
   * Outcome#NO_KEY}.
   */
  static final Pattern TOKEN =
      Pattern.compile("fernet:(?:bound:)?(?:(?!fernet:)[A-Za-z0-9_-])+={0,2}");

  private static final String BOUND_PREFIX = Fernet.FERNET_PREFIX + "bound:";

  // A Fernet token is a version byte, an 8-byte timestamp, a 16-byte IV, 16n bytes of ciphertext
  // and a 32-byte HMAC, so its padded base64url length is one of a known series.
  private static final int FIXED_TOKEN_BYTES = 57;
  private static final int CIPHER_BLOCK_BYTES = 16;
  private static final String NESTED_TOKEN =
      "its secret holds a token that is not under the primary key";
  private static final String GUARD_FAILED =
      "the re-encrypted token did not open to the same secret";

  /** The answer for one value: the text to store, when a token must be replaced, and what was found. */
  record Rewrite(Optional<String> replacement, List<Finding> findings) {}

  /** One distinct token of a value. It never carries the token or its secret. */
  record Finding(Outcome outcome, String pointer, String detail) {}

  /** A regex match, which may run past the token it starts with. */
  private record Match(int start, String prefix, String body) {
    String text() {
      return prefix + body;
    }
  }

  /** What a match turned out to be. */
  private sealed interface Located {
    /** A token a configured key opened, so its span is known. */
    record Token(String text, boolean underPrimary, String plaintext) implements Located {}

    /** A well-formed token that no configured key opens. */
    record Unopened(String text) implements Located {}

    record NotAToken() implements Located {}
  }

  private record Classified(Outcome outcome, Optional<String> replacement, String detail) {
    static Classified of(Outcome outcome, String detail) {
      return new Classified(outcome, Optional.empty(), detail);
    }
  }

  private FernetTokens() {}

  static Rewrite rewrite(StoredText value, KeyRing keys) {
    List<Match> matches = matchesIn(value.text());
    if (matches.isEmpty()) {
      return new Rewrite(Optional.empty(), List.of());
    }
    LazyTree tree = new LazyTree(value.text());
    Map<String, Located> located = new HashMap<>();
    Map<String, Classified> tokens = new LinkedHashMap<>();
    for (Match match : matches) {
      Located found = located.computeIfAbsent(match.text(), text -> locate(match, keys));
      switch (found) {
        case Located.Token token -> tokens.computeIfAbsent(
            token.text(), text -> classify(token, value, keys));
        case Located.Unopened unopened -> tokens.computeIfAbsent(
            unopened.text(), text -> Classified.of(Outcome.NO_KEY, ""));
        case Located.NotAToken ignored -> LOG.trace("Text that starts like a token is not one");
      }
    }
    return new Rewrite(
        replacementOf(value.text(), matches, located, tokens), findingsOf(tokens, tree));
  }

  private static List<Match> matchesIn(String text) {
    List<Match> matches = new ArrayList<>();
    Matcher matcher = TOKEN.matcher(text);
    while (matcher.find()) {
      String match = matcher.group();
      String prefix = match.startsWith(BOUND_PREFIX) ? BOUND_PREFIX : Fernet.FERNET_PREFIX;
      matches.add(new Match(matcher.start(), prefix, match.substring(prefix.length())));
    }
    return matches;
  }

  /**
   * The match as found, then each shorter valid token length, longest first: the first a key opens
   * is the token. When none opens, the longest well-formed cut says whether this is a token at all.
   */
  private static Located locate(Match match, KeyRing keys) {
    Located located = new Located.NotAToken();
    for (String body : candidates(match.body())) {
      String text = match.prefix() + body;
      Optional<Located.Token> opened = asToken(text, keys.open(text));
      if (opened.isPresent()) {
        return opened.get();
      }
      if (located instanceof Located.NotAToken && isWellFormed(body)) {
        located = new Located.Unopened(text);
      }
    }
    return located;
  }

  private static List<String> candidates(String body) {
    List<String> candidates = new ArrayList<>();
    candidates.add(body);
    for (int blocks = largestBlockCountBelow(body.length()); blocks >= 1; blocks--) {
      candidates.add(body.substring(0, encodedLength(blocks)));
    }
    return candidates;
  }

  /** The padded base64url length of a token with {@code blocks} cipher blocks. */
  static int encodedLength(int blocks) {
    int bytes = FIXED_TOKEN_BYTES + CIPHER_BLOCK_BYTES * blocks;
    return 4 * ((bytes + 2) / 3);
  }

  private static int largestBlockCountBelow(int length) {
    int blocks = (int) ((length * 3L / 4 - FIXED_TOKEN_BYTES) / CIPHER_BLOCK_BYTES) + 1;
    while (blocks >= 1 && encodedLength(blocks) >= length) {
      blocks--;
    }
    return blocks;
  }

  private static Optional<Located.Token> asToken(String text, Opening opening) {
    return switch (opening) {
      case Opening.Primary primary -> Optional.of(
          new Located.Token(text, true, primary.plaintext()));
      case Opening.Older older -> Optional.of(new Located.Token(text, false, older.plaintext()));
      case Opening.NoKey ignored -> Optional.empty();
    };
  }

  private static boolean isWellFormed(String body) {
    try {
      Token.fromString(body);
      return true;
    } catch (RuntimeException e) {
      return false;
    }
  }

  private static Classified classify(Located.Token token, StoredText value, KeyRing keys) {
    Classified classified;
    if (holdsAnotherToken(token.plaintext(), keys)) {
      classified = Classified.of(Outcome.UNREWRITABLE, NESTED_TOKEN);
    } else if (token.underPrimary()) {
      classified = Classified.of(Outcome.PRIMARY, "");
    } else if (!value.isWritable()) {
      classified = Classified.of(Outcome.UNREWRITABLE, value.writability().reason);
    } else {
      classified = rekey(token, keys);
    }
    return classified;
  }

  /** The core never changes a plaintext, so a token nested in one is left to the operator. */
  private static boolean holdsAnotherToken(String plaintext, KeyRing keys) {
    return matchesIn(plaintext).stream()
        .map(match -> locate(match, keys))
        .anyMatch(FernetTokens::needsAnotherKey);
  }

  private static boolean needsAnotherKey(Located located) {
    return switch (located) {
      case Located.Token token -> !token.underPrimary();
      case Located.Unopened ignored -> true;
      case Located.NotAToken ignored -> false;
    };
  }

  /**
   * Seals the plaintext again under the primary key. The replacement is accepted only when it has
   * the token's length and opens under the primary key to the same plaintext.
   */
  private static Classified rekey(Located.Token token, KeyRing keys) {
    String replacement = keys.seal(token.plaintext());
    boolean sound =
        replacement.length() == token.text().length()
            && keys.open(replacement) instanceof Opening.Primary reopened
            && reopened.plaintext().equals(token.plaintext());
    return sound
        ? new Classified(Outcome.OLDER_KEY, Optional.of(replacement), "")
        : Classified.of(Outcome.UNREWRITABLE, GUARD_FAILED);
  }

  /** The text with every replaceable token replaced, when nothing in it stops the write. */
  private static Optional<String> replacementOf(
      String text,
      List<Match> matches,
      Map<String, Located> located,
      Map<String, Classified> tokens) {
    boolean blocked = tokens.values().stream().anyMatch(it -> it.outcome() == Outcome.UNREWRITABLE);
    boolean needed = tokens.values().stream().anyMatch(it -> it.replacement().isPresent());
    return blocked || !needed
        ? Optional.empty()
        : Optional.of(substitute(text, matches, located, tokens));
  }

  private static String substitute(
      String text,
      List<Match> matches,
      Map<String, Located> located,
      Map<String, Classified> tokens) {
    StringBuilder out = new StringBuilder(text.length());
    int from = 0;
    for (Match match : matches) {
      if (located.get(match.text()) instanceof Located.Token token
          && tokens.get(token.text()).replacement().isPresent()) {
        out.append(text, from, match.start()).append(tokens.get(token.text()).replacement().get());
        from = match.start() + token.text().length();
      }
    }
    return out.append(text, from, text.length()).toString();
  }

  private static List<Finding> findingsOf(Map<String, Classified> tokens, LazyTree tree) {
    List<Finding> findings = new ArrayList<>();
    tokens.forEach(
        (token, classified) ->
            findings.add(
                new Finding(
                    classified.outcome(),
                    classified.outcome() == Outcome.PRIMARY ? "" : tree.pointerOf(token),
                    classified.detail())));
    return List.copyOf(findings);
  }

  /** The value parsed as JSON, once, and only when a pointer needs it. */
  private static final class LazyTree {
    private final String text;
    private boolean parsed;
    private Optional<JsonNode> root = Optional.empty();

    LazyTree(String text) {
      this.text = text;
    }

    Optional<JsonNode> get() {
      if (!parsed) {
        parsed = true;
        root = parse(text);
      }
      return root;
    }

    /** The JSON pointer of the first string that holds {@code token}, or empty text otherwise. */
    String pointerOf(String token) {
      return get().flatMap(node -> pointerOf(node, JsonPointer.empty(), token)).orElse("");
    }

    private static Optional<JsonNode> parse(String text) {
      try {
        return Optional.of(JsonUtils.readTree(text)).filter(JsonNode::isContainerNode);
      } catch (JsonParsingException e) {
        return Optional.empty();
      }
    }

    private static Optional<String> pointerOf(JsonNode node, JsonPointer at, String token) {
      Optional<String> pointer = Optional.empty();
      if (node.isTextual()) {
        pointer = node.textValue().contains(token) ? Optional.of(at.toString()) : Optional.empty();
      } else if (node.isObject()) {
        pointer =
            node.properties().stream()
                .map(field -> pointerOf(field.getValue(), at.appendProperty(field.getKey()), token))
                .flatMap(Optional::stream)
                .findFirst();
      } else if (node.isArray()) {
        pointer =
            IntStream.range(0, node.size())
                .mapToObj(i -> pointerOf(node.get(i), at.appendIndex(i), token))
                .flatMap(Optional::stream)
                .findFirst();
      }
      return pointer;
    }
  }
}

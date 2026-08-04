package org.openmetadata.it.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The diff drives {@code LiveVsReindexParityIT}, which needs a real cluster; this pins its
 * semantics without one. A false negative here would let live-vs-reindex drift through silently,
 * which is the whole thing that test exists to catch.
 */
class DocumentParityTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  @DisplayName("identical documents produce no differences")
  void identicalDocumentsMatch() {
    final JsonNode doc = json("{\"name\":\"t\",\"tags\":[{\"tagFQN\":\"A\"}]}");

    assertThat(DocumentParity.diff(doc, doc.deepCopy())).isEmpty();
  }

  @Test
  @DisplayName("a changed scalar is reported with its dotted path")
  void changedScalarIsReported() {
    final List<DocumentParity.Difference> differences =
        DocumentParity.diff(json("{\"description\":\"a\"}"), json("{\"description\":\"b\"}"));

    assertThat(differences).hasSize(1);
    assertThat(differences.getFirst().path()).isEqualTo("description");
  }

  @Test
  @DisplayName("nested paths are reported fully qualified")
  void nestedPathIsQualified() {
    final List<DocumentParity.Difference> differences =
        DocumentParity.diff(
            json("{\"tier\":{\"tagFQN\":\"Tier.Tier1\"}}"),
            json("{\"tier\":{\"tagFQN\":\"Tier.Tier2\"}}"));

    assertThat(differences).hasSize(1);
    assertThat(differences.getFirst().path()).isEqualTo("tier.tagFQN");
  }

  /** The live path drops a field the reindex path writes — the shape of divergences #4 and #6. */
  @Test
  @DisplayName("a field present on only one side is reported")
  void fieldMissingOnOneSideIsReported() {
    final List<DocumentParity.Difference> differences =
        DocumentParity.diff(json("{}"), json("{\"tier\":{\"tagFQN\":\"Tier.Tier1\"}}"));

    assertThat(differences).hasSize(1);
    assertThat(differences.getFirst().live()).isEqualTo("<absent>");
  }

  @Test
  @DisplayName("array order does not count as a difference")
  void arrayOrderIsIgnored() {
    final JsonNode live = json("{\"tags\":[{\"tagFQN\":\"A\"},{\"tagFQN\":\"B\"}]}");
    final JsonNode rebuilt = json("{\"tags\":[{\"tagFQN\":\"B\"},{\"tagFQN\":\"A\"}]}");

    assertThat(DocumentParity.diff(live, rebuilt)).isEmpty();
  }

  @Test
  @DisplayName("an element dropped from an array is reported")
  void droppedArrayElementIsReported() {
    final JsonNode live = json("{\"tags\":[{\"tagFQN\":\"A\"},{\"tagFQN\":\"B\"}]}");
    final JsonNode rebuilt = json("{\"tags\":[{\"tagFQN\":\"A\"}]}");

    assertThat(DocumentParity.diff(live, rebuilt)).hasSize(1);
  }

  /**
   * The two write paths build their maps in different key orders; comparing raw serialisations
   * reported every such element as changed and buried the real differences.
   */
  @Test
  @DisplayName("array elements differing only in key order are equal")
  void arrayElementKeyOrderIsIgnored() {
    final JsonNode live = json("{\"cols\":[{\"dataTypeEnum\":\"STRING\",\"name\":\"id\"}]}");
    final JsonNode rebuilt = json("{\"cols\":[{\"name\":\"id\",\"dataTypeEnum\":\"STRING\"}]}");

    assertThat(DocumentParity.diff(live, rebuilt)).isEmpty();
  }

  @Test
  @DisplayName("key order is ignored but a changed value inside the element is still caught")
  void reorderedElementWithChangedValueIsReported() {
    final JsonNode live = json("{\"cols\":[{\"dataTypeEnum\":\"STRING\",\"name\":\"id\"}]}");
    final JsonNode rebuilt = json("{\"cols\":[{\"name\":\"id\",\"dataTypeEnum\":\"INT\"}]}");

    assertThat(DocumentParity.diff(live, rebuilt)).hasSize(1);
  }

  @Test
  @DisplayName("absent and explicit null are treated as the same")
  void absentAndNullAreEquivalent() {
    assertThat(DocumentParity.diff(json("{}"), json("{\"owners\":null}"))).isEmpty();
  }

  /** The two paths disagree about materialising empty collections, in both directions. */
  @Test
  @DisplayName("an empty collection equals an absent field")
  void emptyCollectionEqualsAbsent() {
    assertThat(DocumentParity.diff(json("{\"personas\":[]}"), json("{}"))).isEmpty();
    assertThat(DocumentParity.diff(json("{}"), json("{\"tags\":[]}"))).isEmpty();
    assertThat(DocumentParity.diff(json("{\"extension\":{}}"), json("{}"))).isEmpty();
  }

  /** The absent/empty rule must hold inside array elements too, not just at the object walk. */
  @Test
  @DisplayName("an empty field nested inside an array element is ignored")
  void emptyFieldInsideArrayElementIsIgnored() {
    final JsonNode live = json("{\"fields\":[{\"name\":\"a\"}]}");
    final JsonNode rebuilt = json("{\"fields\":[{\"name\":\"a\",\"tags\":[]}]}");

    assertThat(DocumentParity.diff(live, rebuilt)).isEmpty();
  }

  @Test
  @DisplayName("a populated field nested inside an array element is still reported")
  void populatedFieldInsideArrayElementIsReported() {
    final JsonNode live = json("{\"fields\":[{\"name\":\"a\"}]}");
    final JsonNode rebuilt = json("{\"fields\":[{\"name\":\"a\",\"tags\":[{\"tagFQN\":\"A\"}]}]}");

    assertThat(DocumentParity.diff(live, rebuilt)).hasSize(1);
  }

  @Test
  @DisplayName("empty on one side and populated on the other is still reported")
  void emptyVersusPopulatedIsReported() {
    assertThat(DocumentParity.diff(json("{\"tags\":[]}"), json("{\"tags\":[{\"tagFQN\":\"A\"}]}")))
        .hasSize(1);
    assertThat(DocumentParity.diff(json("{}"), json("{\"tags\":[{\"tagFQN\":\"A\"}]}"))).hasSize(1);
  }

  @Test
  @DisplayName("ignored paths are filtered out")
  void ignoredPathsAreFiltered() {
    final List<DocumentParity.Difference> differences =
        DocumentParity.diffIgnoring(
            json("{\"description\":\"a\",\"name\":\"x\"}"),
            json("{\"description\":\"b\",\"name\":\"x\"}"),
            Set.of("description"));

    assertThat(differences).isEmpty();
  }

  private static JsonNode json(final String raw) {
    try {
      return MAPPER.readTree(raw);
    } catch (final Exception e) {
      throw new IllegalArgumentException("bad fixture json: " + raw, e);
    }
  }
}

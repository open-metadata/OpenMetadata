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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.BitSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class PromptTextTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        "<img src=\"data:image/png;base64,AAAA\" width=\"240\">",
        "&lt;img src=&quot;data:image/png;base64,AAAA&quot; alt=&quot;2 &gt; 1&quot;&gt;",
        "![Chart](https://example.com/chart.png)",
        "<div data-type=\"file-attachment\" data-is-image=\"true\" data-file-name=\"chart.png\">"
      })
  void inlineImagePositionsTracksSourceOffsetsAfterTheTitle(String image) {
    String title = "title: ![example](https://example.com/example.png); description: ";
    String before = "before &amp; ";
    String source = title + before + image + " after";
    int imageStart = title.length() + before.length();
    BitSet expected = new BitSet();
    expected.set(imageStart, imageStart + image.length());

    assertEquals(expected, PromptText.inlineImagePositions(source, title.length()));
  }

  @Test
  void articleReadsPreserveLiteralHtmlCodeAndDiscardEmptyLayout() {
    assertEquals(
        "<p><code><div></code></p>", PromptText.forArticleRead("<p><code>&lt;div&gt;</code></p>"));
    assertEquals(
        "",
        PromptText.forArticleRead("<p><img src=\"data:image/png;base64,AAAA\"></p><p>&nbsp;</p>"));
    assertEquals("", PromptText.forArticleRead("![Chart](https://example.com/chart.png)"));
    assertEquals(
        "[Chart](https://example.com/chart.png)",
        PromptText.forArticleRead("[Chart](https://example.com/chart.png)"));
  }

  @Test
  void contentReadRemovesEncodedImagesAndReadsTextAsWritten() {
    assertEquals(
        "Before  after",
        PromptText.forContentRead(
            "Before &lt;img src=&quot;data:image/png;base64,AAAA&quot;&gt; after"));
    String stored =
        "<p>x &lt;&#61; 1 &amp; y &gt;&#61; 2 &#43; tax, &quot;orders&quot; by owner&#64;corp.com,"
            + " &#39;a&#39; &#61; &#96;b&#96;</p>";
    assertEquals(
        "<p>x <= 1 & y >= 2 + tax, \"orders\" by owner@corp.com, 'a' = `b`</p>",
        PromptText.forContentRead(stored));
    assertEquals(
        "<p>Write &lt;script&gt; as text.</p>",
        PromptText.forContentRead(
            "<p>Write &amp;lt;script&amp;gt; as text.</p>"
                + "&lt;img src=&quot;data:image/png;base64,AAAA&quot;&gt;"));
    assertEquals(
        "Before  after",
        PromptText.forContentRead(
            "Before &lt;img alt=&quot;x &gt; y&quot; src=&quot;data:image/png;base64,AAAA&quot;&gt;"
                + " after"));
    assertEquals(
        "Diagram  end.",
        PromptText.forContentRead("Diagram ![architecture](data:image/png;base64,AAAA) end."));
    assertEquals(
        "Diagram  end.",
        PromptText.forContentRead("Diagram ![Wow! diagram](data:image/png;base64,AAAA) end."));
  }

  @Test
  void contentReadStaysLinearOnManyUnclosedImages() {
    // Timed against plain text of the same length, so a slow runner slows both sides alike: the
    // linear scan measures 1.2-1.5x plain text, a backtracking pattern 400-800x.
    String run = "A".repeat(200);
    Stream<String> unclosed =
        Stream.of(
            ("&lt;img &quot;" + run).repeat(5_000),
            (" ![x](data:" + run).repeat(5_000),
            ("![" + run).repeat(10_000));
    assertTimeoutPreemptively(
        Duration.ofSeconds(60), () -> unclosed.forEach(PromptTextTest::assertReadsInLinearTime));
  }

  private static void assertReadsInLinearTime(String unclosed) {
    long plainNanos = fastestContentRead("A".repeat(unclosed.length()));
    long unclosedNanos = fastestContentRead(unclosed);
    assertTrue(
        unclosedNanos < 20 * plainNanos + Duration.ofMillis(50).toNanos(),
        unclosedNanos / 1_000_000 + " ms against " + plainNanos / 1_000_000 + " ms for plain text");
  }

  private static long fastestContentRead(String text) {
    long fastest = Long.MAX_VALUE;
    for (int attempt = 0; attempt < 3; attempt++) {
      long start = System.nanoTime();
      assertNotNull(PromptText.forContentRead(text));
      fastest = Math.min(fastest, System.nanoTime() - start);
    }
    return fastest;
  }

  @Test
  void inlineBase64ImagesAreRemoved() {
    String diagram = "iVBORw0KGgoAAAANSUhEUg" + "A".repeat(20_000) + "ErkJggg==";
    String description =
        "<p>The semantic layer unifies definitions.</p>"
            + "<p><img src=\"data:image/png;base64,"
            + diagram
            + "\"></p>"
            + "<p>Diagram above.</p>";

    String prompt = PromptText.forPrompt(description);

    assertFalse(prompt.contains("base64"));
    assertFalse(prompt.contains(diagram));
    assertTrue(prompt.contains("The semantic layer unifies definitions."));
    assertTrue(prompt.contains("Diagram above."));
    assertTrue(
        prompt.length() < 200,
        "the 20k-character payload must not survive in any form, got " + prompt.length());
  }

  @Test
  void imagesWithAResolvableUrlAreAlsoRemovedBecauseAModelCannotSeeThem() {
    String prompt =
        PromptText.forPrompt(
            "<p>Before</p><img src=\"https://cdn.example.com/architecture.png\" alt=\"Arch\">"
                + "<img src=\"blob:https://wiki.example.com/2baeefed-59dd-4aaf-8ca2\">"
                + "<p>After</p>");

    assertFalse(prompt.contains("<img"));
    assertFalse(prompt.contains("blob:"));
    assertFalse(prompt.contains("architecture.png"));
    assertTrue(prompt.contains("Before"));
    assertTrue(prompt.contains("After"));
  }

  @Test
  void dataUrisAreRemovedFromEveryAttributeNotJustImages() {
    String prompt =
        PromptText.forPrompt("<p><a href=\"data:text/html;base64,PHNjcmlwdD4=\">payload</a></p>");

    assertFalse(prompt.contains("data:"));
    assertFalse(prompt.contains("PHNjcmlwdD4="));
    assertTrue(prompt.contains("payload"));
  }

  @Test
  void presentationalAttributesAreDroppedAndTheirTextKept() {
    String prompt =
        PromptText.forPrompt(
            "<ul class=\"om-list-disc\"><li class=\"om-leading-normal\" style=\"color:red\">"
                + "<p id=\"x\">CI — Customer Invoice</p></li></ul>");

    assertFalse(prompt.contains("class="));
    assertFalse(prompt.contains("style="));
    assertFalse(prompt.contains("id="));
    assertTrue(prompt.contains("CI — Customer Invoice"));
    assertTrue(prompt.contains("<li>"));
  }

  @Test
  void structureAModelReadsIsPreserved() {
    String prompt =
        PromptText.forPrompt(
            "<h2><strong>Overview</strong></h2>"
                + "<table><tr><th>Column</th><th>Meaning</th></tr>"
                + "<tr><td colspan=\"2\">JOB_NO — the work order key</td></tr></table>"
                + "<p>See <a href=\"https://docs.example.com/sclc\">the SCLC page</a>.</p>"
                + "<pre><code>SELECT 1</code></pre>");

    assertTrue(prompt.contains("<h2>"));
    assertTrue(prompt.contains("<strong>"));
    assertTrue(prompt.contains("<table>"));
    assertTrue(prompt.contains("<th>"));
    assertTrue(prompt.contains("colspan=\"2\""));
    assertTrue(prompt.contains("https://docs.example.com/sclc"));
    assertTrue(prompt.contains("<code>"));
    assertTrue(prompt.contains("SELECT 1"));
  }

  @Test
  void entityMentionsKeepTheIdentifiersAnAgentCanLookUp() {
    String prompt =
        PromptText.forPrompt(
            "<p>Owned by <a data-type=\"mention\" data-entitytype=\"table\" "
                + "data-fqn=\"snow.dmg.public.work_order\" class=\"om-mention\">Work Order</a></p>");

    assertTrue(prompt.contains("data-fqn=\"snow.dmg.public.work_order\""));
    assertTrue(prompt.contains("data-entitytype=\"table\""));
    assertFalse(prompt.contains("class="));
    assertFalse(prompt.contains("data-type="));
  }

  @Test
  void entityLinkTokensSurvive() {
    String prompt =
        PromptText.forPrompt("<p>See <#E::table::snow.dmg.public.work_order> for details.</p>");

    assertTrue(prompt.contains("<#E::table::snow.dmg.public.work_order>"));
  }

  @Test
  void plainTextIsReturnedUntouchedSoComparisonsAreNotEscaped() {
    String sqlNote = "Rows where a < b and cost & margin are both set.";

    assertEquals(sqlNote, PromptText.forPrompt(sqlNote));
  }

  @Test
  void typeNotationIsNotMistakenForMarkup() {
    // Angle brackets are also type notation, and column descriptions are full of it. Read as HTML,
    // "Map<String, Object>" loses its parameters and the nested case collapses to "Array&gt;".
    for (String typeNote :
        new String[] {
          "Map<String, Object> payload column",
          "Array<Item> of line items",
          "List<T> generic container",
          "Array<Struct<id:int,name:string>> nested rows",
          "Set<Long> of surrogate keys"
        }) {
      assertEquals(typeNote, PromptText.forPrompt(typeNote));
    }
  }

  @Test
  void markupIsStillRecognisedAroundTypeNotation() {
    // The narrower guard must not become a way to smuggle an image past the strip.
    String prompt =
        PromptText.forPrompt(
            "<p>Column is Map<String, Object></p><img src=\"data:image/png;base64,AAAA\">");

    assertFalse(prompt.contains("base64"));
    assertTrue(prompt.contains("Column is Map"));
  }

  @ParameterizedTest(name = "{index}")
  @MethodSource("incompleteMarkup")
  void incompleteMarkupIsPreserved(String description) {
    assertEquals(description, PromptText.forPrompt(description));
  }

  private static Stream<String> incompleteMarkup() {
    return Stream.of("<", "< >", "text <a", "a > b <a");
  }

  @Test
  void angleBracketsInAttributesDoNotHideMarkup() {
    String prompt = PromptText.forPrompt("<img alt=\"x < y\" src=\"data:image/png;base64,AAAA\">");

    assertEquals("", prompt);
  }

  @Test
  void nullAndBlankPassThrough() {
    assertNull(PromptText.forPrompt(null));
    assertEquals("", PromptText.forPrompt(""));
    assertEquals("   ", PromptText.forPrompt("   "));
  }
}

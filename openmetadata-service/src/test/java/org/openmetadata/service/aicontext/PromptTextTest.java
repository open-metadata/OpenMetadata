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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PromptTextTest {

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

  @Test
  void nullAndBlankPassThrough() {
    assertNull(PromptText.forPrompt(null));
    assertEquals("", PromptText.forPrompt(""));
    assertEquals("   ", PromptText.forPrompt("   "));
  }
}

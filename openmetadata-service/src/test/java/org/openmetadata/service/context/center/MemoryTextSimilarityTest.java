package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class MemoryTextSimilarityTest {

  @Test
  void aReplacedNumberIsAConflict() {
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("15%", "20%"));
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("15% (2025)", "20% (2025)"));
  }

  @Test
  void oppositeSignsAreConflictingValues() {
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("-15%", "15%"));
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("−15%", "+15%"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("−15%", "-15%"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("+15%", "15%"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("10-20 days", "10–20 days"));
  }

  @Test
  void anAddedOrDroppedNumberIsARewording() {
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("15%", "15% (section 3)"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("As of 2025, 30 days", "30 days"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("30 days", "about a month"));
  }

  /** The model writes one amount differently between runs; that is not a second value. */
  @Test
  void aReformattedNumberIsTheSameNumber() {
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("$1,500 per trip", "$1500 per trip"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("within 08 hours", "within 8 hours"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("sections 1,2", "sections 1, 2"));
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("$1,500 per trip", "$2,000 per trip"));
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("Python 3.10", "Python 3.1"));
    assertFalse(
        MemoryTextSimilarity.hasConflictingNumbers("$1,500.00 per trip", "$1,500 per trip"));
  }

  /** Inserting a section above a value renumbers its citation; the value is unchanged. */
  @Test
  void aCitationIsNotAValue() {
    assertFalse(
        MemoryTextSimilarity.hasConflictingNumbers(
            "15% (Sales handbook, section 3)", "15% (Sales handbook, section 4)"));
    assertFalse(
        MemoryTextSimilarity.hasConflictingNumbers("30 days (pages 3-5)", "30 days (p. 6)"));
    assertFalse(
        MemoryTextSimilarity.hasConflictingNumbers(
            "$75 per day (Table 3)", "$75 per day (Table 4)"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("30 days (sec. 3)", "30 days (sec. 4)"));
    assertFalse(
        MemoryTextSimilarity.hasConflictingNumbers("30 days (pp. 3 - 5)", "30 days (pp. 6 - 8)"));
    assertFalse(
        MemoryTextSimilarity.hasConflictingNumbers(
            "30 days (sections 3 & 4)", "30 days (sections 5 & 6)"));
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("15% (section 3)", "25% (section 3)"));
    assertTrue(
        MemoryTextSimilarity.hasConflictingNumbers(
            "Per section 3, 25% commission", "Per section 3, 15% commission"));
    // Outside parentheses the number after a citation word may be the value itself.
    assertTrue(
        MemoryTextSimilarity.hasConflictingNumbers("Section 3 – 25 days", "Section 3 – 30 days"));
    assertTrue(
        MemoryTextSimilarity.hasConflictingNumbers("Results per page 50", "Results per page 100"));
  }

  /** What two questions ask about decides, not the frame they share ("What is the … rate?"). */
  @Test
  void questionsAboutTheSameTopicAreAlike() {
    assertTrue(
        MemoryTextSimilarity.questionSimilarity(
                "What is the refund window?", "What is the window for refunds?")
            >= MemoryTextSimilarity.IDENTITY_THRESHOLD);
    assertTrue(
        MemoryTextSimilarity.questionSimilarity(
                "What is the VAT rate?", "What is the discount rate?")
            < MemoryTextSimilarity.IDENTITY_THRESHOLD);
  }

  /** Two questions naming no topic word the test reads ask about nothing it can compare. */
  @Test
  void aQuestionWithNoReadableTopicIsAlikeToNone() {
    assertEquals(0.0, MemoryTextSimilarity.questionSimilarity("What is Q3?", "What is it?"));
    assertEquals(
        0.0, MemoryTextSimilarity.questionSimilarity("Какая ставка НДС?", "Какая ставка скидки?"));
  }

  @Test
  void aQuestionInOtherWordsOfTheSameVocabularyIsTheSameQuestion() {
    assertTrue(
        MemoryTextSimilarity.sameQuestion(
            "What is the refund window?", "What's the refund window?"));
    assertFalse(
        MemoryTextSimilarity.sameQuestion(
            "How many vacation days do employees get per year?",
            "How many vacation days do contractors get per year?"));
    assertFalse(
        MemoryTextSimilarity.sameQuestion(
            "How many vacation days do employees in the UK get?",
            "How many vacation days do employees in the US get?"));
    assertFalse(MemoryTextSimilarity.sameQuestion("What was Q3 revenue?", "What was Q4 revenue?"));
    assertFalse(
        MemoryTextSimilarity.sameQuestion(
            "What is the exchange rate from USD to EUR?",
            "What is the exchange rate from EUR to USD?"));
  }
}

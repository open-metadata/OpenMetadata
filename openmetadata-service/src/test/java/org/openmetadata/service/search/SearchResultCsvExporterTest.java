/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SearchResultCsvExporterTest {

  // ===================================================================
  // toCsvRow TESTS
  // ===================================================================

  @Test
  void testToCsvRowAllFieldsPresent() {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "table");
    source.put("name", "orders");
    source.put("displayName", "Orders Table");
    source.put("fullyQualifiedName", "prod.db.schema.orders");
    source.put("description", "Main orders table");
    source.put("service", Map.of("name", "prod-mysql"));
    source.put("serviceType", "Mysql");
    source.put(
        "owners", List.of(Map.of("displayName", "Alice", "name", "alice"), Map.of("name", "bob")));
    source.put(
        "tags",
        List.of(
            Map.of("tagFQN", "PII.Sensitive", "source", "Classification"),
            Map.of("tagFQN", "glossary.term1", "source", "Glossary")));
    source.put("tier", Map.of("tagFQN", "Tier.Tier1"));
    source.put("domains", List.of(Map.of("displayName", "Finance", "name", "finance")));

    String row = SearchResultCsvExporter.toCsvRow(source);

    assertEquals(
        "table,prod-mysql,Mysql,prod.db.schema.orders,orders,Orders Table,Main orders table,Alice|bob,PII.Sensitive,glossary.term1,Finance,Tier.Tier1",
        row);
  }

  @Test
  void testToCsvRowMissingFields() {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "topic");
    source.put("name", "my-topic");
    source.put("fullyQualifiedName", "kafka.my-topic");

    String row = SearchResultCsvExporter.toCsvRow(source);

    assertEquals("topic,,,kafka.my-topic,my-topic,,,,,,,", row);
  }

  @Test
  void testToCsvRowEmptySource() {
    Map<String, Object> source = new HashMap<>();

    String row = SearchResultCsvExporter.toCsvRow(source);

    assertEquals(",,,,,,,,,,,", row);
  }

  @Test
  void testToCsvRowColumnCount() {
    Map<String, Object> source = new HashMap<>();
    String row = SearchResultCsvExporter.toCsvRow(source);
    String[] columns = row.split(",", -1);
    assertEquals(12, columns.length, "CSV row should always have 12 columns");
  }

  @Test
  void testToCsvRowHeaderColumnCountMatchesDataColumns() {
    String[] headerColumns = SearchResultCsvExporter.CSV_HEADER.split(",");
    Map<String, Object> source = new HashMap<>();
    String row = SearchResultCsvExporter.toCsvRow(source);
    String[] dataColumns = row.split(",", -1);
    assertEquals(headerColumns.length, dataColumns.length);
  }

  @Test
  void testToCsvRowWithNonStringFieldValues() {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", 42);
    source.put("name", true);
    source.put("serviceType", 3.14);

    String row = SearchResultCsvExporter.toCsvRow(source);

    assertTrue(row.startsWith("42,"), "entityType 42 should be converted to string");
    assertTrue(row.contains(",3.14,"), "serviceType 3.14 should be converted to string");
    assertTrue(row.contains(",true,"), "name true should be converted to string");
  }

  @Test
  void testCsvRowWithSpecialCharactersInDescription() {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "table");
    source.put("name", "users");
    source.put("fullyQualifiedName", "db.users");
    source.put("description", "Table with \"users\" data, including names\nand emails");

    String row = SearchResultCsvExporter.toCsvRow(source);

    assertTrue(row.contains("\"Table with \"\"users\"\" data, including names\nand emails\""));
  }

  @Test
  void testToCsvRowWithNullValueInMap() {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "table");
    source.put("name", null);
    source.put("description", null);

    String row = SearchResultCsvExporter.toCsvRow(source);

    assertTrue(row.startsWith("table,,,"));
  }

  // ===================================================================
  // escapeCsv TESTS
  // ===================================================================

  @Test
  void testEscapeCsvWithComma() {
    assertEquals("\"hello, world\"", SearchResultCsvExporter.escapeCsv("hello, world"));
  }

  @Test
  void testEscapeCsvWithQuotes() {
    assertEquals("\"say \"\"hello\"\"\"", SearchResultCsvExporter.escapeCsv("say \"hello\""));
  }

  @Test
  void testEscapeCsvWithNewline() {
    assertEquals("\"line1\nline2\"", SearchResultCsvExporter.escapeCsv("line1\nline2"));
  }

  @Test
  void testEscapeCsvWithCarriageReturn() {
    assertEquals("\"line1\rline2\"", SearchResultCsvExporter.escapeCsv("line1\rline2"));
  }

  @Test
  void testEscapeCsvWithCrLf() {
    assertEquals("\"line1\r\nline2\"", SearchResultCsvExporter.escapeCsv("line1\r\nline2"));
  }

  @Test
  void testEscapeCsvWithMultipleSpecialChars() {
    String input = "hello, \"world\"\nnew line";
    String escaped = SearchResultCsvExporter.escapeCsv(input);
    assertEquals("\"hello, \"\"world\"\"\nnew line\"", escaped);
  }

  @Test
  void testEscapeCsvNull() {
    assertEquals("", SearchResultCsvExporter.escapeCsv(null));
  }

  @Test
  void testEscapeCsvEmpty() {
    assertEquals("", SearchResultCsvExporter.escapeCsv(""));
  }

  @Test
  void testEscapeCsvPlainValue() {
    assertEquals("hello", SearchResultCsvExporter.escapeCsv("hello"));
  }

  @Test
  void testEscapeCsvWhitespaceOnly() {
    assertEquals("   ", SearchResultCsvExporter.escapeCsv("   "));
  }

  @Test
  void testEscapeCsvFormulaInjectionEquals() {
    assertEquals("'=SUM(A1:A10)", SearchResultCsvExporter.escapeCsv("=SUM(A1:A10)"));
  }

  @Test
  void testEscapeCsvFormulaInjectionPlus() {
    assertEquals("'+cmd|' /C calc'!A0", SearchResultCsvExporter.escapeCsv("+cmd|' /C calc'!A0"));
  }

  @Test
  void testEscapeCsvFormulaInjectionMinus() {
    assertEquals("'-1+1", SearchResultCsvExporter.escapeCsv("-1+1"));
  }

  @Test
  void testEscapeCsvFormulaInjectionAt() {
    assertEquals("'@SUM(A1)", SearchResultCsvExporter.escapeCsv("@SUM(A1)"));
  }

  @Test
  void testEscapeCsvFormulaInjectionWithComma() {
    assertEquals("\"'=cmd,dangerous\"", SearchResultCsvExporter.escapeCsv("=cmd,dangerous"));
  }

  @Test
  void testEscapeCsvFormulaInjectionWithNewline() {
    assertEquals("\"'=cmd\ninjection\"", SearchResultCsvExporter.escapeCsv("=cmd\ninjection"));
  }

  @Test
  void testEscapeCsvNonFormulaWithMinus() {
    assertEquals(
        "'- description starts with dash",
        SearchResultCsvExporter.escapeCsv("- description starts with dash"));
  }

  @Test
  void testEscapeCsvFormulaInjectionWithLeadingWhitespace() {
    assertEquals("' =SUM(A1:A10)", SearchResultCsvExporter.escapeCsv(" =SUM(A1:A10)"));
  }

  @Test
  void testEscapeCsvFormulaInjectionWithLeadingTab() {
    assertEquals("'\t+cmd", SearchResultCsvExporter.escapeCsv("\t+cmd"));
  }

  // ===================================================================
  // extractOwners TESTS
  // ===================================================================

  @Test
  void testExtractMultipleOwners() {
    Map<String, Object> source = new HashMap<>();
    source.put(
        "owners",
        List.of(
            Map.of("displayName", "Alice"),
            Map.of("displayName", "Bob"),
            Map.of("name", "charlie")));

    String owners = SearchResultCsvExporter.extractOwners(source);

    assertEquals("Alice|Bob|charlie", owners);
  }

  @Test
  void testExtractOwnersWithDisplayNamePreference() {
    Map<String, Object> source = new HashMap<>();
    source.put("owners", List.of(Map.of("displayName", "Alice Smith", "name", "alice.smith")));

    String owners = SearchResultCsvExporter.extractOwners(source);

    assertEquals("Alice Smith", owners);
  }

  @Test
  void testExtractOwnersEmpty() {
    Map<String, Object> source = new HashMap<>();

    assertEquals("", SearchResultCsvExporter.extractOwners(source));
  }

  @Test
  void testExtractOwnersEmptyList() {
    Map<String, Object> source = new HashMap<>();
    source.put("owners", List.of());

    assertEquals("", SearchResultCsvExporter.extractOwners(source));
  }

  @Test
  void testExtractOwnersWithNullField() {
    Map<String, Object> source = new HashMap<>();
    source.put("owners", null);

    assertEquals("", SearchResultCsvExporter.extractOwners(source));
  }

  @Test
  void testExtractOwnersWithNonListValue() {
    Map<String, Object> source = new HashMap<>();
    source.put("owners", "not-a-list");

    assertEquals("", SearchResultCsvExporter.extractOwners(source));
  }

  @Test
  void testExtractOwnersWithNonMapEntriesInList() {
    Map<String, Object> source = new HashMap<>();
    List<Object> mixed = new ArrayList<>();
    mixed.add(Map.of("displayName", "Alice"));
    mixed.add("string-entry");
    mixed.add(42);
    source.put("owners", mixed);

    assertEquals("Alice", SearchResultCsvExporter.extractOwners(source));
  }

  @Test
  void testExtractOwnersWithEmptyDisplayNameFallsBackToName() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> owner = new HashMap<>();
    owner.put("displayName", "");
    owner.put("name", "fallback-name");
    source.put("owners", List.of(owner));

    assertEquals("fallback-name", SearchResultCsvExporter.extractOwners(source));
  }

  @Test
  void testExtractOwnersWithNullDisplayNameFallsBackToName() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> owner = new HashMap<>();
    owner.put("displayName", null);
    owner.put("name", "fallback-name");
    source.put("owners", List.of(owner));

    assertEquals("fallback-name", SearchResultCsvExporter.extractOwners(source));
  }

  @Test
  void testExtractOwnersWithNullNameReturnsEmpty() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> owner = new HashMap<>();
    owner.put("name", null);
    source.put("owners", List.of(owner));

    assertEquals("", SearchResultCsvExporter.extractOwners(source));
  }

  // ===================================================================
  // extractTags / extractGlossaryTerms TESTS
  // ===================================================================

  @Test
  void testExtractTagsVsGlossaryTerms() {
    Map<String, Object> source = new HashMap<>();
    source.put(
        "tags",
        List.of(
            Map.of("tagFQN", "PII.Sensitive", "source", "Classification"),
            Map.of("tagFQN", "PII.NonSensitive", "source", "Classification"),
            Map.of("tagFQN", "glossary.BankingTerms.Revenue", "source", "Glossary")));

    assertEquals("PII.Sensitive|PII.NonSensitive", SearchResultCsvExporter.extractTags(source));
    assertEquals(
        "glossary.BankingTerms.Revenue", SearchResultCsvExporter.extractGlossaryTerms(source));
  }

  @Test
  void testExtractTagsEmptyWhenNoTags() {
    Map<String, Object> source = new HashMap<>();

    assertEquals("", SearchResultCsvExporter.extractTags(source));
    assertEquals("", SearchResultCsvExporter.extractGlossaryTerms(source));
  }

  @Test
  void testExtractTagsWithEmptyList() {
    Map<String, Object> source = new HashMap<>();
    source.put("tags", List.of());

    assertEquals("", SearchResultCsvExporter.extractTags(source));
    assertEquals("", SearchResultCsvExporter.extractGlossaryTerms(source));
  }

  @Test
  void testExtractTagsWithNullTagsField() {
    Map<String, Object> source = new HashMap<>();
    source.put("tags", null);

    assertEquals("", SearchResultCsvExporter.extractTags(source));
    assertEquals("", SearchResultCsvExporter.extractGlossaryTerms(source));
  }

  @Test
  void testExtractTagsWithNonListValue() {
    Map<String, Object> source = new HashMap<>();
    source.put("tags", "not-a-list");

    assertEquals("", SearchResultCsvExporter.extractTags(source));
  }

  @Test
  void testExtractTagsWithNonMapEntriesInList() {
    Map<String, Object> source = new HashMap<>();
    List<Object> mixed = new ArrayList<>();
    mixed.add(Map.of("tagFQN", "PII.Sensitive", "source", "Classification"));
    mixed.add("string-entry");
    mixed.add(123);
    source.put("tags", mixed);

    assertEquals("PII.Sensitive", SearchResultCsvExporter.extractTags(source));
  }

  @Test
  void testExtractTagsOnlyClassificationNotGlossary() {
    Map<String, Object> source = new HashMap<>();
    source.put("tags", List.of(Map.of("tagFQN", "glossary.term", "source", "Glossary")));

    assertEquals("", SearchResultCsvExporter.extractTags(source));
  }

  @Test
  void testExtractGlossaryTermsOnlyGlossaryNotClassification() {
    Map<String, Object> source = new HashMap<>();
    source.put("tags", List.of(Map.of("tagFQN", "PII.Sensitive", "source", "Classification")));

    assertEquals("", SearchResultCsvExporter.extractGlossaryTerms(source));
  }

  @Test
  void testExtractTagsWithMissingSourceField() {
    Map<String, Object> source = new HashMap<>();
    source.put("tags", List.of(Map.of("tagFQN", "SomeTag")));

    assertEquals("", SearchResultCsvExporter.extractTags(source));
    assertEquals("", SearchResultCsvExporter.extractGlossaryTerms(source));
  }

  @Test
  void testExtractTagsWithEmptyTagFQN() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> tag = new HashMap<>();
    tag.put("tagFQN", "");
    tag.put("source", "Classification");
    source.put("tags", List.of(tag));

    assertEquals("", SearchResultCsvExporter.extractTags(source));
  }

  // ===================================================================
  // extractDomains TESTS
  // ===================================================================

  @Test
  void testExtractDomainsMultiple() {
    Map<String, Object> source = new HashMap<>();
    source.put(
        "domains",
        List.of(
            Map.of("displayName", "Finance", "name", "finance"), Map.of("name", "engineering")));

    assertEquals("Finance|engineering", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsFallbackToSingleDomain() {
    Map<String, Object> source = new HashMap<>();
    source.put("domain", Map.of("displayName", "Marketing", "name", "marketing"));

    assertEquals("Marketing", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsEmptyList() {
    Map<String, Object> source = new HashMap<>();
    source.put("domains", List.of());

    assertEquals("", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsNullField() {
    Map<String, Object> source = new HashMap<>();
    source.put("domains", null);

    assertEquals("", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsNonListValue() {
    Map<String, Object> source = new HashMap<>();
    source.put("domains", "not-a-list");

    assertEquals("", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsSingleDomainWithOnlyName() {
    Map<String, Object> source = new HashMap<>();
    source.put("domain", Map.of("name", "finance"));

    assertEquals("finance", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsSingleDomainNullName() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> domain = new HashMap<>();
    domain.put("displayName", null);
    domain.put("name", null);
    source.put("domain", domain);

    assertEquals("", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsSingleDomainEmptyDisplayName() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> domain = new HashMap<>();
    domain.put("displayName", "");
    domain.put("name", "fallback");
    source.put("domain", domain);

    assertEquals("fallback", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsWithNonMapEntriesInList() {
    Map<String, Object> source = new HashMap<>();
    List<Object> mixed = new ArrayList<>();
    mixed.add(Map.of("name", "finance"));
    mixed.add("string-entry");
    source.put("domains", mixed);

    assertEquals("finance", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsListTakesPriorityOverSingle() {
    Map<String, Object> source = new HashMap<>();
    source.put("domains", List.of(Map.of("name", "from-list")));
    source.put("domain", Map.of("name", "from-single"));

    assertEquals("from-list", SearchResultCsvExporter.extractDomains(source));
  }

  @Test
  void testExtractDomainsSingleDomainNonMapValue() {
    Map<String, Object> source = new HashMap<>();
    source.put("domain", "not-a-map");

    assertEquals("", SearchResultCsvExporter.extractDomains(source));
  }

  // ===================================================================
  // extractTier TESTS
  // ===================================================================

  @Test
  void testExtractTier() {
    Map<String, Object> source = new HashMap<>();
    source.put("tier", Map.of("tagFQN", "Tier.Tier2"));

    assertEquals("Tier.Tier2", SearchResultCsvExporter.extractTier(source));
  }

  @Test
  void testExtractTierMissing() {
    Map<String, Object> source = new HashMap<>();

    assertEquals("", SearchResultCsvExporter.extractTier(source));
  }

  @Test
  void testExtractTierNullField() {
    Map<String, Object> source = new HashMap<>();
    source.put("tier", null);

    assertEquals("", SearchResultCsvExporter.extractTier(source));
  }

  @Test
  void testExtractTierNonMapValue() {
    Map<String, Object> source = new HashMap<>();
    source.put("tier", "Tier.Tier1");

    assertEquals("", SearchResultCsvExporter.extractTier(source));
  }

  @Test
  void testExtractTierWithNullTagFQN() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> tier = new HashMap<>();
    tier.put("tagFQN", null);
    source.put("tier", tier);

    assertEquals("", SearchResultCsvExporter.extractTier(source));
  }

  @Test
  void testExtractTierEmptyMap() {
    Map<String, Object> source = new HashMap<>();
    source.put("tier", Map.of());

    assertEquals("", SearchResultCsvExporter.extractTier(source));
  }

  // ===================================================================
  // extractServiceName TESTS
  // ===================================================================

  @Test
  void testExtractServiceName() {
    Map<String, Object> source = new HashMap<>();
    source.put("service", Map.of("name", "my-service", "id", "123"));

    assertEquals("my-service", SearchResultCsvExporter.extractServiceName(source));
  }

  @Test
  void testExtractServiceNameMissing() {
    Map<String, Object> source = new HashMap<>();

    assertEquals("", SearchResultCsvExporter.extractServiceName(source));
  }

  @Test
  void testExtractServiceNameNullField() {
    Map<String, Object> source = new HashMap<>();
    source.put("service", null);

    assertEquals("", SearchResultCsvExporter.extractServiceName(source));
  }

  @Test
  void testExtractServiceNameNonMapValue() {
    Map<String, Object> source = new HashMap<>();
    source.put("service", "mysql-service");

    assertEquals("", SearchResultCsvExporter.extractServiceName(source));
  }

  @Test
  void testExtractServiceNameWithNullName() {
    Map<String, Object> source = new HashMap<>();
    Map<String, Object> service = new HashMap<>();
    service.put("name", null);
    source.put("service", service);

    assertEquals("", SearchResultCsvExporter.extractServiceName(source));
  }

  @Test
  void testExtractServiceNameEmptyMap() {
    Map<String, Object> source = new HashMap<>();
    source.put("service", Map.of());

    assertEquals("", SearchResultCsvExporter.extractServiceName(source));
  }

  // ===================================================================
  // CONSTANTS TESTS
  // ===================================================================

  @Test
  void testExportSourceFieldsContainsRequiredFields() {
    List<String> fields = SearchResultCsvExporter.EXPORT_SOURCE_FIELDS;

    assertTrue(fields.contains("entityType"));
    assertTrue(fields.contains("name"));
    assertTrue(fields.contains("displayName"));
    assertTrue(fields.contains("fullyQualifiedName"));
    assertTrue(fields.contains("description"));
    assertTrue(fields.contains("service"));
    assertTrue(fields.contains("serviceType"));
    assertTrue(fields.contains("owners"));
    assertTrue(fields.contains("tags"));
    assertTrue(fields.contains("tier"));
    assertTrue(fields.contains("domain"));
    assertTrue(fields.contains("domains"));
  }

  @Test
  void testCsvHeaderMatchesExpectedColumns() {
    String expected =
        "Entity Type,Service Name,Service Type,FQN,Name,Display Name,Description,Owners,Tags,Glossary Terms,Domains,Tier";
    assertEquals(expected, SearchResultCsvExporter.CSV_HEADER);
  }

  @Test
  void testMaxExportRows() {
    assertEquals(200_000, SearchResultCsvExporter.MAX_EXPORT_ROWS);
  }

  @Test
  void testBatchSize() {
    assertEquals(1_000, SearchResultCsvExporter.BATCH_SIZE);
  }

  @Test
  void testExportSourceFieldsIsNotEmpty() {
    assertNotNull(SearchResultCsvExporter.EXPORT_SOURCE_FIELDS);
    assertFalse(SearchResultCsvExporter.EXPORT_SOURCE_FIELDS.isEmpty());
  }
}

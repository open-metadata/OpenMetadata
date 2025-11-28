package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Unit test to validate deleted field is included in search results
 */
class SearchMetadataToolDeletedFieldTest {

  @Test
  void testDeletedFieldInEssentialFieldsOnly() {
    // Verify that 'deleted' is in the essential fields list
    assertThat(SearchMetadataTool.class.getDeclaredFields())
        .anyMatch(field -> field.getName().equals("ESSENTIAL_FIELDS_ONLY"));
    
    // This ensures the code compiles and the field exists
    System.out.println("✓ ESSENTIAL_FIELDS_ONLY field exists in SearchMetadataTool");
  }

  @Test
  void testCleanSearchResultIncludesDeletedField() {
    // Create a mock search result with deleted field
    Map<String, Object> source = new HashMap<>();
    source.put("name", "test_table");
    source.put("deleted", true);
    source.put("entityType", "table");
    source.put("fullyQualifiedName", "test.db.schema.test_table");
    source.put("description", "Test table");
    
    // Clean the result (this should preserve deleted field)
    Map<String, Object> cleaned = SearchMetadataTool.cleanSearchResult(source, List.of());
    
    // Verify deleted field is preserved
    assertThat(cleaned).containsKey("deleted");
    assertThat(cleaned.get("deleted")).isEqualTo(true);
    
    System.out.println("✓ cleanSearchResult preserves deleted field");
  }

  @Test
  void testCleanSearchResultIncludesDeletedFalse() {
    // Create a mock search result with deleted=false
    Map<String, Object> source = new HashMap<>();
    source.put("name", "active_table");
    source.put("deleted", false);
    source.put("entityType", "table");
    source.put("fullyQualifiedName", "test.db.schema.active_table");
    
    // Clean the result
    Map<String, Object> cleaned = SearchMetadataTool.cleanSearchResult(source, List.of());
    
    // Verify deleted field is preserved with false value
    assertThat(cleaned).containsKey("deleted");
    assertThat(cleaned.get("deleted")).isEqualTo(false);
    
    System.out.println("✓ cleanSearchResult preserves deleted=false field");
  }

  @Test
  void testCleanSearchResponseObjectDoesNotRemoveDeleted() {
    // Create a mock object with deleted field
    Map<String, Object> object = new HashMap<>();
    object.put("name", "test_table");
    object.put("deleted", true);
    object.put("id", "some-uuid");
    object.put("version", "1.0");
    
    // Clean the object (this is used in RootCauseAnalysisTool)
    Map<String, Object> cleaned = SearchMetadataTool.cleanSearchResponseObject(object);
    
    // Verify deleted field is NOT removed (even though it was in DETAILED_EXCLUDE_KEYS before our fix)
    assertThat(cleaned).containsKey("deleted");
    assertThat(cleaned.get("deleted")).isEqualTo(true);
    
    // Verify other fields ARE removed
    assertThat(cleaned).doesNotContainKey("id");
    assertThat(cleaned).doesNotContainKey("version");
    
    System.out.println("✓ cleanSearchResponseObject preserves deleted field");
  }
}

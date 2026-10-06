package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;

class TriggerEntityFilterTest {
  private static final String GLOSSARY_TERM = "glossaryTerm";
  private static final String NAME_IS_FOO = "{\"==\":[{\"var\":\"name\"},\"foo\"]}";
  private static final String ALWAYS = "{\"==\":[1,1]}";

  // Guards against the historical UI bug where an incomplete filter tree was serialized as a
  // JSON-encoded empty string \"\" and persisted per entity in the trigger config. Also handles
  // \"{}\" and whitespace forms.

  @Test
  void blankAndPoisonedEntityFiltersMeanNoFilter() {
    for (String poisoned : List.of("", "   ", "\"\"", "  \"\"  ", "{}", "  {}  ")) {
      assertNull(
          TriggerEntityFilter.forEntityType(filterFor(GLOSSARY_TERM, poisoned), GLOSSARY_TERM),
          poisoned);
    }
    assertNull(TriggerEntityFilter.forEntityType(filterFor(GLOSSARY_TERM, null), GLOSSARY_TERM));
  }

  @Test
  void realEntityFilterIsKept() {
    assertEquals(
        NAME_IS_FOO,
        TriggerEntityFilter.forEntityType(filterFor(GLOSSARY_TERM, NAME_IS_FOO), GLOSSARY_TERM));
  }

  // Entity-specific value wins over default; poisoned values are skipped instead of leaking into
  // RuleEngine (which fails and would flip the exclusion filter's fail-open semantics into a hard
  // reject).

  @Test
  void entitySpecificFilterWinsOverDefault() {
    Map<String, String> filter = filterFor("default", ALWAYS);
    filter.put(GLOSSARY_TERM, NAME_IS_FOO);
    assertEquals(NAME_IS_FOO, TriggerEntityFilter.forEntityType(filter, GLOSSARY_TERM));
  }

  @Test
  void defaultFilterAppliesWhenTheEntityHasNone() {
    assertEquals(
        ALWAYS, TriggerEntityFilter.forEntityType(filterFor("default", ALWAYS), GLOSSARY_TERM));
  }

  @Test
  void poisonedEntityFilterFallsBackToDefault() {
    Map<String, String> filter = filterFor("default", ALWAYS);
    filter.put(GLOSSARY_TERM, "\"\"");
    assertEquals(ALWAYS, TriggerEntityFilter.forEntityType(filter, GLOSSARY_TERM));
  }

  @Test
  void allPoisonedFiltersMeanNoFilter() {
    Map<String, String> filter = filterFor("default", "\"\"");
    filter.put(GLOSSARY_TERM, "\"\"");
    assertNull(TriggerEntityFilter.forEntityType(filter, GLOSSARY_TERM));
    assertNull(TriggerEntityFilter.forEntityType(new HashMap<>(), GLOSSARY_TERM));
  }

  @Test
  void jsonObjectStringIsReadLikeAMap() {
    String filter = "{\"" + GLOSSARY_TERM + "\":\"" + NAME_IS_FOO.replace("\"", "\\\"") + "\"}";
    assertEquals(NAME_IS_FOO, TriggerEntityFilter.forEntityType(filter, GLOSSARY_TERM));
  }

  @Test
  void plainStringEmptyStringAndOtherTypesMeanNoFilter() {
    assertNull(TriggerEntityFilter.forEntityType(NAME_IS_FOO.substring(1), GLOSSARY_TERM));
    assertNull(TriggerEntityFilter.forEntityType("  ", GLOSSARY_TERM));
    assertNull(TriggerEntityFilter.forEntityType(42, GLOSSARY_TERM));
    assertNull(TriggerEntityFilter.forEntityType(null, GLOSSARY_TERM));
  }

  @Test
  void filterExcludesOnlyTheEntitiesItMatches() {
    assertTrue(TriggerEntityFilter.excludes(NAME_IS_FOO, new GlossaryTerm().withName("foo")));
    assertFalse(TriggerEntityFilter.excludes(NAME_IS_FOO, new GlossaryTerm().withName("bar")));
    assertFalse(TriggerEntityFilter.excludes(null, new GlossaryTerm().withName("foo")));
    assertFalse(TriggerEntityFilter.excludes("not json logic", new GlossaryTerm().withName("foo")));
  }

  private static Map<String, String> filterFor(String key, String value) {
    Map<String, String> filter = new HashMap<>();
    filter.put(key, value);
    return filter;
  }
}

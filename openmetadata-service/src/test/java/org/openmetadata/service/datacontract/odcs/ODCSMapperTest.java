package org.openmetadata.service.datacontract.odcs;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.data.Sla;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.QualityExpectation;
import org.openmetadata.schema.type.SemanticsRule;

class ODCSMapperTest {

  private ODCSMapper mapper;
  private EntityReference targetEntity;

  @BeforeEach
  void setUp() {
    mapper = new ODCSMapper();
    targetEntity = new EntityReference();
    targetEntity.setId(UUID.randomUUID());
    targetEntity.setName("test_table");
    targetEntity.setType("table");
    targetEntity.setFullyQualifiedName("service.database.schema.test_table");
  }

  @Test
  void testMapBasicContract() {
    // Create minimal ODCS contract
    ODCSContract odcs = new ODCSContract();
    odcs.setApiVersion("v3.0.2");
    odcs.setKind("DataContract");
    odcs.setId("12345678-1234-1234-1234-123456789012");
    odcs.setName("Test Contract");
    odcs.setVersion("1.0.0");
    odcs.setStatus("active");

    // Map to DataContract
    DataContract result = mapper.mapToDataContract(odcs, targetEntity);

    // Verify basic fields
    assertNotNull(result);
    assertEquals("Test Contract", result.getName());
    assertEquals("Test Contract", result.getDisplayName());
    assertEquals(0.1, result.getVersion());
    assertEquals(ContractStatus.Active, result.getStatus());
    assertEquals(targetEntity, result.getEntity());
    assertTrue(result.getDescription().contains("12345678-1234-1234-1234-123456789012"));
    assertTrue(result.getDescription().contains("v3.0.2"));
  }

  @Test
  void testMapStatusValues() {
    ODCSContract odcs = createBasicContract();

    // Test proposed -> Draft
    odcs.setStatus("proposed");
    assertEquals(ContractStatus.Draft, mapper.mapToDataContract(odcs, targetEntity).getStatus());

    // Test draft -> Draft
    odcs.setStatus("draft");
    assertEquals(ContractStatus.Draft, mapper.mapToDataContract(odcs, targetEntity).getStatus());

    // Test active -> Active
    odcs.setStatus("active");
    assertEquals(ContractStatus.Active, mapper.mapToDataContract(odcs, targetEntity).getStatus());

    // Test deprecated -> Deprecated
    odcs.setStatus("deprecated");
    assertEquals(
        ContractStatus.Deprecated, mapper.mapToDataContract(odcs, targetEntity).getStatus());

    // Test retired -> Deprecated
    odcs.setStatus("retired");
    assertEquals(
        ContractStatus.Deprecated, mapper.mapToDataContract(odcs, targetEntity).getStatus());
  }

  @Test
  void testMapSchemaWithProperties() {
    ODCSContract odcs = createBasicContract();

    // Create schema with properties
    ODCSSchema schema = new ODCSSchema();
    schema.setName("orders");

    ODCSProperty prop1 = new ODCSProperty();
    prop1.setName("order_id");
    prop1.setLogicalType("string");
    prop1.setPrimaryKey(true);
    prop1.setRequired(true);
    prop1.setDescription("Unique order identifier");

    ODCSProperty prop2 = new ODCSProperty();
    prop2.setName("amount");
    prop2.setLogicalType("decimal");
    prop2.setPrecision(10);
    prop2.setScale(2);
    prop2.setRequired(true);

    ODCSProperty prop3 = new ODCSProperty();
    prop3.setName("customer_email");
    prop3.setLogicalType("varchar");
    prop3.setMaxLength(255);
    prop3.setClassification("PII");

    schema.setProperties(Arrays.asList(prop1, prop2, prop3));
    odcs.setSchema(Collections.singletonList(schema));

    // Map to DataContract
    DataContract result = mapper.mapToDataContract(odcs, targetEntity);

    // Verify schema mapping
    assertNotNull(result.getSchema());
    List<Column> columns = result.getSchema();
    assertEquals(3, columns.size());

    // Verify first column
    Column col1 = columns.getFirst();
    assertEquals("order_id", col1.getName());
    assertEquals(ColumnDataType.STRING, col1.getDataType());
    assertEquals("Unique order identifier", col1.getDescription());
    assertEquals(ColumnConstraint.PRIMARY_KEY, col1.getConstraint());

    // Verify second column
    Column col2 = columns.get(1);
    assertEquals("amount", col2.getName());
    assertEquals(ColumnDataType.DECIMAL, col2.getDataType());
    assertEquals("DECIMAL(10,2)", col2.getDataTypeDisplay());
    assertEquals(ColumnConstraint.NOT_NULL, col2.getConstraint());

    // Verify third column with PII tag
    Column col3 = columns.get(2);
    assertEquals("customer_email", col3.getName());
    assertEquals(ColumnDataType.VARCHAR, col3.getDataType());
    assertEquals(255, col3.getDataLength());
    assertNotNull(col3.getTags());
    assertEquals(1, col3.getTags().size());
    assertEquals("PII.Sensitive", col3.getTags().getFirst().getTagFQN());
  }

  @Test
  void testMapQualityRules() {
    ODCSContract odcs = createBasicContract();

    // Add various quality rules
    ODCSQuality textRule = new ODCSQuality();
    textRule.setType("text");
    textRule.setDescription("Amount must be positive");
    textRule.setRule("amount > 0");

    ODCSQuality sqlRule = new ODCSQuality();
    sqlRule.setType("sql");
    sqlRule.setDescription("Check duplicate orders");
    sqlRule.setRule("SELECT COUNT(*) FROM orders GROUP BY order_id HAVING COUNT(*) > 1");

    ODCSQuality libraryRule = new ODCSQuality();
    libraryRule.setType("library");
    libraryRule.setDescription("Email validation");
    libraryRule.setLibrary("great_expectations");
    libraryRule.setRule("expect_column_values_to_match_regex");

    odcs.setQuality(Arrays.asList(textRule, sqlRule, libraryRule));

    DataContract result = mapper.mapToDataContract(odcs, targetEntity);

    assertNotNull(result.getQualityExpectations());
    assertEquals(2, result.getQualityExpectations().size());

    QualityExpectation exp1 = result.getQualityExpectations().getFirst();
    assertEquals("Amount must be positive", exp1.getName());
    assertEquals("amount > 0", exp1.getDescription());

    // Verify semantic rules (SQL rules)
    assertNotNull(result.getSemantics());
    assertEquals(1, result.getSemantics().size());

    SemanticsRule sem1 = result.getSemantics().getFirst();
    assertEquals("Check duplicate orders", sem1.getName());
    assertTrue(sem1.getDescription().contains("SQL Rule"));
  }

  @Test
  void testMapSlaProperties() {
    ODCSContract odcs = createBasicContract();

    // Add SLA properties
    ODCSSla latency = new ODCSSla();
    latency.setProperty("maxLatency");
    latency.setValue("24");
    latency.setUnit("hours");

    ODCSSla frequency = new ODCSSla();
    frequency.setProperty("refreshFrequency");
    frequency.setValue("30");
    frequency.setUnit("minutes");

    ODCSSla availability = new ODCSSla();
    availability.setProperty("availabilityTime");
    availability.setValue("9AM-5PM EST");

    odcs.setSlaProperties(Arrays.asList(latency, frequency, availability));

    // Map to DataContract
    DataContract result = mapper.mapToDataContract(odcs, targetEntity);

    // Verify SLA mapping
    assertNotNull(result.getSla());
    Sla sla = result.getSla();

    assertNotNull(sla.getMaxLatency());
    assertEquals(24, sla.getMaxLatency().getValue());
    assertEquals(MaxLatency.Unit.HOUR, sla.getMaxLatency().getUnit());

    assertNotNull(sla.getRefreshFrequency());
    // 30 minutes gets converted to 1 hour (rounded up)
    assertEquals(1, sla.getRefreshFrequency().getInterval());
    assertEquals(RefreshFrequency.Unit.HOUR, sla.getRefreshFrequency().getUnit());

    assertEquals("9AM-5PM EST", sla.getAvailabilityTime());
  }

  @Test
  void testMapTeamMembers() {
    ODCSContract odcs = createBasicContract();

    // Add team members
    ODCSTeam owner = new ODCSTeam();
    owner.setUsername("john.doe");
    owner.setRole("Data Owner");

    ODCSTeam reviewer = new ODCSTeam();
    reviewer.setUsername("jane.smith");
    reviewer.setRole("Data Reviewer");

    ODCSTeam analyst = new ODCSTeam();
    analyst.setUsername("bob.jones");
    analyst.setRole("Data Analyst");

    odcs.setTeam(Arrays.asList(owner, reviewer, analyst));

    // Map to DataContract
    DataContract result = mapper.mapToDataContract(odcs, targetEntity);

    // Verify team mapping
    assertNotNull(result.getOwners());
    assertEquals(2, result.getOwners().size());
    assertTrue(result.getOwners().stream().anyMatch(o -> "john.doe".equals(o.getName())));
    assertTrue(result.getOwners().stream().anyMatch(o -> "bob.jones".equals(o.getName())));

    assertNotNull(result.getReviewers());
    assertEquals(1, result.getReviewers().size());
    assertEquals("jane.smith", result.getReviewers().getFirst().getName());
  }

  @Test
  void testMapDescription() {
    ODCSContract odcs = createBasicContract();

    // Add description fields
    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Track customer orders");
    desc.setLimitations("Does not include cancelled orders");
    desc.setUsage("Use for sales analytics");

    odcs.setDescription(desc);

    // Map to DataContract
    DataContract result = mapper.mapToDataContract(odcs, targetEntity);

    // Verify description contains all sections
    String description = result.getDescription();
    assertNotNull(description);
    assertTrue(description.contains("## Purpose"));
    assertTrue(description.contains("Track customer orders"));
    assertTrue(description.contains("## Limitations"));
    assertTrue(description.contains("Does not include cancelled orders"));
    assertTrue(description.contains("## Usage"));
    assertTrue(description.contains("Use for sales analytics"));
  }

  private ODCSContract createBasicContract() {
    ODCSContract odcs = new ODCSContract();
    odcs.setApiVersion("v3.0.0");
    odcs.setKind("DataContract");
    odcs.setId("test-id");
    odcs.setVersion("1.0.0");
    odcs.setStatus("active");
    return odcs;
  }
}

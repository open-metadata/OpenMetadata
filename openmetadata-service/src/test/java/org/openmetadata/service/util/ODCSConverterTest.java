/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.ContractSecurity;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.Policy;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.data.Retention;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSRole;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSTeamMember;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;

class ODCSConverterTest {

  @Test
  void testToODCS_BasicContract() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("test_contract");
    contract.setDescription("Test contract description");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setFullyQualifiedName("service.database.schema.table");
    contract.setEntity(entity);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());
    assertEquals(ODCSDataContract.OdcsKind.DATA_CONTRACT, odcs.getKind());
    assertEquals("test_contract", odcs.getName());
    assertEquals(ODCSDataContract.OdcsStatus.ACTIVE, odcs.getStatus());
    assertNotNull(odcs.getDescription());
    assertEquals("Test contract description", odcs.getDescription().getPurpose());
  }

  @Test
  void testToODCS_Version310() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("version_test");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());
  }

  @Test
  void testToODCS_WithTimestampType() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("timestamp_test");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setName("my_table");
    contract.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    columns.add(new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP));
    columns.add(new Column().withName("updated_at").withDataType(ColumnDataType.TIMESTAMPZ));
    contract.setSchema(columns);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    // Schema is now wrapped in an object (table)
    assertNotNull(odcs.getSchema());
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals("my_table", tableObject.getName());
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertNotNull(tableObject.getProperties());
    assertEquals(2, tableObject.getProperties().size());
    assertEquals(
        ODCSSchemaElement.LogicalType.TIMESTAMP,
        tableObject.getProperties().get(0).getLogicalType());
    assertEquals(
        ODCSSchemaElement.LogicalType.TIMESTAMP,
        tableObject.getProperties().get(1).getLogicalType());
  }

  @Test
  void testToODCS_WithTimeType() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("time_test");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setName("time_table");
    contract.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    columns.add(new Column().withName("start_time").withDataType(ColumnDataType.TIME));
    contract.setSchema(columns);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    // Schema is now wrapped in an object (table)
    assertNotNull(odcs.getSchema());
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals("time_table", tableObject.getName());
    assertNotNull(tableObject.getProperties());
    assertEquals(1, tableObject.getProperties().size());
    assertEquals(
        ODCSSchemaElement.LogicalType.TIME, tableObject.getProperties().get(0).getLogicalType());
  }

  @Test
  void testFromODCS_WithTimestampType() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Schema wrapped in object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("events");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    tableObject.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("event_ts")
                .withLogicalType(ODCSSchemaElement.LogicalType.TIMESTAMP)));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("events");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(1, contract.getSchema().size());
    assertEquals(ColumnDataType.TIMESTAMP, contract.getSchema().get(0).getDataType());
  }

  @Test
  void testFromODCS_WithTimeType() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Schema wrapped in object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("schedules");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    tableObject.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("schedule_time")
                .withLogicalType(ODCSSchemaElement.LogicalType.TIME)));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("schedules");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(1, contract.getSchema().size());
    assertEquals(ColumnDataType.TIME, contract.getSchema().get(0).getDataType());
  }

  @Test
  void testVersionBackwardsCompatibility_302() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("compat_test");
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Schema wrapped in object (table) for v3.0.2 compatibility
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("dates_table");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    tableObject.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("date_col")
                .withLogicalType(ODCSSchemaElement.LogicalType.DATE)));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("dates_table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    assertEquals("compat_test", contract.getName());
    assertEquals(EntityStatus.APPROVED, contract.getEntityStatus());
    assertEquals(ColumnDataType.DATE, contract.getSchema().get(0).getDataType());
  }

  @Test
  void testToODCS_WithSchema() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("schema_contract");
    contract.setEntityStatus(EntityStatus.DRAFT);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setName("users");
    contract.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    Column idColumn = new Column();
    idColumn.setName("id");
    idColumn.setDataType(ColumnDataType.INT);
    idColumn.setDescription("Primary key");
    idColumn.setConstraint(ColumnConstraint.PRIMARY_KEY);
    columns.add(idColumn);

    Column nameColumn = new Column();
    nameColumn.setName("name");
    nameColumn.setDataType(ColumnDataType.STRING);
    nameColumn.setDescription("User name");
    nameColumn.setDataLength(255);
    columns.add(nameColumn);

    contract.setSchema(columns);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs);
    assertNotNull(odcs.getSchema());
    // Schema is now wrapped in an object (table)
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals("users", tableObject.getName());
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertEquals("table", tableObject.getPhysicalType());
    assertNotNull(tableObject.getProperties());
    assertEquals(2, tableObject.getProperties().size());

    ODCSSchemaElement idElement = tableObject.getProperties().get(0);
    assertEquals("id", idElement.getName());
    assertEquals(ODCSSchemaElement.LogicalType.INTEGER, idElement.getLogicalType());
    assertEquals("INT", idElement.getPhysicalType());
    assertTrue(idElement.getPrimaryKey());

    ODCSSchemaElement nameElement = tableObject.getProperties().get(1);
    assertEquals("name", nameElement.getName());
    assertEquals(ODCSSchemaElement.LogicalType.STRING, nameElement.getLogicalType());
    assertNotNull(nameElement.getLogicalTypeOptions());
  }

  @Test
  void testToODCS_WithSLA() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("sla_contract");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ContractSLA sla = new ContractSLA();
    RefreshFrequency rf = new RefreshFrequency();
    rf.setInterval(1);
    rf.setUnit(RefreshFrequency.Unit.DAY);
    sla.setRefreshFrequency(rf);

    MaxLatency ml = new MaxLatency();
    ml.setValue(4);
    ml.setUnit(MaxLatency.Unit.HOUR);
    sla.setMaxLatency(ml);

    contract.setSla(sla);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs);
    assertNotNull(odcs.getSlaProperties());
    assertEquals(2, odcs.getSlaProperties().size());

    boolean hasRefreshFrequency =
        odcs.getSlaProperties().stream()
            .anyMatch(p -> "freshness".equals(p.getProperty()) && "1".equals(p.getValue()));
    assertTrue(hasRefreshFrequency);

    boolean hasMaxLatency =
        odcs.getSlaProperties().stream()
            .anyMatch(p -> "latency".equals(p.getProperty()) && "4".equals(p.getValue()));
    assertTrue(hasMaxLatency);
  }

  @Test
  void testFromODCS_BasicContract() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("odcs_test_contract");
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("test_table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    assertEquals("odcs_test_contract", contract.getName());
    assertEquals(EntityStatus.APPROVED, contract.getEntityStatus());
    assertNotNull(contract.getEntity());
  }

  @Test
  void testFromODCS_WithSchema() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    // Schema wrapped in object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("users");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    List<ODCSSchemaElement> properties = new ArrayList<>();

    ODCSSchemaElement idElement = new ODCSSchemaElement();
    idElement.setName("id");
    idElement.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    idElement.setDescription("Primary key column");
    idElement.setPrimaryKey(true);
    properties.add(idElement);

    ODCSSchemaElement emailElement = new ODCSSchemaElement();
    emailElement.setName("email");
    emailElement.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    emailElement.setRequired(true);
    properties.add(emailElement);

    tableObject.setProperties(properties);
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("users");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    assertNotNull(contract.getSchema());
    assertEquals(2, contract.getSchema().size());

    Column idColumn = contract.getSchema().get(0);
    assertEquals("id", idColumn.getName());
    assertEquals(ColumnDataType.INT, idColumn.getDataType());
    assertEquals(ColumnConstraint.PRIMARY_KEY, idColumn.getConstraint());

    Column emailColumn = contract.getSchema().get(1);
    assertEquals("email", emailColumn.getName());
    assertEquals(ColumnConstraint.NOT_NULL, emailColumn.getConstraint());
  }

  @Test
  void testFromODCS_WithSLA() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSlaProperty> slaProperties = new ArrayList<>();

    ODCSSlaProperty refreshFreq = new ODCSSlaProperty();
    refreshFreq.setProperty("refreshFrequency");
    refreshFreq.setValue("2");
    refreshFreq.setUnit("day");
    slaProperties.add(refreshFreq);

    ODCSSlaProperty retention = new ODCSSlaProperty();
    retention.setProperty("retention");
    retention.setValue("90");
    retention.setUnit("day");
    slaProperties.add(retention);

    odcs.setSlaProperties(slaProperties);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    assertNotNull(contract.getSla());
    assertNotNull(contract.getSla().getRefreshFrequency());
    assertEquals(2, contract.getSla().getRefreshFrequency().getInterval());
    assertEquals(RefreshFrequency.Unit.DAY, contract.getSla().getRefreshFrequency().getUnit());
    assertNotNull(contract.getSla().getRetention());
    assertEquals(90, contract.getSla().getRetention().getPeriod());
  }

  @Test
  void testFromODCS_WithTeam() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSTeamMember> team = new ArrayList<>();

    ODCSTeamMember owner1 = new ODCSTeamMember();
    owner1.setUsername("john.doe");
    owner1.setName("John Doe");
    owner1.setRole("owner");
    team.add(owner1);

    ODCSTeamMember owner2 = new ODCSTeamMember();
    owner2.setUsername("jane.doe");
    owner2.setName("Jane Doe");
    owner2.setRole("owner");
    team.add(owner2);

    ODCSTeamMember contributor = new ODCSTeamMember();
    contributor.setUsername("contributor");
    contributor.setRole("contributor");
    team.add(contributor);

    odcs.setTeam(team);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    // Note: In unit tests without database context, team member resolution won't find users/teams
    // The converter gracefully handles this by returning empty owners list
    // In integration tests with database, this would return actual owner references
    assertNotNull(contract.getOwners());
    // Database lookups won't work in unit tests, so we expect empty list
    assertTrue(contract.getOwners().isEmpty());
  }

  @Test
  void testStatusMapping() {
    assertEquals(ODCSDataContract.OdcsStatus.DRAFT, getODCSStatus(EntityStatus.DRAFT));
    assertEquals(ODCSDataContract.OdcsStatus.ACTIVE, getODCSStatus(EntityStatus.APPROVED));
    assertEquals(ODCSDataContract.OdcsStatus.DEPRECATED, getODCSStatus(EntityStatus.DEPRECATED));
  }

  @Test
  void testRoundTrip() {
    DataContract original = new DataContract();
    original.setId(UUID.randomUUID());
    original.setName("roundtrip_contract");
    original.setDescription("Round trip test");
    original.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setFullyQualifiedName("db.schema.table");
    original.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    Column col = new Column();
    col.setName("test_col");
    col.setDataType(ColumnDataType.STRING);
    columns.add(col);
    original.setSchema(columns);

    ODCSDataContract odcs = ODCSConverter.toODCS(original);

    EntityReference newEntityRef = new EntityReference();
    newEntityRef.setId(UUID.randomUUID());
    newEntityRef.setType("table");

    DataContract converted = ODCSConverter.fromODCS(odcs, newEntityRef);

    assertEquals(original.getName(), converted.getName());
    assertEquals(original.getEntityStatus(), converted.getEntityStatus());
    assertEquals(original.getSchema().size(), converted.getSchema().size());
    assertEquals(original.getSchema().get(0).getName(), converted.getSchema().get(0).getName());
  }

  private ODCSDataContract.OdcsStatus getODCSStatus(EntityStatus status) {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("test");
    contract.setEntityStatus(status);
    contract.setEntity(new EntityReference().withId(UUID.randomUUID()).withType("table"));

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);
    return odcs.getStatus();
  }

  @Test
  void testToODCS_WithAllDataTypes() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("datatype_test_contract");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setName("all_types_table");
    contract.setEntity(entity);

    List<Column> columns = new ArrayList<>();

    columns.add(new Column().withName("int_col").withDataType(ColumnDataType.INT));
    columns.add(new Column().withName("bigint_col").withDataType(ColumnDataType.BIGINT));
    columns.add(new Column().withName("float_col").withDataType(ColumnDataType.FLOAT));
    columns.add(new Column().withName("double_col").withDataType(ColumnDataType.DOUBLE));
    columns.add(new Column().withName("decimal_col").withDataType(ColumnDataType.DECIMAL));
    columns.add(new Column().withName("boolean_col").withDataType(ColumnDataType.BOOLEAN));
    columns.add(new Column().withName("string_col").withDataType(ColumnDataType.STRING));
    columns.add(new Column().withName("date_col").withDataType(ColumnDataType.DATE));
    columns.add(new Column().withName("timestamp_col").withDataType(ColumnDataType.TIMESTAMP));
    columns.add(new Column().withName("array_col").withDataType(ColumnDataType.ARRAY));
    columns.add(new Column().withName("json_col").withDataType(ColumnDataType.JSON));
    columns.add(new Column().withName("struct_col").withDataType(ColumnDataType.STRUCT));

    contract.setSchema(columns);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs.getSchema());
    // Schema is wrapped in object
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals("all_types_table", tableObject.getName());
    assertNotNull(tableObject.getProperties());
    assertEquals(12, tableObject.getProperties().size());
    List<ODCSSchemaElement> props = tableObject.getProperties();

    assertEquals(ODCSSchemaElement.LogicalType.INTEGER, props.get(0).getLogicalType()); // INT
    assertEquals(ODCSSchemaElement.LogicalType.LONG, props.get(1).getLogicalType()); // BIGINT
    assertEquals(ODCSSchemaElement.LogicalType.FLOAT, props.get(2).getLogicalType()); // FLOAT
    assertEquals(ODCSSchemaElement.LogicalType.DOUBLE, props.get(3).getLogicalType()); // DOUBLE
    assertEquals(ODCSSchemaElement.LogicalType.DECIMAL, props.get(4).getLogicalType()); // DECIMAL
    assertEquals(ODCSSchemaElement.LogicalType.BOOLEAN, props.get(5).getLogicalType()); // BOOLEAN
    assertEquals(ODCSSchemaElement.LogicalType.STRING, props.get(6).getLogicalType()); // STRING
    assertEquals(ODCSSchemaElement.LogicalType.DATE, props.get(7).getLogicalType()); // DATE
    assertEquals(
        ODCSSchemaElement.LogicalType.TIMESTAMP, props.get(8).getLogicalType()); // TIMESTAMP
    assertEquals(ODCSSchemaElement.LogicalType.ARRAY, props.get(9).getLogicalType()); // ARRAY
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, props.get(10).getLogicalType()); // JSON
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, props.get(11).getLogicalType()); // STRUCT
  }

  @Test
  void testFromODCS_WithAllLogicalTypes() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Schema wrapped in object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("all_types");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    List<ODCSSchemaElement> properties = new ArrayList<>();

    properties.add(
        new ODCSSchemaElement()
            .withName("int_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER));
    properties.add(
        new ODCSSchemaElement()
            .withName("num_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.NUMBER));
    properties.add(
        new ODCSSchemaElement()
            .withName("bool_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.BOOLEAN));
    properties.add(
        new ODCSSchemaElement()
            .withName("str_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.STRING));
    properties.add(
        new ODCSSchemaElement()
            .withName("date_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.DATE));
    properties.add(
        new ODCSSchemaElement()
            .withName("arr_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.ARRAY));
    // Note: nested OBJECT types (without properties) get treated as STRUCT columns
    ODCSSchemaElement nestedObj = new ODCSSchemaElement();
    nestedObj.setName("obj_col");
    nestedObj.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    nestedObj.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("nested_field")
                .withLogicalType(ODCSSchemaElement.LogicalType.STRING)));
    properties.add(nestedObj);

    tableObject.setProperties(properties);
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("all_types");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(7, contract.getSchema().size());

    assertEquals(ColumnDataType.INT, contract.getSchema().get(0).getDataType());
    assertEquals(ColumnDataType.NUMBER, contract.getSchema().get(1).getDataType());
    assertEquals(ColumnDataType.BOOLEAN, contract.getSchema().get(2).getDataType());
    assertEquals(
        ColumnDataType.STRING,
        contract.getSchema().get(3).getDataType()); // STRING logical type maps to STRING
    assertEquals(ColumnDataType.DATE, contract.getSchema().get(4).getDataType());
    assertEquals(ColumnDataType.ARRAY, contract.getSchema().get(5).getDataType());
    assertEquals(ColumnDataType.STRUCT, contract.getSchema().get(6).getDataType());
  }

  @Test
  void testFromODCS_PhysicalTypeOverridesLogicalType() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Schema wrapped in object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("custom_table");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    ODCSSchemaElement element = new ODCSSchemaElement();
    element.setName("custom_col");
    element.setLogicalType(ODCSSchemaElement.LogicalType.STRING); // This would map to STRING
    element.setPhysicalType("VARCHAR"); // But physical type should override

    tableObject.setProperties(List.of(element));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("custom_table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(1, contract.getSchema().size());
    assertEquals(ColumnDataType.VARCHAR, contract.getSchema().get(0).getDataType());
  }

  @Test
  void testToODCS_WithNestedSchema() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("nested_schema_contract");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setName("customers");
    contract.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    Column parentCol = new Column();
    parentCol.setName("address");
    parentCol.setDataType(ColumnDataType.STRUCT);

    List<Column> childColumns = new ArrayList<>();
    childColumns.add(new Column().withName("street").withDataType(ColumnDataType.STRING));
    childColumns.add(new Column().withName("city").withDataType(ColumnDataType.STRING));
    childColumns.add(new Column().withName("zip").withDataType(ColumnDataType.STRING));
    parentCol.setChildren(childColumns);

    columns.add(parentCol);
    contract.setSchema(columns);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs.getSchema());
    // Schema is wrapped in object (table)
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals("customers", tableObject.getName());
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertNotNull(tableObject.getProperties());
    assertEquals(1, tableObject.getProperties().size());

    // The address column is nested inside the table object
    ODCSSchemaElement addressElement = tableObject.getProperties().get(0);
    assertEquals("address", addressElement.getName());
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, addressElement.getLogicalType());
    assertNotNull(addressElement.getProperties());
    assertEquals(3, addressElement.getProperties().size());
    assertEquals("street", addressElement.getProperties().get(0).getName());
    assertEquals("city", addressElement.getProperties().get(1).getName());
    assertEquals("zip", addressElement.getProperties().get(2).getName());
  }

  @Test
  void testFromODCS_WithNestedSchema() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Schema wrapped in outer object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("customers");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    // Nested object (struct column)
    ODCSSchemaElement addressElement = new ODCSSchemaElement();
    addressElement.setName("address");
    addressElement.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    List<ODCSSchemaElement> addressProperties = new ArrayList<>();
    addressProperties.add(
        new ODCSSchemaElement()
            .withName("street")
            .withLogicalType(ODCSSchemaElement.LogicalType.STRING));
    addressProperties.add(
        new ODCSSchemaElement()
            .withName("city")
            .withLogicalType(ODCSSchemaElement.LogicalType.STRING));
    addressElement.setProperties(addressProperties);

    tableObject.setProperties(List.of(addressElement));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("customers");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(1, contract.getSchema().size());

    Column addressCol = contract.getSchema().get(0);
    assertEquals("address", addressCol.getName());
    assertNotNull(addressCol.getChildren());
    assertEquals(2, addressCol.getChildren().size());
    assertEquals("street", addressCol.getChildren().get(0).getName());
    assertEquals("city", addressCol.getChildren().get(1).getName());
  }

  @Test
  void testFromODCS_StatusMappings() {
    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    assertEquals(
        EntityStatus.DRAFT, getContractStatus(ODCSDataContract.OdcsStatus.PROPOSED, entityRef));
    assertEquals(
        EntityStatus.DRAFT, getContractStatus(ODCSDataContract.OdcsStatus.DRAFT, entityRef));
    assertEquals(
        EntityStatus.APPROVED, getContractStatus(ODCSDataContract.OdcsStatus.ACTIVE, entityRef));
    assertEquals(
        EntityStatus.DEPRECATED,
        getContractStatus(ODCSDataContract.OdcsStatus.DEPRECATED, entityRef));
    assertEquals(
        EntityStatus.DEPRECATED, getContractStatus(ODCSDataContract.OdcsStatus.RETIRED, entityRef));
  }

  @Test
  void testFromODCS_MissingStatusThrowsException() {
    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    // status is null (missing)

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> ODCSConverter.fromODCS(odcs, entityRef));
    assertTrue(exception.getMessage().contains("status"));
  }

  private EntityStatus getContractStatus(
      ODCSDataContract.OdcsStatus odcsStatus, EntityReference entityRef) {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(odcsStatus);

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);
    return contract.getEntityStatus();
  }

  @Test
  void testToODCS_WithNullValues() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("null_test_contract");

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());
    assertEquals("null_test_contract", odcs.getName());
    assertNotNull(odcs.getVersion()); // Version comes from DataContract default version
    assertEquals(ODCSDataContract.OdcsStatus.DRAFT, odcs.getStatus()); // Default when null
  }

  @Test
  void testFromODCS_GeneratesContractName() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);
    // Note: name is not set

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("my_table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    assertNotNull(contract.getName());
    assertEquals("my_table_contract", contract.getName());
  }

  @Test
  void testToODCS_WithDescription() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("description_test");
    contract.setDescription("This is a detailed description of the contract.");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs.getDescription());
    assertEquals(
        "This is a detailed description of the contract.", odcs.getDescription().getPurpose());
  }

  @Test
  void testSmartMerge_PreservesExistingFields() {
    DataContract existing = new DataContract();
    existing.setId(UUID.randomUUID());
    existing.setName("existing_contract");
    existing.setFullyQualifiedName("service.db.schema.table.existing_contract");
    existing.setDescription("Existing description");
    existing.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    existing.setEntity(entity);

    List<Column> existingColumns = new ArrayList<>();
    existingColumns.add(new Column().withName("id").withDataType(ColumnDataType.INT));
    existing.setSchema(existingColumns);

    ContractSLA existingSla = new ContractSLA();
    Retention retention = new Retention();
    retention.setPeriod(90);
    retention.setUnit(Retention.Unit.DAY);
    existingSla.setRetention(retention);
    existing.setSla(existingSla);

    DataContract imported = new DataContract();
    imported.setName("imported_contract");
    imported.setDescription("Imported description");
    imported.setEntityStatus(EntityStatus.DRAFT);

    DataContract merged = ODCSConverter.smartMerge(existing, imported);

    assertEquals(existing.getId(), merged.getId());
    assertEquals(existing.getFullyQualifiedName(), merged.getFullyQualifiedName());
    assertEquals(
        "existing_contract",
        merged.getName()); // smartMerge preserves existing name for FQN integrity
    assertEquals("Imported description", merged.getDescription());
    assertEquals(EntityStatus.DRAFT, merged.getEntityStatus());
    assertEquals(existing.getEntity(), merged.getEntity());
    assertEquals(existing.getSchema(), merged.getSchema());
    assertNotNull(merged.getSla());
    assertEquals(90, merged.getSla().getRetention().getPeriod());
  }

  @Test
  void testSmartMerge_OverridesWithImportedFields() {
    DataContract existing = new DataContract();
    existing.setId(UUID.randomUUID());
    existing.setName("existing_contract");
    existing.setDescription("Existing description");
    existing.setEntityStatus(EntityStatus.DRAFT);

    ContractSLA existingSla = new ContractSLA();
    RefreshFrequency rf = new RefreshFrequency();
    rf.setInterval(1);
    rf.setUnit(RefreshFrequency.Unit.DAY);
    existingSla.setRefreshFrequency(rf);
    existing.setSla(existingSla);

    DataContract imported = new DataContract();
    imported.setName("imported_contract");
    imported.setEntityStatus(EntityStatus.APPROVED);

    ContractSLA importedSla = new ContractSLA();
    RefreshFrequency newRf = new RefreshFrequency();
    newRf.setInterval(6);
    newRf.setUnit(RefreshFrequency.Unit.HOUR);
    importedSla.setRefreshFrequency(newRf);
    imported.setSla(importedSla);

    List<Column> newSchema = new ArrayList<>();
    newSchema.add(new Column().withName("new_col").withDataType(ColumnDataType.STRING));
    imported.setSchema(newSchema);

    DataContract merged = ODCSConverter.smartMerge(existing, imported);

    assertEquals(
        "existing_contract",
        merged.getName()); // smartMerge preserves existing name for FQN integrity
    assertEquals(EntityStatus.APPROVED, merged.getEntityStatus());
    assertEquals(1, merged.getSchema().size());
    assertEquals("new_col", merged.getSchema().get(0).getName());
    assertEquals(6, merged.getSla().getRefreshFrequency().getInterval());
    assertEquals(RefreshFrequency.Unit.HOUR, merged.getSla().getRefreshFrequency().getUnit());
  }

  @Test
  void testSmartMerge_NullExistingReturnsImported() {
    DataContract imported = new DataContract();
    imported.setName("imported_contract");

    DataContract merged = ODCSConverter.smartMerge(null, imported);

    assertEquals(imported, merged);
  }

  @Test
  void testSmartMerge_NullImportedReturnsExisting() {
    DataContract existing = new DataContract();
    existing.setName("existing_contract");

    DataContract merged = ODCSConverter.smartMerge(existing, null);

    assertEquals(existing, merged);
  }

  @Test
  void testFromODCS_WithFullDescription() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("desc_test");
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Main purpose of the data.");
    desc.setLimitations("Some limitations apply.");
    desc.setUsage("Use responsibly.");
    odcs.setDescription(desc);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getDescription());
    assertTrue(contract.getDescription().contains("Main purpose of the data."));
    assertTrue(contract.getDescription().contains("Limitations"));
    assertTrue(contract.getDescription().contains("Some limitations apply."));
    assertTrue(contract.getDescription().contains("Usage"));
    assertTrue(contract.getDescription().contains("Use responsibly."));
  }

  @Test
  void testToODCS_WithSecurity() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("security_contract");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ContractSecurity security = new ContractSecurity();
    security.setDataClassification("PII");

    List<Policy> policies = new ArrayList<>();
    Policy policy1 = new Policy();
    policy1.setAccessPolicy("data-analyst");
    policy1.setIdentities(List.of("user1@example.com", "user2@example.com"));
    policies.add(policy1);

    Policy policy2 = new Policy();
    policy2.setAccessPolicy("data-engineer");
    policy2.setIdentities(List.of("eng-team@example.com"));
    policies.add(policy2);

    security.setPolicies(policies);
    contract.setSecurity(security);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs);
    assertNotNull(odcs.getRoles());
    assertEquals(3, odcs.getRoles().size());

    boolean hasAnalystRole =
        odcs.getRoles().stream()
            .anyMatch(
                r ->
                    "data-analyst".equals(r.getRole())
                        && r.getFirstLevelApprovers() != null
                        && r.getFirstLevelApprovers().contains("user1@example.com"));
    assertTrue(hasAnalystRole);

    boolean hasEngineerRole =
        odcs.getRoles().stream()
            .anyMatch(
                r ->
                    "data-engineer".equals(r.getRole())
                        && r.getFirstLevelApprovers() != null
                        && r.getFirstLevelApprovers().contains("eng-team@example.com"));
    assertTrue(hasEngineerRole);

    boolean hasClassificationRole =
        odcs.getRoles().stream().anyMatch(r -> "classification-PII".equals(r.getRole()));
    assertTrue(hasClassificationRole);
  }

  @Test
  void testFromODCS_WithRoles() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("roles_test");
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSRole> roles = new ArrayList<>();

    ODCSRole consumerRole = new ODCSRole();
    consumerRole.setRole("data-consumer");
    consumerRole.setAccess(ODCSRole.Access.READ);
    consumerRole.setFirstLevelApprovers(List.of("approver1@example.com", "approver2@example.com"));
    roles.add(consumerRole);

    ODCSRole classificationRole = new ODCSRole();
    classificationRole.setRole("classification-Confidential");
    classificationRole.setDescription("Data classification: Confidential");
    roles.add(classificationRole);

    odcs.setRoles(roles);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    assertNotNull(contract.getSecurity());
    assertEquals("Confidential", contract.getSecurity().getDataClassification());
    assertNotNull(contract.getSecurity().getPolicies());
    assertEquals(1, contract.getSecurity().getPolicies().size());
    assertEquals("data-consumer", contract.getSecurity().getPolicies().get(0).getAccessPolicy());
    assertTrue(
        contract
            .getSecurity()
            .getPolicies()
            .get(0)
            .getIdentities()
            .contains("approver1@example.com"));
  }

  @Test
  void testToODCS_SLAWithFreshnessMapping() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("freshness_test");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ContractSLA sla = new ContractSLA();
    RefreshFrequency rf = new RefreshFrequency();
    rf.setInterval(24);
    rf.setUnit(RefreshFrequency.Unit.HOUR);
    sla.setRefreshFrequency(rf);
    contract.setSla(sla);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs.getSlaProperties());
    assertEquals(1, odcs.getSlaProperties().size());

    ODCSSlaProperty freshnessProperty = odcs.getSlaProperties().get(0);
    assertEquals("freshness", freshnessProperty.getProperty());
    assertEquals("24", freshnessProperty.getValue());
    assertEquals("hour", freshnessProperty.getUnit());
  }

  @Test
  void testToODCS_SLAWithLatencyMapping() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("latency_test");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ContractSLA sla = new ContractSLA();
    MaxLatency ml = new MaxLatency();
    ml.setValue(30);
    ml.setUnit(MaxLatency.Unit.MINUTE);
    sla.setMaxLatency(ml);
    contract.setSla(sla);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs.getSlaProperties());
    assertEquals(1, odcs.getSlaProperties().size());

    ODCSSlaProperty latencyProperty = odcs.getSlaProperties().get(0);
    assertEquals("latency", latencyProperty.getProperty());
    assertEquals("30", latencyProperty.getValue());
    assertEquals("minute", latencyProperty.getUnit());
  }

  @Test
  void testFromODCS_SLAWithFreshnessMapping() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSlaProperty> slaProperties = new ArrayList<>();
    ODCSSlaProperty freshness = new ODCSSlaProperty();
    freshness.setProperty("freshness");
    freshness.setValue("12");
    freshness.setUnit("hour");
    slaProperties.add(freshness);
    odcs.setSlaProperties(slaProperties);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSla());
    assertNotNull(contract.getSla().getRefreshFrequency());
    assertEquals(12, contract.getSla().getRefreshFrequency().getInterval());
    assertEquals(RefreshFrequency.Unit.HOUR, contract.getSla().getRefreshFrequency().getUnit());
  }

  @Test
  void testFromODCS_SLAWithLatencyMapping() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSlaProperty> slaProperties = new ArrayList<>();
    ODCSSlaProperty latency = new ODCSSlaProperty();
    latency.setProperty("latency");
    latency.setValue("5");
    latency.setUnit("minute");
    slaProperties.add(latency);
    odcs.setSlaProperties(slaProperties);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSla());
    assertNotNull(contract.getSla().getMaxLatency());
    assertEquals(5, contract.getSla().getMaxLatency().getValue());
    assertEquals(MaxLatency.Unit.MINUTE, contract.getSla().getMaxLatency().getUnit());
  }

  @Test
  void testToODCS_SLAWithTimezone() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("timezone_test");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    ContractSLA sla = new ContractSLA();
    sla.setTimezone(ContractSLA.Timezone.GMT_05_00_AMERICA_NEW_YORK);
    sla.setAvailabilityTime("09:00");
    contract.setSla(sla);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs.getSlaProperties());
    boolean hasTimezone =
        odcs.getSlaProperties().stream()
            .anyMatch(
                p ->
                    "availabilityTime".equals(p.getProperty())
                        && p.getValueExt() != null
                        && p.getValueExt().contains("America"));
    assertTrue(hasTimezone);
  }

  @Test
  void testFromODCS_SLAWithTimezone() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSlaProperty> slaProperties = new ArrayList<>();
    ODCSSlaProperty availability = new ODCSSlaProperty();
    availability.setProperty("availabilityTime");
    availability.setValue("10:00");
    availability.setValueExt("GMT+00:00 (Europe/London)");
    slaProperties.add(availability);
    odcs.setSlaProperties(slaProperties);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSla());
    assertEquals("10:00", contract.getSla().getAvailabilityTime());
    assertEquals(ContractSLA.Timezone.GMT_00_00_EUROPE_LONDON, contract.getSla().getTimezone());
  }

  @Test
  void testRoundTrip_WithSecurityAndSLA() {
    DataContract original = new DataContract();
    original.setId(UUID.randomUUID());
    original.setName("full_roundtrip_contract");
    original.setDescription("Comprehensive round trip test");
    original.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setFullyQualifiedName("db.schema.table");
    original.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("id")
            .withDataType(ColumnDataType.INT)
            .withConstraint(ColumnConstraint.PRIMARY_KEY));
    columns.add(new Column().withName("name").withDataType(ColumnDataType.STRING));
    columns.add(new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP));
    original.setSchema(columns);

    ContractSLA sla = new ContractSLA();
    RefreshFrequency rf = new RefreshFrequency();
    rf.setInterval(6);
    rf.setUnit(RefreshFrequency.Unit.HOUR);
    sla.setRefreshFrequency(rf);

    MaxLatency ml = new MaxLatency();
    ml.setValue(15);
    ml.setUnit(MaxLatency.Unit.MINUTE);
    sla.setMaxLatency(ml);

    Retention retention = new Retention();
    retention.setPeriod(365);
    retention.setUnit(Retention.Unit.DAY);
    sla.setRetention(retention);

    sla.setAvailabilityTime("08:00");
    sla.setTimezone(ContractSLA.Timezone.GMT_00_00_EUROPE_LONDON);
    original.setSla(sla);

    ContractSecurity security = new ContractSecurity();
    security.setDataClassification("Sensitive");
    List<Policy> policies = new ArrayList<>();
    Policy policy = new Policy();
    policy.setAccessPolicy("data-scientist");
    policy.setIdentities(List.of("team@example.com"));
    policies.add(policy);
    security.setPolicies(policies);
    original.setSecurity(security);

    ODCSDataContract odcs = ODCSConverter.toODCS(original);

    EntityReference newEntityRef = new EntityReference();
    newEntityRef.setId(UUID.randomUUID());
    newEntityRef.setType("table");

    DataContract converted = ODCSConverter.fromODCS(odcs, newEntityRef);

    assertEquals(original.getName(), converted.getName());
    assertEquals(original.getEntityStatus(), converted.getEntityStatus());
    assertEquals(original.getSchema().size(), converted.getSchema().size());
    assertEquals(original.getSchema().get(0).getName(), converted.getSchema().get(0).getName());
    assertEquals(ColumnConstraint.PRIMARY_KEY, converted.getSchema().get(0).getConstraint());
    assertEquals(ColumnDataType.TIMESTAMP, converted.getSchema().get(2).getDataType());

    assertEquals(
        original.getSla().getRefreshFrequency().getInterval(),
        converted.getSla().getRefreshFrequency().getInterval());
    assertEquals(
        original.getSla().getMaxLatency().getValue(),
        converted.getSla().getMaxLatency().getValue());
    assertEquals(
        original.getSla().getRetention().getPeriod(),
        converted.getSla().getRetention().getPeriod());
    assertEquals(original.getSla().getAvailabilityTime(), converted.getSla().getAvailabilityTime());
    assertEquals(original.getSla().getTimezone(), converted.getSla().getTimezone());

    assertEquals(
        original.getSecurity().getDataClassification(),
        converted.getSecurity().getDataClassification());
    assertEquals(1, converted.getSecurity().getPolicies().size());
    assertEquals("data-scientist", converted.getSecurity().getPolicies().get(0).getAccessPolicy());
  }

  @Test
  void testSmartMerge_PreservesSecurity() {
    DataContract existing = new DataContract();
    existing.setId(UUID.randomUUID());
    existing.setName("existing_contract");

    ContractSecurity existingSecurity = new ContractSecurity();
    existingSecurity.setDataClassification("PII");
    List<Policy> existingPolicies = new ArrayList<>();
    Policy existingPolicy = new Policy();
    existingPolicy.setAccessPolicy("existing-policy");
    existingPolicies.add(existingPolicy);
    existingSecurity.setPolicies(existingPolicies);
    existing.setSecurity(existingSecurity);

    DataContract imported = new DataContract();
    imported.setName("imported_contract");

    DataContract merged = ODCSConverter.smartMerge(existing, imported);

    assertNotNull(merged.getSecurity());
    assertEquals("PII", merged.getSecurity().getDataClassification());
  }

  @Test
  void testSmartMerge_OverridesSecurity() {
    DataContract existing = new DataContract();
    existing.setId(UUID.randomUUID());
    existing.setName("existing_contract");

    ContractSecurity existingSecurity = new ContractSecurity();
    existingSecurity.setDataClassification("Public");
    existing.setSecurity(existingSecurity);

    DataContract imported = new DataContract();
    imported.setName("imported_contract");

    ContractSecurity importedSecurity = new ContractSecurity();
    importedSecurity.setDataClassification("Confidential");
    List<Policy> importedPolicies = new ArrayList<>();
    Policy importedPolicy = new Policy();
    importedPolicy.setAccessPolicy("new-policy");
    importedPolicies.add(importedPolicy);
    importedSecurity.setPolicies(importedPolicies);
    imported.setSecurity(importedSecurity);

    DataContract merged = ODCSConverter.smartMerge(existing, imported);

    assertNotNull(merged.getSecurity());
    assertEquals("Confidential", merged.getSecurity().getDataClassification());
    assertEquals(1, merged.getSecurity().getPolicies().size());
    assertEquals("new-policy", merged.getSecurity().getPolicies().get(0).getAccessPolicy());
  }

  @Test
  void testFromODCS_WithQualityRules() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("quality_test");
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSQualityRule> qualityRules = new ArrayList<>();

    ODCSQualityRule rule1 = new ODCSQualityRule();
    rule1.setType(ODCSQualityRule.Type.LIBRARY);
    rule1.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    rule1.setColumn("email");
    rule1.setName("email_not_null_check");
    rule1.setDescription("Ensure email column has no null values");
    qualityRules.add(rule1);

    ODCSQualityRule rule2 = new ODCSQualityRule();
    rule2.setType(ODCSQualityRule.Type.LIBRARY);
    rule2.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    rule2.setName("row_count_check");
    qualityRules.add(rule2);

    ODCSQualityRule rule3 = new ODCSQualityRule();
    rule3.setType(ODCSQualityRule.Type.SQL);
    rule3.setQuery("SELECT COUNT(*) FROM table WHERE status = 'active'");
    rule3.setName("active_records_check");
    qualityRules.add(rule3);

    odcs.setQuality(qualityRules);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract);
    assertNotNull(contract.getOdcsQualityRules());
    assertEquals(3, contract.getOdcsQualityRules().size());
    assertEquals("email_not_null_check", contract.getOdcsQualityRules().get(0).getName());
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.NULL_VALUES,
        contract.getOdcsQualityRules().get(0).getMetric());
    assertEquals("email", contract.getOdcsQualityRules().get(0).getColumn());
  }

  @Test
  void testToODCS_WithQualityRules() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("quality_export_test");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    contract.setEntity(entity);

    List<ODCSQualityRule> qualityRules = new ArrayList<>();

    ODCSQualityRule rule1 = new ODCSQualityRule();
    rule1.setType(ODCSQualityRule.Type.LIBRARY);
    rule1.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    rule1.setColumn("user_id");
    rule1.setName("user_id_not_null");
    qualityRules.add(rule1);

    ODCSQualityRule rule2 = new ODCSQualityRule();
    rule2.setType(ODCSQualityRule.Type.LIBRARY);
    rule2.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    rule2.setName("minimum_rows");
    qualityRules.add(rule2);

    contract.setOdcsQualityRules(qualityRules);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs);
    assertNotNull(odcs.getQuality());
    assertEquals(2, odcs.getQuality().size());

    ODCSQualityRule exportedRule1 = odcs.getQuality().get(0);
    assertEquals(ODCSQualityRule.Type.LIBRARY, exportedRule1.getType());
    assertEquals(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, exportedRule1.getMetric());
    assertEquals("user_id", exportedRule1.getColumn());
    assertEquals("user_id_not_null", exportedRule1.getName());

    ODCSQualityRule exportedRule2 = odcs.getQuality().get(1);
    assertEquals(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT, exportedRule2.getMetric());
  }

  @Test
  void testQualityRules_RoundTrip() {
    ODCSDataContract original = new ODCSDataContract();
    original.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    original.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    original.setId(UUID.randomUUID().toString());
    original.setName("quality_roundtrip_test");
    original.setVersion("1.0.0");
    original.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSQualityRule> qualityRules = new ArrayList<>();

    ODCSQualityRule rule = new ODCSQualityRule();
    rule.setType(ODCSQualityRule.Type.LIBRARY);
    rule.setMetric(ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES);
    rule.setColumn("id");
    rule.setName("id_uniqueness");
    rule.setDescription("ID must be unique");
    rule.setDimension(ODCSQualityRule.Dimension.UNIQUENESS);
    rule.setScheduler("cron");
    rule.setSchedule("0 0 * * *");
    qualityRules.add(rule);

    original.setQuality(qualityRules);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(original, entityRef);
    ODCSDataContract exported = ODCSConverter.toODCS(contract);

    assertNotNull(exported.getQuality());
    assertEquals(1, exported.getQuality().size());

    ODCSQualityRule exportedRule = exported.getQuality().get(0);
    assertEquals(ODCSQualityRule.Type.LIBRARY, exportedRule.getType());
    assertEquals(ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES, exportedRule.getMetric());
    assertEquals("id", exportedRule.getColumn());
    assertEquals("id_uniqueness", exportedRule.getName());
    assertEquals("ID must be unique", exportedRule.getDescription());
    assertEquals(ODCSQualityRule.Dimension.UNIQUENESS, exportedRule.getDimension());
    assertEquals("cron", exportedRule.getScheduler());
    assertEquals("0 0 * * *", exportedRule.getSchedule());
  }

  @Test
  void testMapODCSMetricToTestDefinition() {
    assertEquals(
        "columnValuesToBeNotNull",
        ODCSConverter.mapODCSMetricToTestDefinition(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES));
    assertEquals(
        "tableRowCountToEqual",
        ODCSConverter.mapODCSMetricToTestDefinition(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT));
    assertEquals(
        "columnValuesToBeUnique",
        ODCSConverter.mapODCSMetricToTestDefinition(
            ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES));
    assertNull(
        ODCSConverter.mapODCSMetricToTestDefinition(
            ODCSQualityRule.OdcsQualityMetric.DUPLICATE_VALUES));
    assertNull(
        ODCSConverter.mapODCSMetricToTestDefinition(
            ODCSQualityRule.OdcsQualityMetric.DISTINCT_VALUES));
    assertNull(
        ODCSConverter.mapODCSMetricToTestDefinition(ODCSQualityRule.OdcsQualityMetric.FRESHNESS));
    assertEquals(
        "columnValuesMissingCountToBeEqual",
        ODCSConverter.mapODCSMetricToTestDefinition(
            ODCSQualityRule.OdcsQualityMetric.MISSING_VALUES));
    assertNull(
        ODCSConverter.mapODCSMetricToTestDefinition(
            ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES));
  }

  @Test
  void testMapTestDefinitionToODCSMetric() {
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.NULL_VALUES,
        ODCSConverter.mapTestDefinitionToODCSMetric("columnValuesToBeNotNull"));
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.ROW_COUNT,
        ODCSConverter.mapTestDefinitionToODCSMetric("tableRowCountToEqual"));
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.ROW_COUNT,
        ODCSConverter.mapTestDefinitionToODCSMetric("tableRowCountToBeBetween"));
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES,
        ODCSConverter.mapTestDefinitionToODCSMetric("columnValuesToBeUnique"));
  }

  @Test
  void testSmartMerge_PreservesExtension() {
    DataContract existing = new DataContract();
    existing.setId(UUID.randomUUID());
    existing.setName("existing_contract");

    Map<String, Object> existingExtension =
        Map.of("odcsQualityRules", List.of(Map.of("name", "existing_rule")));
    existing.setExtension(existingExtension);

    DataContract imported = new DataContract();
    imported.setName("imported_contract");

    DataContract merged = ODCSConverter.smartMerge(existing, imported);

    assertNotNull(merged.getExtension());
    @SuppressWarnings("unchecked")
    Map<String, Object> mergedExtension = (Map<String, Object>) merged.getExtension();
    assertTrue(mergedExtension.containsKey("odcsQualityRules"));
  }

  @Test
  void testSmartMerge_OverridesExtension() {
    DataContract existing = new DataContract();
    existing.setId(UUID.randomUUID());
    existing.setName("existing_contract");

    Map<String, Object> existingExtension =
        Map.of("odcsQualityRules", List.of(Map.of("name", "old_rule")));
    existing.setExtension(existingExtension);

    DataContract imported = new DataContract();
    imported.setName("imported_contract");

    Map<String, Object> importedExtension =
        Map.of("odcsQualityRules", List.of(Map.of("name", "new_rule")));
    imported.setExtension(importedExtension);

    DataContract merged = ODCSConverter.smartMerge(existing, imported);

    assertNotNull(merged.getExtension());
    @SuppressWarnings("unchecked")
    Map<String, Object> mergedExtension = (Map<String, Object>) merged.getExtension();
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> rules =
        (List<Map<String, Object>>) mergedExtension.get("odcsQualityRules");
    assertEquals("new_rule", rules.get(0).get("name"));
  }

  @Test
  void testGetSchemaObjectNames_SingleObject() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("orders");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    tableObject.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    schema.add(tableObject);
    odcs.setSchema(schema);

    List<String> objectNames = ODCSConverter.getSchemaObjectNames(odcs);

    assertEquals(1, objectNames.size());
    assertEquals("orders", objectNames.get(0));
    assertFalse(ODCSConverter.hasMultipleSchemaObjects(odcs));
  }

  @Test
  void testGetSchemaObjectNames_MultipleObjects() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement ordersTable = new ODCSSchemaElement();
    ordersTable.setName("orders");
    ordersTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    ordersTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("order_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    schema.add(ordersTable);

    ODCSSchemaElement customersTable = new ODCSSchemaElement();
    customersTable.setName("customers");
    customersTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    customersTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("customer_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    schema.add(customersTable);

    ODCSSchemaElement productsTable = new ODCSSchemaElement();
    productsTable.setName("products");
    productsTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    productsTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("product_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    schema.add(productsTable);

    odcs.setSchema(schema);

    List<String> objectNames = ODCSConverter.getSchemaObjectNames(odcs);

    assertEquals(3, objectNames.size());
    assertTrue(objectNames.contains("orders"));
    assertTrue(objectNames.contains("customers"));
    assertTrue(objectNames.contains("products"));
    assertTrue(ODCSConverter.hasMultipleSchemaObjects(odcs));
  }

  @Test
  void testFromODCS_MultiObjectWithEntityNameMatch() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement ordersTable = new ODCSSchemaElement();
    ordersTable.setName("orders");
    ordersTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    ordersTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("order_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER),
            new ODCSSchemaElement()
                .withName("amount")
                .withLogicalType(ODCSSchemaElement.LogicalType.DECIMAL)));
    schema.add(ordersTable);

    ODCSSchemaElement customersTable = new ODCSSchemaElement();
    customersTable.setName("customers");
    customersTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    customersTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("customer_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER),
            new ODCSSchemaElement()
                .withName("email")
                .withLogicalType(ODCSSchemaElement.LogicalType.STRING)));
    schema.add(customersTable);

    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("customers"); // Entity name matches one of the objects

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(2, contract.getSchema().size());
    assertEquals("customer_id", contract.getSchema().get(0).getName());
    assertEquals("email", contract.getSchema().get(1).getName());
  }

  @Test
  void testFromODCS_MultiObjectWithExplicitObjectName() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement ordersTable = new ODCSSchemaElement();
    ordersTable.setName("orders");
    ordersTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    ordersTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("order_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    schema.add(ordersTable);

    ODCSSchemaElement customersTable = new ODCSSchemaElement();
    customersTable.setName("customers");
    customersTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    customersTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("customer_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    schema.add(customersTable);

    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("some_other_table"); // Does not match any object

    // Explicitly specify orders as the object to import
    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef, "orders");

    assertNotNull(contract.getSchema());
    assertEquals(1, contract.getSchema().size());
    assertEquals("order_id", contract.getSchema().get(0).getName());
  }

  @Test
  void testFromODCS_MultiObjectWithInvalidObjectName() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement ordersTable = new ODCSSchemaElement();
    ordersTable.setName("orders");
    ordersTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    ordersTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("order_id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    schema.add(ordersTable);

    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> ODCSConverter.fromODCS(odcs, entityRef, "nonexistent_table"));
    assertTrue(exception.getMessage().contains("not found"));
    assertTrue(exception.getMessage().contains("orders"));
  }

  @Test
  void testFromODCS_MultiObjectUsesFirstWhenNoMatch() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement firstTable = new ODCSSchemaElement();
    firstTable.setName("first_table");
    firstTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    firstTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("first_col")
                .withLogicalType(ODCSSchemaElement.LogicalType.STRING)));
    schema.add(firstTable);

    ODCSSchemaElement secondTable = new ODCSSchemaElement();
    secondTable.setName("second_table");
    secondTable.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
    secondTable.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("second_col")
                .withLogicalType(ODCSSchemaElement.LogicalType.STRING)));
    schema.add(secondTable);

    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("unrelated_table"); // No match

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(1, contract.getSchema().size());
    assertEquals("first_col", contract.getSchema().get(0).getName()); // Uses first object
  }

  @Test
  void testFromODCS_LegacyFlatSchema() {
    // Test that legacy contracts without object wrappers still work
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();
    schema.add(
        new ODCSSchemaElement()
            .withName("id")
            .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER));
    schema.add(
        new ODCSSchemaElement()
            .withName("name")
            .withLogicalType(ODCSSchemaElement.LogicalType.STRING));
    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(2, contract.getSchema().size());
    assertEquals("id", contract.getSchema().get(0).getName());
    assertEquals("name", contract.getSchema().get(1).getName());
  }

  @Test
  void testRoundTrip_WithMultiObjectAwareness() {
    DataContract original = new DataContract();
    original.setId(UUID.randomUUID());
    original.setName("roundtrip_multi_test");
    original.setDescription("Multi-object aware round trip");
    original.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setName("test_table");
    entity.setFullyQualifiedName("db.schema.test_table");
    original.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    columns.add(new Column().withName("col1").withDataType(ColumnDataType.INT));
    columns.add(new Column().withName("col2").withDataType(ColumnDataType.STRING));
    original.setSchema(columns);

    // Export to ODCS
    ODCSDataContract odcs = ODCSConverter.toODCS(original);

    // Verify wrapped structure
    assertEquals(1, odcs.getSchema().size());
    assertEquals("test_table", odcs.getSchema().get(0).getName());
    assertEquals(2, odcs.getSchema().get(0).getProperties().size());

    // Import back
    EntityReference newEntityRef = new EntityReference();
    newEntityRef.setId(UUID.randomUUID());
    newEntityRef.setType("table");
    newEntityRef.setName("test_table");

    DataContract converted = ODCSConverter.fromODCS(odcs, newEntityRef);

    // Verify columns are correctly extracted
    assertEquals(original.getName(), converted.getName());
    assertEquals(original.getSchema().size(), converted.getSchema().size());
    assertEquals("col1", converted.getSchema().get(0).getName());
    assertEquals("col2", converted.getSchema().get(1).getName());
  }

  @Test
  void testFromODCS_WithElementLevelQuality() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("orders");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    ODCSQualityRule tableRule = new ODCSQualityRule();
    tableRule.setType(ODCSQualityRule.Type.LIBRARY);
    tableRule.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    tableRule.setMustBeGreaterThan(0.0);
    tableObject.setQuality(List.of(tableRule));

    tableObject.setProperties(
        List.of(
            new ODCSSchemaElement()
                .withName("id")
                .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER)));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("orders");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getOdcsQualityRules());
    assertEquals(1, contract.getOdcsQualityRules().size());
    assertEquals("orders", contract.getOdcsQualityRules().get(0).getColumn());
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.ROW_COUNT,
        contract.getOdcsQualityRules().get(0).getMetric());
  }

  @Test
  void testFromODCS_WithPropertyLevelQuality() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("orders");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    ODCSSchemaElement emailProperty = new ODCSSchemaElement();
    emailProperty.setName("email");
    emailProperty.setLogicalType(ODCSSchemaElement.LogicalType.STRING);

    ODCSQualityRule propRule = new ODCSQualityRule();
    propRule.setType(ODCSQualityRule.Type.SQL);
    propRule.setQuery("SELECT COUNT(*) FROM ${table} WHERE ${column} NOT LIKE '%@%'");
    propRule.setMustBe(0.0);
    emailProperty.setQuality(List.of(propRule));

    tableObject.setProperties(List.of(emailProperty));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("orders");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getOdcsQualityRules());
    assertEquals(1, contract.getOdcsQualityRules().size());
    assertEquals("email", contract.getOdcsQualityRules().get(0).getColumn());
    assertEquals(ODCSQualityRule.Type.SQL, contract.getOdcsQualityRules().get(0).getType());
  }

  @Test
  void testFromODCS_MergesTopLevelAndElementLevelQuality() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSQualityRule topLevelRule = new ODCSQualityRule();
    topLevelRule.setType(ODCSQualityRule.Type.LIBRARY);
    topLevelRule.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    topLevelRule.setName("row_count_check");
    odcs.setQuality(List.of(topLevelRule));

    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName("orders");
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    ODCSSchemaElement emailProperty = new ODCSSchemaElement();
    emailProperty.setName("email");
    emailProperty.setLogicalType(ODCSSchemaElement.LogicalType.STRING);

    ODCSQualityRule propRule = new ODCSQualityRule();
    propRule.setType(ODCSQualityRule.Type.LIBRARY);
    propRule.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    propRule.setName("email_not_null");
    emailProperty.setQuality(List.of(propRule));

    tableObject.setProperties(List.of(emailProperty));
    odcs.setSchema(List.of(tableObject));

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");
    entityRef.setName("orders");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getOdcsQualityRules());
    assertEquals(2, contract.getOdcsQualityRules().size());
    assertEquals("row_count_check", contract.getOdcsQualityRules().get(0).getName());
    assertEquals("email_not_null", contract.getOdcsQualityRules().get(1).getName());
    assertEquals("email", contract.getOdcsQualityRules().get(1).getColumn());
  }

  @Test
  void testRoundTrip_ElementLevelQuality() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("quality_roundtrip");
    contract.setEntityStatus(EntityStatus.APPROVED);

    EntityReference entity = new EntityReference();
    entity.setId(UUID.randomUUID());
    entity.setType("table");
    entity.setName("orders");
    contract.setEntity(entity);

    List<Column> columns = new ArrayList<>();
    columns.add(new Column().withName("email").withDataType(ColumnDataType.STRING));
    contract.setSchema(columns);

    List<ODCSQualityRule> qualityRules = new ArrayList<>();

    ODCSQualityRule topRule = new ODCSQualityRule();
    topRule.setType(ODCSQualityRule.Type.LIBRARY);
    topRule.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    topRule.setName("row_count");
    qualityRules.add(topRule);

    ODCSQualityRule colRule = new ODCSQualityRule();
    colRule.setType(ODCSQualityRule.Type.LIBRARY);
    colRule.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    colRule.setColumn("email");
    colRule.setName("email_not_null");
    qualityRules.add(colRule);

    contract.setOdcsQualityRules(qualityRules);

    ODCSDataContract odcs = ODCSConverter.toODCS(contract);

    assertNotNull(odcs.getQuality());
    assertEquals(1, odcs.getQuality().size());
    assertEquals("row_count", odcs.getQuality().get(0).getName());

    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    ODCSSchemaElement emailProp = tableObject.getProperties().get(0);
    assertNotNull(emailProp.getQuality());
    assertEquals(1, emailProp.getQuality().size());
    assertEquals("email_not_null", emailProp.getQuality().get(0).getName());

    EntityReference newEntityRef = new EntityReference();
    newEntityRef.setId(UUID.randomUUID());
    newEntityRef.setType("table");
    newEntityRef.setName("orders");

    DataContract reimported = ODCSConverter.fromODCS(odcs, newEntityRef);
    assertNotNull(reimported.getOdcsQualityRules());
    assertEquals(2, reimported.getOdcsQualityRules().size());
  }

  @Test
  void testNormalizeODCSInput_TeamAsObject() {
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode root = mapper.createObjectNode();
    root.put("apiVersion", "v3.1.0");
    root.put("kind", "DataContract");
    root.put("id", UUID.randomUUID().toString());
    root.put("version", "1.0");
    root.put("status", "active");

    ObjectNode teamObj = mapper.createObjectNode();
    ArrayNode membersArray = mapper.createArrayNode();
    ObjectNode member = mapper.createObjectNode();
    member.put("username", "alice");
    member.put("role", "owner");
    membersArray.add(member);
    teamObj.set("members", membersArray);
    root.set("team", teamObj);

    ODCSConverter.normalizeODCSInput(root);

    JsonNode teamNode = root.get("team");
    assertTrue(teamNode.isArray());
    assertEquals(1, teamNode.size());
    assertEquals("alice", teamNode.get(0).get("username").asText());
  }

  @Test
  void testNormalizeODCSInput_TeamAsArray() {
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode root = mapper.createObjectNode();
    root.put("apiVersion", "v3.1.0");

    ArrayNode teamArray = mapper.createArrayNode();
    ObjectNode member = mapper.createObjectNode();
    member.put("username", "bob");
    member.put("role", "owner");
    teamArray.add(member);
    root.set("team", teamArray);

    ODCSConverter.normalizeODCSInput(root);

    JsonNode teamNode = root.get("team");
    assertTrue(teamNode.isArray());
    assertEquals(1, teamNode.size());
    assertEquals("bob", teamNode.get(0).get("username").asText());
  }

  @Test
  void testNormalizeODCSInput_ApproversAsString() {
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode root = mapper.createObjectNode();

    ArrayNode rolesArray = mapper.createArrayNode();
    ObjectNode role = mapper.createObjectNode();
    role.put("role", "analyst");
    role.put("access", "read");
    role.put("firstLevelApprovers", "manager@company.com");
    role.put("secondLevelApprovers", "director@company.com");
    rolesArray.add(role);
    root.set("roles", rolesArray);

    ODCSConverter.normalizeODCSInput(root);

    JsonNode firstApprovers = root.get("roles").get(0).get("firstLevelApprovers");
    assertTrue(firstApprovers.isArray());
    assertEquals(1, firstApprovers.size());
    assertEquals("manager@company.com", firstApprovers.get(0).asText());

    JsonNode secondApprovers = root.get("roles").get(0).get("secondLevelApprovers");
    assertTrue(secondApprovers.isArray());
    assertEquals(1, secondApprovers.size());
    assertEquals("director@company.com", secondApprovers.get(0).asText());
  }

  @Test
  void testNormalizeODCSInput_ApproversAsArray() {
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode root = mapper.createObjectNode();

    ArrayNode rolesArray = mapper.createArrayNode();
    ObjectNode role = mapper.createObjectNode();
    role.put("role", "analyst");
    ArrayNode approvers = mapper.createArrayNode();
    approvers.add("approver1@company.com");
    approvers.add("approver2@company.com");
    role.set("firstLevelApprovers", approvers);
    rolesArray.add(role);
    root.set("roles", rolesArray);

    ODCSConverter.normalizeODCSInput(root);

    JsonNode firstApprovers = root.get("roles").get(0).get("firstLevelApprovers");
    assertTrue(firstApprovers.isArray());
    assertEquals(2, firstApprovers.size());
    assertEquals("approver1@company.com", firstApprovers.get(0).asText());
    assertEquals("approver2@company.com", firstApprovers.get(1).asText());
  }

  @Test
  void testNormalizeODCSInput_NullInput() {
    ODCSConverter.normalizeODCSInput(null);
  }

  @Test
  void testMapTestDefinitionToODCSMetric_MissingValues() {
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.MISSING_VALUES,
        ODCSConverter.mapTestDefinitionToODCSMetric("columnValuesMissingCountToBeEqual"));
  }
}

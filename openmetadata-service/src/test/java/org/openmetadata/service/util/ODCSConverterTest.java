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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
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
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_0_2, odcs.getApiVersion());
    assertEquals(ODCSDataContract.OdcsKind.DATA_CONTRACT, odcs.getKind());
    assertEquals("test_contract", odcs.getName());
    assertEquals(ODCSDataContract.OdcsStatus.ACTIVE, odcs.getStatus());
    assertNotNull(odcs.getDescription());
    assertEquals("Test contract description", odcs.getDescription().getPurpose());
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
    assertEquals(2, odcs.getSchema().size());

    ODCSSchemaElement idElement = odcs.getSchema().get(0);
    assertEquals("id", idElement.getName());
    assertEquals(ODCSSchemaElement.LogicalType.INTEGER, idElement.getLogicalType());
    assertEquals("INT", idElement.getPhysicalType());
    assertTrue(idElement.getPrimaryKey());

    ODCSSchemaElement nameElement = odcs.getSchema().get(1);
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
            .anyMatch(p -> "refreshFrequency".equals(p.getProperty()) && "1".equals(p.getValue()));
    assertTrue(hasRefreshFrequency);

    boolean hasMaxLatency =
        odcs.getSlaProperties().stream()
            .anyMatch(p -> "maxLatency".equals(p.getProperty()) && "4".equals(p.getValue()));
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

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement idElement = new ODCSSchemaElement();
    idElement.setName("id");
    idElement.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    idElement.setDescription("Primary key column");
    idElement.setPrimaryKey(true);
    schema.add(idElement);

    ODCSSchemaElement emailElement = new ODCSSchemaElement();
    emailElement.setName("email");
    emailElement.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    emailElement.setRequired(true);
    schema.add(emailElement);

    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

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
    assertNotNull(contract.getOwners());
    assertEquals(2, contract.getOwners().size());
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
    assertEquals(12, odcs.getSchema().size());

    assertEquals(
        ODCSSchemaElement.LogicalType.INTEGER, odcs.getSchema().get(0).getLogicalType()); // INT
    assertEquals(
        ODCSSchemaElement.LogicalType.INTEGER, odcs.getSchema().get(1).getLogicalType()); // BIGINT
    assertEquals(
        ODCSSchemaElement.LogicalType.NUMBER, odcs.getSchema().get(2).getLogicalType()); // FLOAT
    assertEquals(
        ODCSSchemaElement.LogicalType.NUMBER, odcs.getSchema().get(3).getLogicalType()); // DOUBLE
    assertEquals(
        ODCSSchemaElement.LogicalType.NUMBER, odcs.getSchema().get(4).getLogicalType()); // DECIMAL
    assertEquals(
        ODCSSchemaElement.LogicalType.BOOLEAN, odcs.getSchema().get(5).getLogicalType()); // BOOLEAN
    assertEquals(
        ODCSSchemaElement.LogicalType.STRING, odcs.getSchema().get(6).getLogicalType()); // STRING
    assertEquals(
        ODCSSchemaElement.LogicalType.DATE, odcs.getSchema().get(7).getLogicalType()); // DATE
    assertEquals(
        ODCSSchemaElement.LogicalType.DATE, odcs.getSchema().get(8).getLogicalType()); // TIMESTAMP
    assertEquals(
        ODCSSchemaElement.LogicalType.ARRAY, odcs.getSchema().get(9).getLogicalType()); // ARRAY
    assertEquals(
        ODCSSchemaElement.LogicalType.OBJECT, odcs.getSchema().get(10).getLogicalType()); // JSON
    assertEquals(
        ODCSSchemaElement.LogicalType.OBJECT, odcs.getSchema().get(11).getLogicalType()); // STRUCT
  }

  @Test
  void testFromODCS_WithAllLogicalTypes() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new ArrayList<>();

    schema.add(
        new ODCSSchemaElement()
            .withName("int_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.INTEGER));
    schema.add(
        new ODCSSchemaElement()
            .withName("num_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.NUMBER));
    schema.add(
        new ODCSSchemaElement()
            .withName("bool_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.BOOLEAN));
    schema.add(
        new ODCSSchemaElement()
            .withName("str_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.STRING));
    schema.add(
        new ODCSSchemaElement()
            .withName("date_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.DATE));
    schema.add(
        new ODCSSchemaElement()
            .withName("arr_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.ARRAY));
    schema.add(
        new ODCSSchemaElement()
            .withName("obj_col")
            .withLogicalType(ODCSSchemaElement.LogicalType.OBJECT));

    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

    DataContract contract = ODCSConverter.fromODCS(odcs, entityRef);

    assertNotNull(contract.getSchema());
    assertEquals(7, contract.getSchema().size());

    assertEquals(ColumnDataType.INT, contract.getSchema().get(0).getDataType());
    assertEquals(ColumnDataType.DECIMAL, contract.getSchema().get(1).getDataType());
    assertEquals(ColumnDataType.BOOLEAN, contract.getSchema().get(2).getDataType());
    assertEquals(ColumnDataType.STRING, contract.getSchema().get(3).getDataType());
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

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement element = new ODCSSchemaElement();
    element.setName("custom_col");
    element.setLogicalType(ODCSSchemaElement.LogicalType.STRING); // This would map to STRING
    element.setPhysicalType("VARCHAR"); // But physical type should override
    schema.add(element);

    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

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
    assertEquals(1, odcs.getSchema().size());

    ODCSSchemaElement addressElement = odcs.getSchema().get(0);
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

    List<ODCSSchemaElement> schema = new ArrayList<>();

    ODCSSchemaElement addressElement = new ODCSSchemaElement();
    addressElement.setName("address");
    addressElement.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    List<ODCSSchemaElement> properties = new ArrayList<>();
    properties.add(
        new ODCSSchemaElement()
            .withName("street")
            .withLogicalType(ODCSSchemaElement.LogicalType.STRING));
    properties.add(
        new ODCSSchemaElement()
            .withName("city")
            .withLogicalType(ODCSSchemaElement.LogicalType.STRING));
    addressElement.setProperties(properties);

    schema.add(addressElement);
    odcs.setSchema(schema);

    EntityReference entityRef = new EntityReference();
    entityRef.setId(UUID.randomUUID());
    entityRef.setType("table");

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
    assertEquals(EntityStatus.DRAFT, getContractStatus(null, entityRef));
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
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_0_2, odcs.getApiVersion());
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
  void testFromODCS_WithFullDescription() {
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("desc_test");
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription desc =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription();
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
}

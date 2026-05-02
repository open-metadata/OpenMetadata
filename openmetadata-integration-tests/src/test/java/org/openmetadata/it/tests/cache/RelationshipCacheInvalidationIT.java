/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */
package org.openmetadata.it.tests.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * End-to-end coverage for the inline cache invalidation added to the relationship mutation path
 * (Bug B in the cache audit). Exercises the round-trip: assign a domain to a table via PATCH,
 * read it back, remove the domain, read it back. The PATCH path goes through
 * {@code addRelationship} / {@code deleteRelationship}; without the fix, the source-side bundle
 * cache (here: the domain's) keeps stale data — pre-fix this manifests as the cached list of
 * domain-tagged refs not picking up the latest asset assignment.
 *
 * <p>Both sides of the relationship are read after each mutation. Assertions check that the
 * domains field on the table matches the latest state — without the fix the inline mutation path
 * wouldn't drop the table's bundle and a cache read would surface the previous value.
 *
 * <p>Tests are skipped without a Redis cache provider.
 */
@ExtendWith(TestNamespaceExtension.class)
class RelationshipCacheInvalidationIT {

  @BeforeAll
  static void requireRedis() {
    Assumptions.assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "Relationship cache invalidation tests require cacheProvider=redis (set by -Pcache-tests"
            + " or -Ppostgres-os-redis, or pass -DcacheProvider=redis directly)");
  }

  @Test
  void addThenRemoveDomain_tableDomainsFieldReflectsLatest(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns, "rel_cache_dom");
    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);

    // Create table without a domain — domains field will be empty.
    Table table = createTable(ns, schema, "rel_cache_tbl");

    // Warm the cache with a no-domain read.
    Table beforeAdd = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertTrue(
        beforeAdd.getDomains() == null || beforeAdd.getDomains().isEmpty(),
        "table should start with no domain");

    // PATCH to add domain — this triggers addRelationship(domain.id, table.id, ...) under the
    // hood. Without the bug B fix the cached bundle on the table side wouldn't be touched.
    String addPatch =
        "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\""
            + domain.getId()
            + "\",\"type\":\"domain\"}]}]";
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/tables/" + table.getId(),
            addPatch,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());

    Table afterAdd = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    List<EntityReference> domainsAfterAdd = afterAdd.getDomains();
    assertNotNull(domainsAfterAdd, "domains field must hydrate after PATCH");
    assertEquals(1, domainsAfterAdd.size());
    assertEquals(domain.getId(), domainsAfterAdd.get(0).getId());

    // PATCH to remove the domain by replacing the field with an empty array.
    String removePatch = "[{\"op\":\"replace\",\"path\":\"/domains\",\"value\":[]}]";
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/tables/" + table.getId(),
            removePatch,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());

    Table afterRemove = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertTrue(
        afterRemove.getDomains() == null || afterRemove.getDomains().isEmpty(),
        "domains field must reflect removal — bundle cache should be invalidated by the inline"
            + " deleteRelationship path");
  }

  // -------------------------- Helpers --------------------------

  private static Domain createDomain(TestNamespace ns, String suffix) {
    CreateDomain request =
        new CreateDomain()
            .withName(ns.prefix(suffix))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Domain for relationship cache IT");
    return SdkClients.adminClient().domains().create(request);
  }

  private static Table createTable(TestNamespace ns, DatabaseSchema schema, String suffix) {
    Column column = new Column();
    column.setName("id");
    column.setDataType(ColumnDataType.INT);

    CreateTable createTable = new CreateTable();
    createTable.setName(ns.shortPrefix(suffix));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(List.of(column));
    return SdkClients.adminClient().tables().create(createTable);
  }
}

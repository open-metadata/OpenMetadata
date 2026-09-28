/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindConcat;

public interface GovernanceDAOs {
  @CreateSqlObject
  DomainDAO domainDAO();

  @CreateSqlObject
  DataProductDAO dataProductDAO();

  @CreateSqlObject
  DataContractDAO dataContractDAO();

  interface DomainDAO extends EntityDAO<Domain> {
    @Override
    default String getTableName() {
      return "domain_entity";
    }

    @Override
    default Class<Domain> getEntityClass() {
      return Domain.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @Override
    default int listCount(ListFilter filter) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");
      String hierarchyFilter = filter.getQueryParam("hierarchyFilter");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      } else if (Boolean.TRUE.toString().equals(hierarchyFilter)) {
        // For hierarchy API, when directChildrenOf is null, show only root domains
        condition +=
            " AND NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId = domain_entity.id AND er.fromEntity = 'domain' AND er.toEntity = 'domain' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      }

      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), condition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");
      String hierarchyFilter = filter.getQueryParam("hierarchyFilter");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      } else if (Boolean.TRUE.toString().equals(hierarchyFilter)) {
        // For hierarchy API, when directChildrenOf is null, show only root domains
        condition +=
            " AND NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId = domain_entity.id AND er.fromEntity = 'domain' AND er.toEntity = 'domain' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      }

      return listBefore(
          getTableName(), filter.getQueryParams(), condition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String condition = filter.getCondition();
      String directChildrenOf = filter.getQueryParam("directChildrenOf");
      String hierarchyFilter = filter.getQueryParam("hierarchyFilter");
      String offsetParam = filter.getQueryParam("offset");

      if (!nullOrEmpty(directChildrenOf)) {
        String parentFqnHash = FullyQualifiedName.buildHash(directChildrenOf);
        filter.queryParams.put("fqnHashSingleLevel", parentFqnHash + ".%");
        filter.queryParams.put("fqnHashNestedLevel", parentFqnHash + ".%.%");

        condition +=
            " AND fqnHash LIKE :fqnHashSingleLevel AND fqnHash NOT LIKE :fqnHashNestedLevel";
      } else if (Boolean.TRUE.toString().equals(hierarchyFilter)) {
        // For hierarchy API, when directChildrenOf is null, show only root domains
        condition +=
            " AND NOT EXISTS (SELECT 1 FROM entity_relationship er WHERE er.toId = domain_entity.id AND er.fromEntity = 'domain' AND er.toEntity = 'domain' AND er.relation = "
                + Relationship.CONTAINS.ordinal()
                + ")";
      }

      if (!nullOrEmpty(offsetParam) && Integer.parseInt(offsetParam) >= 0) {
        return listAfter(
            getTableName(),
            filter.getQueryParams(),
            condition,
            limit,
            Integer.parseInt(offsetParam));
      }

      return listAfter(
          getTableName(), filter.getQueryParams(), condition, limit, afterName, afterId);
    }

    @SqlQuery("SELECT json FROM domain_entity WHERE fqnHash LIKE :concatFqnhash ")
    List<String> getNestedDomains(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery("SELECT COUNT(*) FROM domain_entity WHERE fqnHash LIKE :concatFqnhash ")
    int countNestedDomains(
        @BindConcat(
                value = "concatFqnhash",
                parts = {":fqnhash", ".%"},
                hash = true)
            String fqnhash);

    @SqlQuery("SELECT fqnHash FROM domain_entity WHERE fqnHash LIKE :prefix")
    List<String> listFqnHashesByPrefix(@Bind("prefix") String prefix);

    @SqlQuery("SELECT fqnHash FROM domain_entity")
    List<String> listAllFqnHashes();

    @ConnectionAwareSqlQuery(
        value = "SELECT json ->> 'fullyQualifiedName' FROM domain_entity ORDER BY fqnHash",
        connectionType = POSTGRES)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')) FROM domain_entity ORDER BY fqnHash",
        connectionType = MYSQL)
    List<String> listAllFqns();
  }

  interface DataProductDAO extends EntityDAO<DataProduct> {
    @Override
    default String getTableName() {
      return "data_product_entity";
    }

    @Override
    default Class<DataProduct> getEntityClass() {
      return DataProduct.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }

  interface DataContractDAO extends EntityDAO<DataContract> {
    @Override
    default String getTableName() {
      return "data_contract_entity";
    }

    @Override
    default Class<DataContract> getEntityClass() {
      return DataContract.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM data_contract_entity WHERE JSON_EXTRACT(json, '$.entity.id') = :entityId AND JSON_EXTRACT(json, '$.entity.type') = :entityType AND (JSON_EXTRACT(json, '$.deleted') IS NULL OR JSON_EXTRACT(json, '$.deleted') = false) LIMIT 1",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM data_contract_entity WHERE json#>>'{entity,id}' = :entityId AND json#>>'{entity,type}' = :entityType AND (json->>'deleted' IS NULL OR json->>'deleted' = 'false') LIMIT 1",
        connectionType = POSTGRES)
    String getContractByEntityId(
        @Bind("entityId") String entityId, @Bind("entityType") String entityType);
  }
}

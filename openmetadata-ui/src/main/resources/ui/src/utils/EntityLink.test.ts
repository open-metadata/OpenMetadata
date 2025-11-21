/*
 *  Copyright 2023 Collate.
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
import EntityLink from './EntityLink';

const entityLink =
  '<#E::table::sample_data.ecommerce_db.shopify.dim_address::description>';
const entityLinkWithColumn =
  '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::address_id::tags>';
const entityLinkWithNestedColumn =
  '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::"address_id.city"::tags>';
const tableFqn = 'sample_data.ecommerce_db.shopify.dim_address';

describe('Test EntityLink', () => {
  it('Should split the entityLink into parts', () => {
    const entityLinkPartsWithColumn = EntityLink.split(entityLinkWithColumn);
    const entityLinkParts = EntityLink.split(entityLink);

    expect(entityLinkParts).toStrictEqual([
      'table',
      'sample_data.ecommerce_db.shopify.dim_address',
      'description',
    ]);

    expect(entityLinkPartsWithColumn).toStrictEqual([
      'table',
      'sample_data.ecommerce_db.shopify.dim_address',
      'columns',
      'address_id',
      'tags',
    ]);
  });

  it('Should return the entityType from entityLink', () => {
    expect(EntityLink.getEntityType(entityLink)).toStrictEqual('table');
  });

  it('Should return the entityFqn from entityLink', () => {
    expect(EntityLink.getEntityFqn(entityLink)).toStrictEqual(
      'sample_data.ecommerce_db.shopify.dim_address'
    );
  });

  it('Should return the entityField from entityLink', () => {
    expect(EntityLink.getEntityField(entityLink)).toStrictEqual('description');
  });

  it('Should return the columnName from entityLink', () => {
    expect(EntityLink.getTableColumnName(entityLinkWithColumn)).toStrictEqual(
      'address_id'
    );
  });

  it('Should return the column field from entityLink', () => {
    expect(EntityLink.getTableColumnField(entityLinkWithColumn)).toStrictEqual(
      'tags'
    );
  });

  it('Should return the undefined if columnName if not present in entityLink', () => {
    expect(EntityLink.getTableColumnName(entityLink)).toBeUndefined();
  });

  it('Should return the undefined if columnField if not present in entityLink', () => {
    expect(EntityLink.getTableColumnField(entityLink)).toBeUndefined();
  });

  it('Should build the entityLink', () => {
    expect(
      EntityLink.getEntityLink(
        'table',
        'sample_data.ecommerce_db.shopify.dim_address'
      )
    ).toStrictEqual(
      '<#E::table::sample_data.ecommerce_db.shopify.dim_address>'
    );
  });

  it('Should return entityFqn from entityLink', () => {
    expect(EntityLink.getEntityColumnFqn(entityLink)).toStrictEqual(
      'sample_data.ecommerce_db.shopify.dim_address'
    );
  });

  it('Should return entityColumnFqn from entityLink for column', () => {
    expect(EntityLink.getEntityColumnFqn(entityLinkWithColumn)).toStrictEqual(
      'sample_data.ecommerce_db.shopify.dim_address.address_id'
    );
  });

  it('Should return entityColumnFqn from entityLink for nested column', () => {
    expect(
      EntityLink.getEntityColumnFqn(entityLinkWithNestedColumn)
    ).toStrictEqual(
      'sample_data.ecommerce_db.shopify.dim_address."address_id.city"'
    );
  });

  it('Should return the entity link for table without column name', () => {
    const entityLink = EntityLink.getTableEntityLink(tableFqn);

    expect(entityLink).toStrictEqual(
      '<#E::table::sample_data.ecommerce_db.shopify.dim_address>'
    );
  });

  it('Should return the entity link for table without column name, if empty string is pass', () => {
    const columnName = '';
    const entityLink = EntityLink.getTableEntityLink(tableFqn, columnName);

    expect(entityLink).toStrictEqual(
      '<#E::table::sample_data.ecommerce_db.shopify.dim_address>'
    );
  });

  it('Should return the entity link for table with column name', () => {
    const columnName = 'address_id';
    const entityLink = EntityLink.getTableEntityLink(tableFqn, columnName);

    expect(entityLink).toStrictEqual(
      '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::address_id>'
    );
  });

  it('should return column name if column name is "type"', () => {
    const entityLink =
      '<#E::table::pw-database-service-69e197ad.pw-database-76212f52.pw-database-schema-473d89b5.pw-table-c0cfe45a::columns::type>';
    const columnName = EntityLink.getTableColumnName(entityLink);

    expect(columnName).toStrictEqual('type');
  });

  describe('Reserved keywords as column names', () => {
    describe('ENTITY_TYPE keywords as column names', () => {
      it('Should split entityLink with "topic" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::topic>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'topic',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'topic'
        );
      });

      it('Should split entityLink with "user" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::user>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'user',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual('user');
      });

      it('Should split entityLink with "database" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::database>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'database',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'database'
        );
      });

      it('Should split entityLink with "role" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::role>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'role',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual('role');
      });

      it('Should split entityLink with "chart" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::chart>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'chart',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'chart'
        );
      });

      it('Should split entityLink with "dashboard" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::dashboard>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'dashboard',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'dashboard'
        );
      });

      it('Should split entityLink with "pipeline" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::pipeline>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'pipeline',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'pipeline'
        );
      });

      it('Should split entityLink with "team" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::team>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'team',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual('team');
      });
    });

    describe('ENTITY_FIELD keywords as column names', () => {
      it('Should split entityLink with "description" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::description>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'description',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'description'
        );
      });

      it('Should split entityLink with "owner" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::owner>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'owner',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'owner'
        );
      });

      it('Should split entityLink with "tags" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::tags>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'tags',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual('tags');
      });

      it('Should split entityLink with "name" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::name>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'name',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual('name');
      });

      it('Should split entityLink with "tests" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::tests>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'tests',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'tests'
        );
      });

      it('Should split entityLink with "displayName" as column name', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::displayName>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'displayName',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'displayName'
        );
      });
    });

    describe('Reserved keywords with field access', () => {
      it('Should split entityLink with reserved keyword column and field', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::description::tags>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'description',
          'tags',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'description'
        );
        expect(EntityLink.getTableColumnField(entityLink)).toStrictEqual(
          'tags'
        );
      });

      it('Should split entityLink with "owner" column and "description" field', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::owner::description>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'owner',
          'description',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual(
          'owner'
        );
        expect(EntityLink.getTableColumnField(entityLink)).toStrictEqual(
          'description'
        );
      });

      it('Should split entityLink with "tags" column and "description" field', () => {
        const entityLink =
          '<#E::table::sample_data.ecommerce_db.shopify.dim_address::columns::tags::description>';
        const parts = EntityLink.split(entityLink);

        expect(parts).toStrictEqual([
          'table',
          'sample_data.ecommerce_db.shopify.dim_address',
          'columns',
          'tags',
          'description',
        ]);
        expect(EntityLink.getTableColumnName(entityLink)).toStrictEqual('tags');
        expect(EntityLink.getTableColumnField(entityLink)).toStrictEqual(
          'description'
        );
      });
    });
  });
});

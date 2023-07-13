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
});

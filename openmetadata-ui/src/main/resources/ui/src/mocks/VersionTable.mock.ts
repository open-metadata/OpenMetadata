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

import { VersionTableProps } from '../components/VersionTable/VersionTable.interfaces';
import {
  Column,
  ConstraintType,
  DataType,
  TableConstraint,
} from '../generated/entity/data/table';

export const mockColumnsData: Column[] = [
  {
    name: 'address_id',
    displayName: 'Address Id',
    dataType: DataType.Numeric,
    dataTypeDisplay: 'numeric',
    description:
      '<del>Unique identifier for the address.</del></span><span class="ant-typography diff-added" data-testid="diff-added"><u>new</u></span>',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.address_id',
    tags: [],
    ordinalPosition: 1,
  },
  {
    name: 'shop_id',
    dataType: DataType.Numeric,
    dataTypeDisplay: 'numeric',
    description:
      'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address.shop_id',
    tags: [],
    ordinalPosition: 2,
  },
  {
    name: 'first_name',
    dataType: DataType.Varchar,
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: 'First name of the customer.',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify.dim_address.first_name',
    tags: [],
    ordinalPosition: 3,
  },
];

export const mockTableConstraints: TableConstraint[] = [
  {
    constraintType: ConstraintType.PrimaryKey,
    columns: ['address_id', 'shop_id'],
  },
];

export const mockVersionTableProps: VersionTableProps<Column> = {
  columnName: '',
  columns: mockColumnsData,
  tableConstraints: mockTableConstraints,
};

/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { getAllByTestId, render } from '@testing-library/react';
import { TableDetail } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  Constraint,
  DataType,
  LabelType,
  State,
  Table,
} from '../../generated/entity/data/table';
import SchemaTable from './SchemaTable';

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

const mockColumns: Table['columns'] = [
  {
    constraint: Constraint.PrimaryKey,
    dataType: DataType.Number,
    dataTypeDisplay: 'numeric',
    description: 'Unique identifier for the address.',
    fullyQualifiedName: 'bigquery.shopify.dim_address.address_id',
    name: 'address_id',
    ordinalPosition: 1,
    tags: [
      { tagFQN: 'string', labelType: LabelType.Manual, state: State.Confirmed },
      {
        tagFQN: 'string2',
        labelType: LabelType.Derived,
        state: State.Confirmed,
      },
    ],
  },
];

const mockjoins = [
  {
    columnName: 'testId',
    joinedWith: [{ fullyQualifiedName: 'joinedTable', joinCount: 1 }],
  },
];

const mockUpdate = jest.fn();

const mockOwner: TableDetail['owner'] = {
  id: 'string',
  type: 'user',
};

describe('Test QueryDetails Component', () => {
  it('Renders all the columns sent to the component', () => {
    const { container } = render(
      <SchemaTable
        hasEditAccess
        columnName="testColumn"
        columns={mockColumns}
        joins={mockjoins}
        owner={mockOwner}
        onUpdate={mockUpdate}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const columns = getAllByTestId(container, 'column');

    expect(columns.length).toBe(1);
  });
});

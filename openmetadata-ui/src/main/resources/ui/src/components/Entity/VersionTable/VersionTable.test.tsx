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

import { render, screen, within } from '@testing-library/react';
import { ConstraintType, DataType } from '../../../generated/entity/data/table';
import { mockVersionTableProps } from '../../../mocks/VersionTable.mock';
import VersionTable from './VersionTable.component';

jest.mock('../../Tag/TagsViewer/TagsViewer', () =>
  jest.fn().mockImplementation(() => <div>TagsViewer</div>)
);

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="rich-text-editor-previewer">{markdown}</div>
    ))
);

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search: '',
  }));
});

jest.mock('react-router-dom', () => {
  return {
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
  };
});

describe('VersionTable component', () => {
  it('VersionTable should show column display names along with name if present', () => {
    render(<VersionTable {...mockVersionTableProps} />);

    // Check Names
    expect(screen.getByText('address_id')).toBeInTheDocument();
    expect(screen.getByText('shop_id')).toBeInTheDocument();
    expect(screen.getByText('first_name')).toBeInTheDocument();

    // Check Display Name
    expect(screen.getByText('Address Id')).toBeInTheDocument();
  });

  it('keeps rendering when table constraint diffs are malformed', () => {
    render(
      <VersionTable
        {...mockVersionTableProps}
        addedTableConstraintDiffs={[
          { name: 'tableConstraints', newValue: '{invalid' },
        ]}
        deletedTableConstraintDiffs={[
          { name: 'tableConstraints', oldValue: '[{"columns":42}]' },
        ]}
      />
    );

    expect(screen.getByText('address_id')).toBeInTheDocument();
  });

  it.each([
    {
      scenario: 'two overlapping groups are added',
      current: [
        ['a', 'b'],
        ['b', 'c'],
      ],
      added: [
        ['a', 'b'],
        ['b', 'c'],
      ],
      deleted: [],
      expected: { a: ['A'], b: ['A', 'B'], c: ['B'] },
    },
    {
      scenario: 'an earlier group is unchanged',
      current: [
        ['a', 'b'],
        ['b', 'c'],
      ],
      added: [['b', 'c']],
      deleted: [],
      expected: { a: ['A'], b: ['B'], c: ['B'] },
    },
    {
      scenario: 'different groups are added and deleted',
      current: [['b', 'c']],
      added: [['b', 'c']],
      deleted: [['a', 'b']],
      expected: { a: ['B'], b: ['B', 'A'], c: ['A'] },
    },
    {
      scenario: 'all composite groups are deleted',
      current: [],
      added: [],
      deleted: [
        ['a', 'b'],
        ['b', 'c'],
      ],
      expected: { a: ['A'], b: ['A', 'B'], c: ['B'] },
    },
  ])(
    'keeps shared group letters when $scenario',
    ({ current, added, deleted, expected }) => {
      const constraints = (groups: string[][]) =>
        groups.map((columns) => ({
          constraintType: ConstraintType.Unique,
          columns,
        }));

      render(
        <VersionTable
          {...mockVersionTableProps}
          addedTableConstraintDiffs={
            added.length
              ? [
                  {
                    name: 'tableConstraints',
                    newValue: JSON.stringify(constraints(added)),
                  },
                ]
              : []
          }
          columns={['a', 'b', 'c'].map((name) => ({
            name,
            dataType: DataType.Int,
          }))}
          deletedTableConstraintDiffs={
            deleted.length
              ? [
                  {
                    name: 'tableConstraints',
                    oldValue: JSON.stringify(constraints(deleted)),
                  },
                ]
              : []
          }
          tableConstraints={constraints(current)}
        />
      );

      for (const [name, letters] of Object.entries(expected)) {
        const row = screen.getByText(name).closest('tr');

        if (!row) {
          throw new Error(`Missing row for column ${name}`);
        }

        expect(
          within(row)
            .getAllByTestId('constraint-icon-unique')
            .map((icon) => icon.nextElementSibling?.textContent)
        ).toEqual(letters);
      }
    }
  );
});

/*
 *  Copyright 2025 Collate.
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

import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  TagGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TagList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Tag: ({ children, id }: { children?: ReactNode; id?: string }) => (
    <span data-testid={`tag-${id}`}>{children}</span>
  ),
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { EntityReference } from 'generated/entity/type';
import ChipView from './ChipView';

describe('ChipView', () => {
  it('renders a tag per value', () => {
    const values = [
      { id: '1', displayName: 'Data Steward' },
      { id: '2', name: 'AyushTest2' },
    ] as EntityReference[];

    render(<ChipView label="Persona" values={values} />);

    expect(screen.getByTestId('tag-1')).toHaveTextContent('Data Steward');
    expect(screen.getByTestId('tag-2')).toHaveTextContent('AyushTest2');
  });

  it('renders the provided placeholder when empty', () => {
    render(
      <ChipView
        label="Persona"
        noDataPlaceholder="No persona assigned"
        values={[]}
      />
    );

    expect(screen.getByText('No persona assigned')).toBeInTheDocument();
  });

  it('falls back to "--" when empty with no placeholder', () => {
    render(<ChipView label="All Domains" values={[]} />);

    expect(screen.getByText('--')).toBeInTheDocument();
  });
});

/*
 *  Copyright 2026 Collate.
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
import { ReactElement } from 'react';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { HeaderPropertyId } from '../../../constants/EntityHeaderProperties.constants';
import { HeaderProperty } from './EntityHeaderProperties.types';
import HeaderPropertyField from './HeaderPropertyField';

const renderEditor = (trigger: ReactElement) => (
  <div data-testid="editor">{trigger}</div>
);

const property = (overrides: Partial<HeaderProperty> = {}): HeaderProperty => ({
  id: HeaderPropertyId.Owners,
  label: 'Owners',
  isEmpty: false,
  isReadOnly: false,
  content: 'Anika',
  editorTestId: 'edit-owners',
  ...overrides,
});

describe('HeaderPropertyField', () => {
  it('shows the label, the value and the edit trigger', () => {
    render(<HeaderPropertyField property={property({ renderEditor })} />);

    expect(screen.getByText('Owners')).toBeInTheDocument();
    expect(screen.getByText('Anika')).toBeInTheDocument();
    expect(screen.getByTestId('editor')).toContainElement(
      screen.getByTestId('edit-owners')
    );
    expect(screen.queryByText('label.add')).not.toBeInTheDocument();
  });

  it('offers Add in place of an empty value the viewer can fill', () => {
    render(
      <HeaderPropertyField
        property={property({ isEmpty: true, renderEditor })}
      />
    );

    expect(screen.getByTestId('edit-owners')).toHaveTextContent('label.add');
    expect(screen.getByTestId('edit-owners')).toHaveAttribute(
      'aria-label',
      'label.add-entity'
    );
    expect(screen.queryByText('Anika')).not.toBeInTheDocument();
  });

  it('shows a dash for an empty value the viewer cannot fill', () => {
    render(<HeaderPropertyField property={property({ isEmpty: true })} />);

    expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.queryByTestId('edit-owners')).not.toBeInTheDocument();
  });

  it('marks a custom property with a dot', () => {
    const { container } = render(
      <HeaderPropertyField
        property={property({ customPropertyType: 'String' })}
      />
    );

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

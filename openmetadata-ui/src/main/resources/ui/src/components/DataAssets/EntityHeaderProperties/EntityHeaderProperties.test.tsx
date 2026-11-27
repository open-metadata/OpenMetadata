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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityHeader } from '../../../generated/system/ui/page';
import EntityHeaderProperties from './EntityHeaderProperties';
import { HeaderProperty } from './EntityHeaderProperties.types';

jest.mock('react-router-dom', () => ({
  Link: ({ to, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props} />
  ),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: { getFormattedEntityType: jest.fn().mockReturnValue('Table') },
}));

const property = (
  id: string,
  overrides: Partial<HeaderProperty> = {}
): HeaderProperty => ({
  id: id as HeaderProperty['id'],
  label: `${id}-label`,
  isEmpty: false,
  isReadOnly: true,
  content: <span>{`${id}-value`}</span>,
  ...overrides,
});

const standardProperties = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map(
  (id) => property(id)
);
const customProperty = property('extension.steward', {
  customPropertyType: 'User',
  isReadOnly: false,
});
const properties = [...standardProperties, customProperty];

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const shownIds = () =>
  screen
    .getAllByTestId(/^header-property-(?!toggle)/)
    .map((element) =>
      element.getAttribute('data-testid')?.replace('header-property-', '')
    );

describe('EntityHeaderProperties', () => {
  it('shows the first five standard properties and the rest behind Show more', async () => {
    render(
      <EntityHeaderProperties
        entityType={EntityType.TABLE}
        properties={properties}
      />
    );

    expect(shownIds()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);

    const toggle = screen.getByTestId('header-properties-toggle');

    expect(toggle).toHaveTextContent('label.show-count-more');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(shownIds()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
    expect(toggle).toHaveTextContent('label.show-less');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('draws the saved header in its order without the Show more toggle when it fits', () => {
    render(
      <EntityHeaderProperties
        entityHeader={{ properties: ['extension.steward', 'p3', 'missing'] }}
        entityType={EntityType.TABLE}
        properties={properties}
      />
    );

    expect(shownIds()).toEqual(['extension.steward', 'p3']);
    expect(
      screen.queryByTestId('header-properties-toggle')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('customize-header-button')
    ).not.toBeInTheDocument();
  });

  it('hides an empty read-only property', () => {
    render(
      <EntityHeaderProperties
        entityHeader={{ properties: ['p1', 'p2'] }}
        entityType={EntityType.TABLE}
        properties={[property('p1', { isEmpty: true }), property('p2')]}
      />
    );

    expect(shownIds()).toEqual(['p2']);
  });

  describe('customize header panel', () => {
    const openPanel = async (entityHeader?: EntityHeader) => {
      const onEntityHeaderChange = jest.fn();
      render(
        <EntityHeaderProperties
          entityHeader={entityHeader}
          entityType={EntityType.TABLE}
          properties={properties}
          onEntityHeaderChange={onEntityHeaderChange}
        />
      );
      await user.click(screen.getByTestId('customize-header-button'));

      return { onEntityHeaderChange, panel: screen.getByRole('dialog') };
    };

    it('lists pinned properties in rank order and the rest under Not in header', async () => {
      const { panel } = await openPanel();
      const pinned = within(panel).getByTestId('pinned-header-properties');
      const unpinned = within(panel).getByTestId('unpinned-header-properties');

      expect(within(pinned).getAllByRole('row')).toHaveLength(7);
      expect(
        within(unpinned).getByText('extension.steward-label')
      ).toBeVisible();
      expect(within(unpinned).getByText('User')).toBeVisible();
      expect(
        within(
          within(pinned).getByTestId('pinned-header-property-p5')
        ).getByTestId('header-properties-fit-marker')
      ).toBeVisible();
    });

    it('applies the pinned order and the empty-property choice', async () => {
      const { panel, onEntityHeaderChange } = await openPanel();

      await user.click(within(panel).getByTestId('header-property-toggle-p2'));
      await user.click(
        within(panel).getByTestId('header-property-toggle-extension.steward')
      );
      await user.click(
        within(panel).getByTestId('show-empty-header-properties')
      );
      await user.click(within(panel).getByTestId('apply-header-properties'));

      expect(onEntityHeaderChange).toHaveBeenCalledWith({
        properties: ['p1', 'p3', 'p4', 'p5', 'p6', 'p7', 'extension.steward'],
        showEmptyProperties: false,
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('re-ranks the pinned rows when one is unpinned', async () => {
      const { panel } = await openPanel();
      const rankOf = (id: string) =>
        within(panel).getByTestId(`pinned-header-property-${id}`).textContent;

      expect(rankOf('p2')).toMatch(/^2/);

      await user.click(within(panel).getByTestId('header-property-toggle-p1'));

      expect(rankOf('p2')).toMatch(/^1/);
    });

    it('discards the draft on cancel', async () => {
      const { panel, onEntityHeaderChange } = await openPanel();

      await user.click(within(panel).getByTestId('header-property-toggle-p1'));
      await user.click(within(panel).getByText('label.cancel'));

      expect(onEntityHeaderChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stores a header reset to the default as unset', async () => {
      const { panel, onEntityHeaderChange } = await openPanel({
        properties: ['extension.steward', 'p1'],
      });

      await user.click(within(panel).getByTestId('reset-header-properties'));
      await user.click(within(panel).getByTestId('apply-header-properties'));

      expect(onEntityHeaderChange).toHaveBeenCalledWith(undefined);
    });

    it('applies nothing when the draft is unchanged', async () => {
      const { panel, onEntityHeaderChange } = await openPanel();

      await user.click(within(panel).getByTestId('apply-header-properties'));

      expect(onEntityHeaderChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('links to the custom properties of the entity type', async () => {
      const { panel } = await openPanel();

      expect(
        within(panel).getByTestId('create-custom-property-link')
      ).toHaveAttribute('href', '/settings/customProperties/tables');
    });

    it('narrows both lists by filter and search, without the fit marker', async () => {
      const { panel } = await openPanel();

      await user.click(
        within(panel).getByTestId('header-property-filter-custom')
      );

      expect(
        within(panel).queryByTestId('pinned-header-property-p1')
      ).not.toBeInTheDocument();
      expect(
        within(panel).getByTestId('unpinned-header-property-extension.steward')
      ).toBeVisible();

      await user.click(within(panel).getByTestId('header-property-filter-all'));
      await user.type(
        within(panel).getByTestId('header-property-search'),
        'P5'
      );

      expect(
        within(panel).getByTestId('pinned-header-property-p5')
      ).toBeVisible();
      expect(
        within(panel).queryByTestId('pinned-header-property-p1')
      ).not.toBeInTheDocument();
      expect(
        within(panel).queryByTestId('header-properties-fit-marker')
      ).not.toBeInTheDocument();
    });
  });
});

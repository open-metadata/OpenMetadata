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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AssetBinding } from '../../generated/type/ontologyConceptBindingsResponse';
import { OntologyNode } from './OntologyExplorer.interface';
import OntologyNativeDataCanvas, {
  NativeAssetMenu,
} from './OntologyNativeDataCanvas';

const concept: OntologyNode = {
  id: 'medication',
  label: 'Medication Record',
  type: 'ontologyConcept',
  assetCount: 4,
};

const asset = (
  id: string,
  serviceLabel?: string,
  type = 'table'
): OntologyNode => ({
  id: `asset:medication:${id}`,
  label: id,
  type: 'dataAsset',
  serviceLabel,
  fullyQualifiedName: `svc.db.${id}`,
  entityRef: { id, type, name: id, fullyQualifiedName: `svc.db.${id}` },
});

const ASSETS = [
  asset('orders', 'Mssql'),
  asset('events', 'Kafka', 'topic'),
  asset('customers', 'Mssql'),
  asset('loose'),
];

const binding = { assetId: 'orders', columns: [] } as unknown as AssetBinding;

const renderCanvas = (
  overrides: Partial<Parameters<typeof OntologyNativeDataCanvas>[0]> = {}
) => {
  const menu: NativeAssetMenu = {
    canUnlink: true,
    conceptName: concept.label,
    getBinding: (node) =>
      node.entityRef?.id === 'orders' ? binding : undefined,
    onOpenAsset: jest.fn(),
    onUnlink: jest.fn().mockResolvedValue(true),
  };
  const props = {
    assets: ASSETS,
    concept,
    isConceptSelected: false,
    lineage: [],
    menu,
    onLoadMore: jest.fn(),
    onPaneClick: jest.fn(),
    onSelectAsset: jest.fn(),
    onSelectColumn: jest.fn(),
    onSelectConcept: jest.fn(),
    ...overrides,
  };
  render(<OntologyNativeDataCanvas {...props} />);

  return props;
};

const sourceNames = () =>
  screen
    .getAllByRole('region')
    .map((section) => section.getAttribute('aria-label'));

describe('OntologyNativeDataCanvas', () => {
  it('draws the concept as the root and groups its assets by source, named sources first, each counting its assets', () => {
    renderCanvas();

    expect(
      screen.getByTestId('ontology-data-root-medication')
    ).toHaveTextContent('Medication Record');
    expect(sourceNames()).toEqual(['Kafka', 'Mssql', 'label.other']);
    expect(
      within(screen.getByTestId('ontology-data-source-Mssql')).getByText('2')
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('ontology-data-asset-edge')).toHaveLength(4);
    expect(
      screen.getByTestId('ontology-data-asset-asset:medication:events')
    ).toHaveTextContent('Kafka · label.topic');
  });

  it('opens an asset from its menu and unlinks it after the confirmation', async () => {
    const { menu } = renderCanvas();

    fireEvent.click(
      screen.getByTestId('ontology-data-asset-menu-asset:medication:orders')
    );
    fireEvent.click(await screen.findByText('label.open-asset'));

    expect(menu.onOpenAsset).toHaveBeenCalledWith(ASSETS[0]);

    fireEvent.click(
      screen.getByTestId('ontology-data-asset-menu-asset:medication:orders')
    );
    fireEvent.click(await screen.findByText('label.unlink'));
    fireEvent.click(await screen.findByTestId('ontology-unlink-confirm'));

    await waitFor(() => expect(menu.onUnlink).toHaveBeenCalledWith(binding));
  });

  it('offers no Unlink in the menu of an asset the person cannot unlink', async () => {
    renderCanvas();

    fireEvent.click(
      screen.getByTestId('ontology-data-asset-menu-asset:medication:events')
    );

    expect(await screen.findByText('label.open-asset')).toBeInTheDocument();
    expect(screen.queryByText('label.unlink')).not.toBeInTheDocument();
  });

  it('draws observed lineage between two assets and names it in the legend beside asset binding', () => {
    renderCanvas({
      lineage: [
        { from: 'asset:medication:orders', to: 'asset:medication:events' },
      ],
    });

    expect(screen.getAllByTestId('ontology-data-semantic-edge')).toHaveLength(
      1
    );
    expect(
      screen.getByTestId('ontology-data-legend-asset-binding')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-data-legend-lineage')).toBeVisible();
  });

  it('shows the first six assets, then loads the rest and shows fewer again with one control', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      asset(`t${index}`, 'Mssql')
    );
    const { onLoadMore } = renderCanvas({
      assets: many,
      concept: { ...concept, assetCount: 10 },
    });

    expect(screen.getAllByTestId('ontology-data-asset-name')).toHaveLength(6);

    fireEvent.click(screen.getByTestId('ontology-load-more-assets-medication'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('ontology-data-asset-name')).toHaveLength(8);

    fireEvent.click(screen.getByTestId('ontology-show-less-assets-medication'));

    expect(screen.getAllByTestId('ontology-data-asset-name')).toHaveLength(6);
  });

  it('offers Link data only to a person who may link', () => {
    const onLinkData = jest.fn();
    renderCanvas({ onLinkData });
    fireEvent.click(screen.getByTestId('ontology-data-link-more'));

    expect(onLinkData).toHaveBeenCalledTimes(1);
  });

  it('has no Link data without the link action', () => {
    renderCanvas();

    expect(
      screen.queryByTestId('ontology-data-link-more')
    ).not.toBeInTheDocument();
  });

  it('marks the root as selected when the concept is the selected one', () => {
    const { onSelectConcept } = renderCanvas({ isConceptSelected: true });
    const root = screen.getByTestId('ontology-data-root-medication');
    fireEvent.click(root);

    expect(root).toHaveAttribute('aria-pressed', 'true');
    expect(onSelectConcept).toHaveBeenCalledTimes(1);
  });

  it('keeps the cards as real buttons inside a plain group, and clears the selection from the empty canvas only', () => {
    const { onPaneClick, onSelectAsset } = renderCanvas();
    const pane = screen.getByTestId('ontology-data-cluster-medication');

    expect(pane).toHaveAttribute('role', 'group');
    expect(pane).not.toHaveAttribute('tabindex');

    const card = screen.getByTestId(
      'ontology-data-asset-asset:medication:orders'
    );
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyUp(card, { key: 'Enter' });

    expect(onSelectAsset).toHaveBeenCalledWith(ASSETS[0]);

    fireEvent.pointerDown(card);
    fireEvent.pointerUp(card);

    expect(onPaneClick).not.toHaveBeenCalled();

    fireEvent.pointerDown(pane);
    fireEvent.pointerUp(pane);

    expect(onPaneClick).toHaveBeenCalledTimes(1);
  });

  it('clears the selection with Escape from a focused card, and ignores a right-click on the canvas', () => {
    const { onPaneClick } = renderCanvas();
    const pane = screen.getByTestId('ontology-data-cluster-medication');
    const card = screen.getByTestId(
      'ontology-data-asset-asset:medication:orders'
    );

    // jsdom has no PointerEvent, so a MouseEvent carries the secondary button.
    fireEvent(
      pane,
      new MouseEvent('pointerdown', { bubbles: true, button: 2 })
    );
    fireEvent(pane, new MouseEvent('pointerup', { bubbles: true, button: 2 }));

    expect(onPaneClick).not.toHaveBeenCalled();

    card.focus();
    fireEvent.keyDown(card, { key: 'Escape' });

    expect(onPaneClick).toHaveBeenCalledTimes(1);
  });
});

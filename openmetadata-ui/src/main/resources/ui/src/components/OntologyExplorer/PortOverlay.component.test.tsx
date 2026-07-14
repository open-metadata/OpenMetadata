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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import PortOverlay from './PortOverlay.component';
import { RelationshipTypePickerProps } from './RelationshipTypePicker.interface';

jest.mock(
  './RelationshipTypePicker.component',
  () =>
    function RelationshipTypePickerMock({
      onSelect,
      sourceLabel,
      targetLabel,
    }: RelationshipTypePickerProps) {
      return (
        <button
          data-testid="relationship-type-picker"
          type="button"
          onClick={() => onSelect('broader')}>
          {sourceLabel} {targetLabel}
        </button>
      );
    }
);

const RECT = {
  bottom: 420,
  height: 400,
  left: 10,
  right: 610,
  toJSON: () => ({}),
  top: 20,
  width: 600,
  x: 10,
  y: 20,
};

interface HarnessProps {
  onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void>;
}

function Harness({ onCreateRelation }: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.dataset.graphZoom = '1';
      container.dataset.nodePositions = JSON.stringify({
        source: { x: 110, y: 120 },
        target: { x: 310, y: 120 },
      });
      container.getBoundingClientRect = () => RECT;
    }
  }, []);

  return (
    <div>
      <div ref={containerRef} />
      <PortOverlay
        isEditMode
        containerRef={containerRef}
        isolatedNodeIds={new Set()}
        nodeLabels={{ source: 'Remittance', target: 'Settlement' }}
        onCreateRelation={onCreateRelation}
      />
    </div>
  );
}

describe('PortOverlay', () => {
  it('arms a source port, selects a target, and creates the typed relation', async () => {
    const onCreateRelation = jest.fn().mockResolvedValue(undefined);
    render(<Harness onCreateRelation={onCreateRelation} />);

    const sourcePort = await screen.findByTestId('ontology-port-source');

    expect(sourcePort).toHaveStyle({ left: '166px', top: '91px' });

    fireEvent.click(sourcePort);

    expect(
      screen.getByTestId('ontology-connect-instruction')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-target-target'));

    expect(screen.getByTestId('relationship-type-picker')).toHaveTextContent(
      'Remittance Settlement'
    );

    fireEvent.click(screen.getByTestId('relationship-type-picker'));

    await waitFor(() =>
      expect(onCreateRelation).toHaveBeenCalledWith(
        'source',
        'target',
        'broader'
      )
    );
  });
});

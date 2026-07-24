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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import PortOverlay from './PortOverlay.component';
import {
  OntologyEditNodeClickDetail,
  ONTOLOGY_EDIT_CANCEL_EVENT,
  ONTOLOGY_EDIT_NODE_CLICK_EVENT,
} from './PortOverlay.interface';
import { RelationshipTypePickerProps } from './RelationshipTypePicker.interface';

jest.mock(
  './RelationshipTypePicker.component',
  () =>
    function RelationshipTypePickerMock({
      onCancel,
      onSelect,
      sourceLabel,
      targetLabel,
    }: RelationshipTypePickerProps) {
      return (
        <>
          <button
            data-testid="relationship-type-picker"
            type="button"
            onClick={() => onSelect('broader')}>
            {sourceLabel} {targetLabel}
          </button>
          <button
            data-testid="relationship-type-picker-cancel"
            type="button"
            onClick={onCancel}
          />
        </>
      );
    }
);

const RECT = {
  bottom: 480,
  height: 400,
  left: 200,
  right: 800,
  toJSON: () => ({}),
  top: 80,
  width: 600,
  x: 200,
  y: 80,
};

interface HarnessProps {
  isEditMode?: boolean;
  onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void>;
}

function Harness({ isEditMode = true, onCreateRelation }: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const overlay = document.querySelector<HTMLElement>(
      '[data-testid="ontology-port-overlay"]'
    );
    if (overlay) {
      overlay.getBoundingClientRect = () => RECT;
    }
  }, []);

  return (
    <div>
      <div data-testid="graph-container" ref={containerRef} />
      <PortOverlay
        containerRef={containerRef}
        isEditMode={isEditMode}
        nodeLabels={{ source: 'Remittance', target: 'Settlement' }}
        onCreateRelation={onCreateRelation}
      />
    </div>
  );
}

function dispatchNodeClick(
  detail: OntologyEditNodeClickDetail
): CustomEvent<OntologyEditNodeClickDetail> {
  const event = new CustomEvent(ONTOLOGY_EDIT_NODE_CLICK_EVENT, {
    cancelable: true,
    detail,
  });
  act(() => {
    screen.getByTestId('graph-container').dispatchEvent(event);
  });

  return event;
}

describe('PortOverlay', () => {
  it('creates a typed relation from G6 port and node clicks', async () => {
    const onCreateRelation = jest.fn().mockResolvedValue(undefined);
    render(<Harness onCreateRelation={onCreateRelation} />);

    const sourceEvent = dispatchNodeClick({
      clientX: 600,
      clientY: 180,
      isPort: true,
      nodeId: 'source',
    });

    expect(sourceEvent.defaultPrevented).toBe(true);
    expect(
      screen.getByTestId('ontology-connect-instruction')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-port-source')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-target-target')
    ).not.toBeInTheDocument();

    const targetEvent = dispatchNodeClick({
      clientX: 780,
      clientY: 180,
      isPort: false,
      nodeId: 'target',
    });

    expect(targetEvent.defaultPrevented).toBe(true);
    expect(screen.getByTestId('relationship-type-picker')).toHaveTextContent(
      'Remittance Settlement'
    );
    expect(screen.getByTestId('ontology-relation-picker-anchor')).toHaveStyle({
      left: '490px',
      top: '100px',
      transform: 'translate(-50%, 16px)',
    });
    expect(screen.getByTestId('ontology-connection-line')).toHaveAttribute(
      'x1',
      '400'
    );
    expect(screen.getByTestId('ontology-connection-line')).toHaveAttribute(
      'x2',
      '580'
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

  it('uses the latest G6 port position after a node moves', () => {
    render(<Harness onCreateRelation={jest.fn()} />);

    dispatchNodeClick({
      clientX: 320,
      clientY: 280,
      isPort: true,
      nodeId: 'source',
    });

    expect(screen.getByTestId('ontology-connection-line')).toHaveAttribute(
      'x1',
      '120'
    );
    expect(screen.getByTestId('ontology-connection-line')).toHaveAttribute(
      'y1',
      '200'
    );
  });

  it('cancels an active connection when G6 starts a transform', () => {
    render(<Harness onCreateRelation={jest.fn()} />);

    dispatchNodeClick({
      clientX: 600,
      clientY: 180,
      isPort: true,
      nodeId: 'source',
    });
    act(() => {
      screen
        .getByTestId('graph-container')
        .dispatchEvent(new Event(ONTOLOGY_EDIT_CANCEL_EVENT));
    });

    expect(
      screen.queryByTestId('ontology-connect-instruction')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-connection-line')
    ).not.toBeInTheDocument();
  });

  it('does not render edit controls outside edit mode', () => {
    render(<Harness isEditMode={false} onCreateRelation={jest.fn()} />);

    expect(
      screen.queryByTestId('ontology-port-overlay')
    ).not.toBeInTheDocument();
  });
});

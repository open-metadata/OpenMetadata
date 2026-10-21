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

import { render } from '@testing-library/react';
import { Handle, Position } from 'reactflow';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import PortNode from './PortNode.component';
import { PortNodeData, PortNodeProps } from './PortsLineageView.types';

// `Handle` is the only piece of reactflow that touches the DOM here. Render it
// as a plain div carrying the props as data-attributes so the test can assert
// the `id` the component wires up — mirroring how the real Handle exposes
// `data-handleid` — without needing a ReactFlowProvider/Node context.
jest.mock('reactflow', () => ({
  ...jest.requireActual('reactflow'),
  Handle: jest
    .fn()
    .mockImplementation(
      ({
        id,
        position,
        type,
      }: {
        id?: string;
        position?: Position;
        type?: string;
      }) => (
        <div
          className="react-flow__handle"
          data-handleid={id}
          data-handlepos={position}
          data-handletype={type}
        />
      )
    ),
}));

// LineageNodeLabelV1 carries the whole entity-lineage stack (breadcrumbs,
// test-suite summary, lineage store, …). Scope this test to just the handle
// wiring by stubbing the label out.
jest.mock('../../../Entity/EntityLineage/LineageNodeLabelV1', () => ({
  __esModule: true,
  default: ({ node }: { node: { name?: string } }) => (
    <div data-testid="lineage-node-label">{node.name ?? 'label'}</div>
  ),
}));

const port: SourceType = {
  id: 'uuid-input-1',
  name: 'consumerTable',
  fullyQualifiedName: 'domain.myDataProduct.consumerTable',
  entityType: 'table',
} as SourceType;

// The handle id PortsLineageView computes and threads into the node data is
// the port's fullyQualifiedName (see getPortHandleId). It MUST differ from
// port.id for the test to be meaningful — and in OpenMetadata it always does
// (UUID vs dotted FQN).
const handleId = 'domain.myDataProduct.consumerTable';

const baseData: PortNodeData = {
  label: 'consumerTable',
  port,
  isInputPort: true,
  handleId,
};

const handleMock = Handle as unknown as jest.Mock;

const getRenderedHandle = (container: HTMLElement) =>
  container.querySelector('.react-flow__handle') as HTMLElement | null;

describe('PortNode', () => {
  beforeEach(() => {
    handleMock.mockClear();
  });

  it('registers the input-port source Handle with data.handleId (not port.id)', () => {
    const { container } = render(
      <PortNode
        {...({ data: { ...baseData, isInputPort: true } } as PortNodeProps)}
      />
    );

    const handle = getRenderedHandle(container);

    expect(handle).not.toBeNull();

    // The exact regression guard: the Handle id is the FQN threaded via
    // data.handleId, NOT the entity UUID (port.id).
    expect(handle?.getAttribute('data-handleid')).toBe(handleId);
    expect(handle?.getAttribute('data-handleid')).not.toBe(port.id);
    expect(handle?.getAttribute('data-handletype')).toBe('source');
    expect(handle?.getAttribute('data-handlepos')).toBe(Position.Right);

    // Sanity: the contract is also visible on the `id` prop given to <Handle>.
    expect(handleMock).toHaveBeenCalledTimes(1);
    expect(handleMock.mock.calls[0][0]).toMatchObject({
      id: handleId,
      position: Position.Right,
      type: 'source',
    });
  });

  it('registers the output-port target Handle with data.handleId (not port.id)', () => {
    const { container } = render(
      <PortNode
        {...({ data: { ...baseData, isInputPort: false } } as PortNodeProps)}
      />
    );

    const handle = getRenderedHandle(container);

    expect(handle).not.toBeNull();

    expect(handle?.getAttribute('data-handleid')).toBe(handleId);
    expect(handle?.getAttribute('data-handleid')).not.toBe(port.id);
    expect(handle?.getAttribute('data-handletype')).toBe('target');
    expect(handle?.getAttribute('data-handlepos')).toBe(Position.Left);

    expect(handleMock).toHaveBeenCalledTimes(1);
    expect(handleMock.mock.calls[0][0]).toMatchObject({
      id: handleId,
      position: Position.Left,
      type: 'target',
    });
  });

  it('keeps using data.handleId when it differs from every other port identifier', () => {
    const distinctData: PortNodeData = {
      label: 'supplierTable',
      port: {
        ...port,
        id: 'uuid-output-9',
        name: 'supplierTable',
        fullyQualifiedName: 'domain.myDataProduct.supplierTable',
      },
      isInputPort: false,
      handleId: 'domain.myDataProduct.supplierTable',
    };

    const { container } = render(
      <PortNode {...({ data: distinctData } as PortNodeProps)} />
    );

    const handle = getRenderedHandle(container);

    expect(handle?.getAttribute('data-handleid')).toBe(distinctData.handleId);
    expect(distinctData.handleId).not.toBe(distinctData.port.id);
    expect(distinctData.handleId).not.toBe(distinctData.port.name);
  });

  it('renders exactly one Handle per node (source for input, target for output)', () => {
    const { container: inputContainer } = render(
      <PortNode
        {...({ data: { ...baseData, isInputPort: true } } as PortNodeProps)}
      />
    );

    expect(inputContainer.querySelectorAll('.react-flow__handle')).toHaveLength(
      1
    );

    const { container: outputContainer } = render(
      <PortNode
        {...({ data: { ...baseData, isInputPort: false } } as PortNodeProps)}
      />
    );

    expect(
      outputContainer.querySelectorAll('.react-flow__handle')
    ).toHaveLength(1);
  });

  it('exposes the port FQN on the node container test id', () => {
    const { container } = render(
      <PortNode
        {...({ data: { ...baseData, isInputPort: true } } as PortNodeProps)}
      />
    );

    expect(
      container.querySelector(`[data-testid="port-node-${handleId}"]`)
    ).not.toBeNull();
  });
});

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
import { Fragment, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Box } from './box';

describe('Box child groups', () => {
  it('leaves ordinary layout children unwrapped', () => {
    const { container } = render(
      <Box>
        <button>Action</button>
      </Box>
    );

    expect(screen.getByRole('button').parentElement).toBe(container.firstChild);
  });

  it('groups controls, text, arrays and fragments without empty items', () => {
    const { container } = render(
      <Box direction="col" itemClassName="layout-space-item">
        <button>Action</button>
        {false}
        {null}
        {undefined}
        {['Text', <span key="value">Value</span>]}
        <Fragment>
          <span>First</span>
          <span>Second</span>
        </Fragment>
      </Box>
    );

    const items = container.querySelectorAll('.layout-space-item');

    expect(items).toHaveLength(5);
    expect(items[0]).toContainElement(screen.getByRole('button'));
    expect(Array.from(items, (item) => item.textContent)).toEqual([
      'Action',
      'Text',
      'Value',
      'First',
      'Second',
    ]);
  });

  it('renders no container when grouped children are empty', () => {
    const { container } = render(
      <Box itemClassName="layout-space-item">
        {null}
        {false}
      </Box>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('preserves keyed child state when groups reorder', () => {
    function Item({ name }: { name: string }) {
      const [initialName] = useState(name);

      return <span>{initialName}</span>;
    }

    const { rerender } = render(
      <Box itemClassName="item">
        <Item key="a" name="A" />
        <Item key="b" name="B" />
      </Box>
    );

    rerender(
      <Box itemClassName="item">
        <Item key="b" name="Changed B" />
        <Item key="a" name="Changed A" />
      </Box>
    );

    expect(screen.queryByText('Changed A')).not.toBeInTheDocument();
    expect(screen.queryByText('Changed B')).not.toBeInTheDocument();
    expect(
      screen.getByText('B').parentElement?.nextElementSibling
    ).toContainElement(screen.getByText('A'));
  });
});

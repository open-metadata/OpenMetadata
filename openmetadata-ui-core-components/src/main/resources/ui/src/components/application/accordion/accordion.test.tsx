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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
} from './accordion';

describe('AccordionPanel', () => {
  it('keeps validation fields mounted while collapsed', () => {
    render(
      <Accordion>
        <AccordionItem id="advanced">
          <AccordionHeader>Advanced</AccordionHeader>
          <AccordionPanel>
            <input aria-label="Token validity" defaultValue="3600" />
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    );

    expect(screen.getByLabelText('Token validity')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.change(screen.getByLabelText('Token validity'), {
      target: { value: '7200' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByLabelText('Token validity')).toHaveValue('7200');
  });
});

describe('AccordionItem variant', () => {
  it.each([
    ['default', 'tw:bg-surface'],
    ['muted', 'tw:bg-primary_alt'],
  ] as const)('paints the %s item with %s', (variant, bg) => {
    render(
      <Accordion>
        <AccordionItem data-testid="item" id="item" variant={variant}>
          <AccordionHeader>Item</AccordionHeader>
        </AccordionItem>
      </Accordion>
    );

    expect(screen.getByTestId('item')).toHaveClass(bg);
  });
});

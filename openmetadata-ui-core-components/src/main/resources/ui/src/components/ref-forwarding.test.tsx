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
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Table } from './application/table/table';
import { Checkbox } from './base/checkbox/checkbox';
import { HintText } from './base/input/hint-text';
import { Label } from './base/input/label';
import { RadioButton, RadioGroup } from './base/radio-buttons/radio-buttons';
import { Select } from './base/select/select';
import { TextArea, TextAreaBase } from './base/textarea/textarea';
import { TimePicker } from './base/time-picker/time-picker';
import { FeaturedIcon } from './foundations/featured-icon/featured-icon';
import { Typography } from './foundations/typography';

// Under React 18 a function component never receives `ref` as a prop, so each
// of these only reaches its element through forwardRef.
describe('ref forwarding', () => {
  it('Typography', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Typography as="p" ref={ref}>
        Body
      </Typography>
    );

    expect(ref.current).toBe(screen.getByText('Body'));
  });

  it('FeaturedIcon', () => {
    const ref = createRef<HTMLDivElement>();
    render(<FeaturedIcon color="brand" ref={ref} />);

    expect(ref.current).toHaveAttribute('data-featured-icon');
  });

  it('Label', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Name</Label>);

    expect(ref.current?.tagName).toBe('LABEL');
  });

  it('HintText', () => {
    const ref = createRef<HTMLElement>();
    render(<HintText ref={ref}>Help</HintText>);

    expect(ref.current).toBe(screen.getByText('Help'));
  });

  it('Checkbox', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Checkbox label="Accept" ref={ref} />);

    expect(ref.current?.tagName).toBe('LABEL');
  });

  it('RadioButton', () => {
    const ref = createRef<HTMLLabelElement>();
    render(
      <RadioGroup aria-label="Role">
        <RadioButton label="Admin" ref={ref} value="admin" />
      </RadioGroup>
    );

    expect(ref.current?.tagName).toBe('LABEL');
  });

  it('TimePicker', () => {
    const ref = createRef<HTMLDivElement>();
    render(<TimePicker aria-label="Start" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('Select', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Select aria-label="Team" items={[]} ref={ref}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
    );

    expect(ref.current).toContainElement(
      screen.getByRole('button', { name: /Team/ })
    );
  });

  it('TextArea and TextAreaBase', () => {
    const rootRef = createRef<HTMLDivElement>();
    const textAreaRef = createRef<HTMLTextAreaElement>();
    render(<TextArea label="Reason" ref={rootRef} textAreaRef={textAreaRef} />);

    expect(textAreaRef.current).toBe(
      screen.getByRole('textbox', { name: /Reason/ })
    );
    expect(rootRef.current).toContainElement(textAreaRef.current);

    const baseRef = createRef<HTMLTextAreaElement>();
    render(<TextAreaBase aria-label="Notes" ref={baseRef} />);

    expect(baseRef.current).toBe(
      screen.getByRole('textbox', { name: 'Notes' })
    );
  });

  it('Table.Cell', () => {
    const ref = createRef<HTMLTableCellElement>();
    render(
      <Table aria-label="Assets">
        <Table.Header>
          <Table.Head isRowHeader>Name</Table.Head>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell ref={ref}>orders</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    expect(ref.current).toBe(screen.getByText('orders').closest('td'));
  });
});

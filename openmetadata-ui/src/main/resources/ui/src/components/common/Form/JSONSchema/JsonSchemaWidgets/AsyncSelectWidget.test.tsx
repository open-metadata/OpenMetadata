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
import { WidgetProps } from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchIndex } from '../../../../../enums/search.enum';
import { DataAssetAsyncSelectListProps } from '../../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import AsyncSelectWidget from './AsyncSelectWidget';

const mockSelectProps = jest.fn();

const ORDERS = {
  id: '1',
  type: 'table',
  name: 'orders',
  fullyQualifiedName: 'svc.db.orders',
};
const USERS = { ...ORDERS, id: '2', name: 'users', fullyQualifiedName: 'u' };
const toOption = (reference: typeof ORDERS) => ({
  displayName: reference.name,
  value: reference.fullyQualifiedName,
  reference,
});

jest.mock(
  '../../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () => (props: DataAssetAsyncSelectListProps) => {
    mockSelectProps(props);

    return (
      <>
        <button onClick={() => props.onChange?.(toOption(ORDERS))}>
          pick-one
        </button>
        <button
          onClick={() => props.onChange?.([toOption(ORDERS), toOption(USERS)])}>
          pick-many
        </button>
        <button onClick={() => props.onChange?.(undefined)}>clear</button>
      </>
    );
  }
);

const renderWidget = (props: Partial<WidgetProps> = {}) => {
  const onChange = jest.fn();
  render(
    <AsyncSelectWidget
      {...({
        schema: { autoCompleteType: SearchIndex.TOPIC, placeholder: 'Pick' },
        onChange,
        ...props,
      } as unknown as WidgetProps)}
    />
  );

  return onChange;
};

describe('AsyncSelectWidget', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches the schema index and pre-selects the current reference', () => {
    renderWidget({ value: ORDERS });

    expect(mockSelectProps).toHaveBeenCalledWith(
      expect.objectContaining({
        placeholder: 'Pick',
        searchIndex: SearchIndex.TOPIC,
        value: 'svc.db.orders',
        initialOptions: [
          expect.objectContaining({
            value: 'svc.db.orders',
            reference: ORDERS,
          }),
        ],
      })
    );
  });

  it('defaults to the table index with nothing selected', () => {
    renderWidget({ schema: {} });

    expect(mockSelectProps).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.TABLE,
        value: undefined,
        initialOptions: undefined,
      })
    );
  });

  it('emits entity references for single, multiple and cleared picks', () => {
    const onChange = renderWidget();

    fireEvent.click(screen.getByText('pick-one'));

    expect(onChange).toHaveBeenLastCalledWith(ORDERS);

    fireEvent.click(screen.getByText('pick-many'));

    expect(onChange).toHaveBeenLastCalledWith([ORDERS, USERS]);

    fireEvent.click(screen.getByText('clear'));

    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});

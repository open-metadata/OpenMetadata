/*
 *  Copyright 2021 Collate
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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import CardListItem from './CardWithListItems';

const mockFunction = jest.fn();
const mockCard = {
  id: 'test1',
  title: 'card',
  description: 'description*',
  data: 'data',
};

jest.mock('../../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

describe('Test CardWithListing Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <CardListItem card={mockCard} isActive={false} onSelect={mockFunction} />
    );

    const card = getByTestId('card-list');

    expect(card).toBeInTheDocument();

    expect(getByTestId('icon')).toBeEmptyDOMElement();
  });

  it('OnClick callback function should call', () => {
    const { getByTestId } = render(
      <CardListItem card={mockCard} isActive={false} onSelect={mockFunction} />
    );

    const card = getByTestId('card-list');
    fireEvent(
      card,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});

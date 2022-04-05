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

import {
  findByTestId,
  fireEvent,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { BlurLayout } from './BlurLayout';

const markdown =
  // eslint-disable-next-line max-len
  'Updated **columns** : <span class="diff-added">account_category_code, </span>account_type_code, account_type_desc, <span class="diff-removed">account_category_code</span><span class="diff-added">account_type_desc_eng</span>, <span class="diff-removed">eca_ind</span><span class="diff-added">ban_type_desc</span>, <span class="diff-removed">bill_production_ind</span><span class="diff-added">ban_type_key</span>, <span class="diff-removed">collection_waive_ind</span><span class="diff-added">bill_production_ind</span>, <span class="diff-removed">vip_status</span><span class="diff-added">business_type</span>, <span class="diff-removed">ban_type_desc</span><span class="diff-added">check_in_crm</span>, <span class="diff-removed">non_commercial_ind</span><span class="diff-added">collection_waive_ind</span>, <span class="diff-removed">legacy_account_category, </span>corporate_category, <span class="diff-removed">ban_type_key</span><span class="diff-added">currency_key</span>, <span class="diff-removed">segment_key</span><span class="diff-added">eca_ind</span>, <span class="diff-removed">check_in_crm</span><span class="diff-added">legacy_account_category</span>, <span class="diff-removed">currency_key</span><span class="diff-added">legal_person_ind</span>, <span class="diff-removed">legal_person_ind</span><span class="diff-added">non_commercial_ind</span>, <span class="diff-removed">account_type_desc_eng</span><span class="diff-added">segment_key</span>, <span class="diff-removed">business_type</span><span class="diff-added">vip_status</span>';

const displayMoreHandler = jest.fn();

const mockProp = {
  enableSeeMoreVariant: true,
  markdown,
  displayMoreText: true,
  blurClasses: '',
  displayMoreHandler,
};

jest.mock('./RichTextEditorPreviewer', () => ({
  MAX_LENGTH: 300,
}));

describe('Test BlurLayout Component', () => {
  it('Should render the Layout Component', async () => {
    const { container } = render(<BlurLayout {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const blurLayout = await findByTestId(container, 'blur-layout');

    const displayButton = await findByTestId(container, 'display-button');

    expect(blurLayout).toBeInTheDocument();

    expect(displayButton).toBeInTheDocument();
  });

  it('Should not render the Layout Component if markdown length is less that MAX_LENGTH', async () => {
    const { container } = render(<BlurLayout {...mockProp} markdown="" />, {
      wrapper: MemoryRouter,
    });

    const blurLayout = queryByTestId(container, 'blur-layout');

    const displayButton = queryByTestId(container, 'display-button');

    expect(blurLayout).not.toBeInTheDocument();

    expect(displayButton).not.toBeInTheDocument();
  });

  it('Should not render the Layout Component if enableSeeMoreVariant is false', async () => {
    const { container } = render(
      <BlurLayout {...mockProp} enableSeeMoreVariant={false} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const blurLayout = queryByTestId(container, 'blur-layout');

    const displayButton = queryByTestId(container, 'display-button');

    expect(blurLayout).not.toBeInTheDocument();

    expect(displayButton).not.toBeInTheDocument();
  });

  it('Should call displayMoreHandler on display button click', async () => {
    const { container } = render(<BlurLayout {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const blurLayout = await findByTestId(container, 'blur-layout');

    const displayButton = await findByTestId(container, 'display-button');

    expect(blurLayout).toBeInTheDocument();

    expect(displayButton).toBeInTheDocument();

    fireEvent.click(displayButton);

    expect(displayMoreHandler).toBeCalled();
  });
});

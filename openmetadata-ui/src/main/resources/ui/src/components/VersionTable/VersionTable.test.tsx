/*
 *  Copyright 2023 Collate.
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
import React from 'react';
import { mockVersionTableProps } from '../../mocks/VersionTable.mock';
import VersionTable from './VersionTable.component';

jest.mock(
  '../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder',
  () => jest.fn().mockImplementation(() => <div>FilterTablePlaceHolder</div>)
);

jest.mock('../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

jest.mock('../Tag/TagsViewer/TagsViewer', () =>
  jest.fn().mockImplementation(() => <div>TagsViewer</div>)
);

jest.mock('../common/RichTextEditor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="rich-text-editor-previewer">{markdown}</div>
    ))
);

describe('VersionTable component', () => {
  it('VersionTable should show column display names along with name if present', () => {
    render(<VersionTable {...mockVersionTableProps} />);

    // Check Names
    expect(screen.getByText('address_id')).toBeInTheDocument();
    expect(screen.getByText('shop_id')).toBeInTheDocument();
    expect(screen.getByText('first_name')).toBeInTheDocument();

    // Check Display Name
    expect(screen.getByText('Address Id')).toBeInTheDocument();
  });
});

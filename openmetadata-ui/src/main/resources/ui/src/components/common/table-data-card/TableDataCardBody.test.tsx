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

import { render } from '@testing-library/react';
import React from 'react';
import TableDataCardBody from './TableDataCardBody';

jest.mock('../rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

describe('Test TableDataCardBody Component', () => {
  const extraInfo = [
    { key: 'Owner', value: 'owner' },
    { key: 'Service', value: 'service' },
    { key: 'Usage', value: 'percentile' },
    { key: 'Tier', value: 'tier' },
  ];

  const tags = ['tag 1', 'tag 2', 'tag 3', 'tag 4'];

  it('Component should render', () => {
    const { getByTestId } = render(
      <TableDataCardBody description="test" extraInfo={extraInfo} tags={tags} />
    );
    const tableBody = getByTestId('table-body');

    expect(tableBody).toBeInTheDocument();
  });

  it('Tags should render if provided', () => {
    const { getByTestId } = render(
      <TableDataCardBody description="test" extraInfo={extraInfo} tags={tags} />
    );
    const tag = getByTestId('tags-container');

    expect(tag).toBeInTheDocument();
  });

  it('Tags should not render if not provided', () => {
    const { queryByText } = render(
      <TableDataCardBody description="test" extraInfo={extraInfo} />
    );
    const tag = queryByText(/tags/i);

    expect(tag).not.toBeInTheDocument();
  });

  it('Extra information should not render if value is null or undefined', () => {
    const { queryByText } = render(
      <TableDataCardBody
        description="test"
        extraInfo={[...extraInfo, { key: 'extraInfoTest', value: undefined }]}
      />
    );
    const extraInfoTest = queryByText(/extraInfoTest/i);

    expect(extraInfoTest).not.toBeInTheDocument();
  });
});

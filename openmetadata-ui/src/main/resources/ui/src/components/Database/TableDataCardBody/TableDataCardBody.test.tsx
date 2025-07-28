/*
 *  Copyright 2022 Collate.
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
import { TAG_CONSTANT } from '../../../constants/Tag.constants';
import TableDataCardBody from './TableDataCardBody';

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../../Tag/TagsViewer/TagsViewer', () => {
  return jest.fn().mockReturnValue(<p>TagsViewer</p>);
});

jest.mock('../../common/EntitySummaryDetails/EntitySummaryDetails', () => {
  return jest
    .fn()
    .mockReturnValue(
      <p data-testid="entity-summary-details">EntitySummaryDetails component</p>
    );
});

describe('Test TableDataCardBody Component', () => {
  const extraInfo = [
    { key: 'Owner', value: 'owner' },
    { key: 'Service', value: 'service' },
    { key: 'Usage', value: 'percentile' },
    { key: 'Tier', value: 'tier' },
    { key: 'Database', value: 'ecommerce_db' },
    { key: 'Schema', value: 'ecommerce_db' },
  ];

  const tags = [
    { ...TAG_CONSTANT, tagFQN: 'tag 1' },
    { ...TAG_CONSTANT, tagFQN: 'tag 2' },
    { ...TAG_CONSTANT, tagFQN: 'tag 3' },
    { ...TAG_CONSTANT, tagFQN: 'tag 4' },
  ];

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

  it('Should render all the extra info', () => {
    const { queryByText, getByTestId } = render(
      <TableDataCardBody
        description="test"
        extraInfo={[...extraInfo, { key: 'undefined', value: undefined }]}
      />
    );

    const extraInformations = queryByText(/undefined/i);

    expect(extraInformations).not.toBeInTheDocument();

    for (let index = 0; index < extraInfo.length; index++) {
      const element = extraInfo[index];

      expect(getByTestId(`${element.key}`)).toBeInTheDocument();
    }
  });
});

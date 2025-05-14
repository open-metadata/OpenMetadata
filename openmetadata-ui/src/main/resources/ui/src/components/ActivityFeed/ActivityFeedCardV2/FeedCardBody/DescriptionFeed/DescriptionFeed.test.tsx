/*
 *  Copyright 2024 Collate.
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
import {
  MOCK_DESCRIPTION_FEED_1,
  MOCK_DESCRIPTION_FEED_2,
  MOCK_DESCRIPTION_FEED_3,
  MOCK_DESCRIPTION_FEED_4,
} from '../../../../../mocks/DescriptionFeed.mock';
import DescriptionFeed from './DescriptionFeed';

jest.mock('../../../../common/RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('../../../../../utils/FeedUtils', () => ({
  getFeedChangeFieldLabel: jest.fn(),
  getFieldOperationIcon: jest.fn(),
  getFrontEndFormat: jest.fn(),
}));

describe('Description Feed', () => {
  it('renders component when description is updated', () => {
    render(<DescriptionFeed feed={MOCK_DESCRIPTION_FEED_1} />);

    expect(screen.getByText('RichTextEditorPreviewer')).toBeInTheDocument();
  });

  it('renders component when description is added', () => {
    render(<DescriptionFeed feed={MOCK_DESCRIPTION_FEED_2} />);

    expect(screen.getByText('RichTextEditorPreviewer')).toBeInTheDocument();
  });

  it('renders component when description is entity column', () => {
    render(<DescriptionFeed feed={MOCK_DESCRIPTION_FEED_3} />);

    expect(screen.getByText('RichTextEditorPreviewer')).toBeInTheDocument();
  });

  it('renders component when description is deleted in column', () => {
    render(<DescriptionFeed feed={MOCK_DESCRIPTION_FEED_4} />);

    expect(screen.getByText('RichTextEditorPreviewer')).toBeInTheDocument();
  });
});

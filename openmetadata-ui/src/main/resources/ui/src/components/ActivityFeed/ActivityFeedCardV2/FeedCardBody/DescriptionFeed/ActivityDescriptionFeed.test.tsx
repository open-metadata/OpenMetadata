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

import { render, screen } from '@testing-library/react';
import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import ActivityDescriptionFeed from './ActivityDescriptionFeed';

const RICH_TEXT_PREVIEW = 'rich-text-preview' as const;
const UPDATED_DESCRIPTION = 'Updated description' as const;
const NEW_DESCRIPTION = 'New description' as const;
const OLD_DESCRIPTION = 'Old description' as const;

jest.mock('../../../../../utils/FeedUtilsPure', () => ({
  getFrontEndFormat: jest.fn((text) => text),
}));

jest.mock('../../../../common/RichTextEditor/RichTextEditorPreviewNew', () => {
  return jest.fn(({ markdown }) => (
    <div data-testid="rich-text-preview">{markdown}</div>
  ));
});

const createMockActivity = (
  oldValue?: string,
  newValue?: string
): ActivityEvent => ({
  id: 'activity-123',
  timestamp: 1234567890,
  eventType: 'entityUpdated' as ActivityEvent['eventType'],
  actor: { id: 'user-1', type: 'user', name: 'testuser' },
  entity: { id: 'entity-1', type: 'table', name: 'testTable' },
  about: '<#E::table::test>',
  summary: UPDATED_DESCRIPTION,
  oldValue,
  newValue,
});

describe('ActivityDescriptionFeed', () => {
  describe('Description Added', () => {
    it('should display new description when description is added', () => {
      const activity = createMockActivity(undefined, 'New description added');

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent(
        'New description added'
      );
    });

    it('should render rich text preview when description is newly added', () => {
      const activity = createMockActivity('', NEW_DESCRIPTION);

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toBeInTheDocument();
    });

    it('should render when oldValue is undefined', () => {
      const activity = createMockActivity(undefined, NEW_DESCRIPTION);

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toBeInTheDocument();
    });
  });

  describe('Description Updated', () => {
    it('should display new description when description is updated', () => {
      const activity = createMockActivity(OLD_DESCRIPTION, UPDATED_DESCRIPTION);

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent(
        UPDATED_DESCRIPTION
      );
    });

    it('should render when description is updated', () => {
      const activity = createMockActivity(OLD_DESCRIPTION, NEW_DESCRIPTION);

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent(
        NEW_DESCRIPTION
      );
    });
  });

  describe('Description Removed', () => {
    it('should display old description when description is removed', () => {
      const activity = createMockActivity(OLD_DESCRIPTION, '');

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent(
        OLD_DESCRIPTION
      );
    });

    it('should display old description when newValue is undefined', () => {
      const activity = createMockActivity(OLD_DESCRIPTION, undefined);

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent(
        OLD_DESCRIPTION
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle both values being empty', () => {
      const activity = createMockActivity('', '');

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent('');
    });

    it('should handle both values being undefined', () => {
      const activity = createMockActivity(undefined, undefined);

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent('');
    });

    it('should handle whitespace-only descriptions', () => {
      const activity = createMockActivity('', '   ');

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toBeInTheDocument();
    });

    it('should handle markdown content', () => {
      const markdownDescription = '## Header\n- Item 1\n- Item 2';
      const activity = createMockActivity('', markdownDescription);

      render(<ActivityDescriptionFeed activity={activity} />);

      // Text content collapses newlines, so we just verify the core content is present
      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent('Header');
      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent('Item 1');
    });

    it('should handle HTML content in description', () => {
      const htmlDescription = '<p>Some <strong>bold</strong> text</p>';
      const activity = createMockActivity('', htmlDescription);

      render(<ActivityDescriptionFeed activity={activity} />);

      expect(screen.getByTestId(RICH_TEXT_PREVIEW)).toHaveTextContent('bold');
    });
  });
});

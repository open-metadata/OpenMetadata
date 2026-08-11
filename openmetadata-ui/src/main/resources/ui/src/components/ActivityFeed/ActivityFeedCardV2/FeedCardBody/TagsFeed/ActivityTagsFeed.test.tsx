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
import { TagLabel } from '../../../../../generated/type/tagLabel';
import ActivityTagsFeed from './ActivityTagsFeed';

jest.mock('../../../../Tag/TagsViewer/TagsViewer', () => {
  return jest.fn(({ tags }) => (
    <div data-testid="tags-viewer">
      {tags.map((tag: TagLabel) => (
        <span data-testid={`tag-${tag.tagFQN}`} key={tag.tagFQN}>
          {tag.tagFQN}
        </span>
      ))}
    </div>
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
  summary: 'Updated tags',
  oldValue,
  newValue,
});

const createTagsJson = (tags: string[]): string => {
  return JSON.stringify(
    tags.map((tagFQN) => ({
      tagFQN,
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    }))
  );
};

describe('ActivityTagsFeed', () => {
  describe('Tag Addition', () => {
    it('should display added tags with add icon', () => {
      const activity = createMockActivity(
        createTagsJson([]),
        createTagsJson(['PII.Sensitive', 'Tier.Tier1'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-PII.Sensitive')).toBeInTheDocument();
      expect(screen.getByTestId('tag-Tier.Tier1')).toBeInTheDocument();
    });

    it('should show tags viewer when tags are added', () => {
      const activity = createMockActivity(
        createTagsJson([]),
        createTagsJson(['PII.Sensitive'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tags-viewer')).toBeInTheDocument();
    });

    it('should only show newly added tags, not existing ones', () => {
      const activity = createMockActivity(
        createTagsJson(['ExistingTag']),
        createTagsJson(['ExistingTag', 'NewTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-NewTag')).toBeInTheDocument();
      expect(screen.queryByTestId('tag-ExistingTag')).not.toBeInTheDocument();
    });
  });

  describe('Tag Removal', () => {
    it('should display removed tags with delete icon', () => {
      const activity = createMockActivity(
        createTagsJson(['PII.Sensitive', 'Tier.Tier1']),
        createTagsJson([])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-PII.Sensitive')).toBeInTheDocument();
      expect(screen.getByTestId('tag-Tier.Tier1')).toBeInTheDocument();
    });

    it('should only show removed tags, not remaining ones', () => {
      const activity = createMockActivity(
        createTagsJson(['RemovedTag', 'RemainingTag']),
        createTagsJson(['RemainingTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-RemovedTag')).toBeInTheDocument();
      expect(screen.queryByTestId('tag-RemainingTag')).not.toBeInTheDocument();
    });
  });

  describe('Tag Addition and Removal', () => {
    it('should display both added and removed tags', () => {
      const activity = createMockActivity(
        createTagsJson(['OldTag']),
        createTagsJson(['NewTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-OldTag')).toBeInTheDocument();
      expect(screen.getByTestId('tag-NewTag')).toBeInTheDocument();
    });

    it('should render two TagsViewer components when both add and remove', () => {
      const activity = createMockActivity(
        createTagsJson(['RemovedTag']),
        createTagsJson(['AddedTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      const tagsViewers = screen.getAllByTestId('tags-viewer');

      expect(tagsViewers).toHaveLength(2);
    });
  });

  describe('No Changes', () => {
    it('should not render TagsViewer when no tags changed', () => {
      const activity = createMockActivity(
        createTagsJson(['SameTag']),
        createTagsJson(['SameTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.queryByTestId('tags-viewer')).not.toBeInTheDocument();
    });

    it('should not render when both old and new are empty', () => {
      const activity = createMockActivity(
        createTagsJson([]),
        createTagsJson([])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.queryByTestId('tags-viewer')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined oldValue', () => {
      const activity = createMockActivity(
        undefined,
        createTagsJson(['NewTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-NewTag')).toBeInTheDocument();
    });

    it('should handle undefined newValue', () => {
      const activity = createMockActivity(
        createTagsJson(['OldTag']),
        undefined
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-OldTag')).toBeInTheDocument();
    });

    it('should handle invalid JSON in oldValue', () => {
      const activity = createMockActivity(
        'invalid json',
        createTagsJson(['NewTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-NewTag')).toBeInTheDocument();
    });

    it('should handle invalid JSON in newValue', () => {
      const activity = createMockActivity(
        createTagsJson(['OldTag']),
        'invalid json'
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-OldTag')).toBeInTheDocument();
    });

    it('should handle non-array JSON values', () => {
      const activity = createMockActivity(
        JSON.stringify({ notAnArray: true }),
        createTagsJson(['NewTag'])
      );

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.getByTestId('tag-NewTag')).toBeInTheDocument();
    });

    it('should handle empty strings', () => {
      const activity = createMockActivity('', '');

      render(<ActivityTagsFeed activity={activity} />);

      expect(screen.queryByTestId('tags-viewer')).not.toBeInTheDocument();
    });
  });
});

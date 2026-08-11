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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactionOperation } from '../../../../enums/reactions.enum';
import { ActivityEvent } from '../../../../generated/entity/activity/activityEvent';
import { ReactionType } from '../../../../generated/type/reaction';
import ActivityEventFooter from './ActivityEventFooter';

const mockUpdateActivityReaction = jest.fn();

jest.mock('../../ActivityFeedProvider/ActivityFeedProvider', () => ({
  useActivityFeedProvider: () => ({
    updateActivityReaction: mockUpdateActivityReaction,
  }),
}));

jest.mock('../../Reactions/Reactions', () => {
  return jest.fn(({ reactions, onReactionSelect }) => (
    <div data-testid="reactions-component">
      <span data-testid="reactions-count">{reactions?.length ?? 0}</span>
      <button
        data-testid="add-reaction-btn"
        onClick={() =>
          onReactionSelect(ReactionType.ThumbsUp, ReactionOperation.ADD)
        }>
        Add Reaction
      </button>
      <button
        data-testid="remove-reaction-btn"
        onClick={() =>
          onReactionSelect(ReactionType.ThumbsUp, ReactionOperation.REMOVE)
        }>
        Remove Reaction
      </button>
    </div>
  ));
});

const createMockActivity = (
  overrides?: Partial<ActivityEvent>
): ActivityEvent => ({
  id: 'activity-123',
  timestamp: 1234567890,
  eventType: 'entityUpdated' as ActivityEvent['eventType'],
  actor: { id: 'user-1', type: 'user', name: 'testuser' },
  entity: { id: 'entity-1', type: 'table', name: 'testTable' },
  about: '<#E::table::test>',
  summary: 'Updated tags',
  reactions: [],
  ...overrides,
});

describe('ActivityEventFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render comment button', () => {
      const activity = createMockActivity();

      render(<ActivityEventFooter activity={activity} />);

      expect(screen.getByTestId('comment-button')).toBeInTheDocument();
      expect(screen.getByTestId('comment-icon')).toBeInTheDocument();
    });

    it('should render reactions component', () => {
      const activity = createMockActivity();

      render(<ActivityEventFooter activity={activity} />);

      expect(screen.getByTestId('reactions-component')).toBeInTheDocument();
    });

    it('should pass reactions to Reactions component', () => {
      const activity = createMockActivity({
        reactions: [
          {
            reactionType: ReactionType.ThumbsUp,
            user: { id: 'user-1', type: 'user' },
          },
          {
            reactionType: ReactionType.Heart,
            user: { id: 'user-2', type: 'user' },
          },
        ],
      });

      render(<ActivityEventFooter activity={activity} />);

      expect(screen.getByTestId('reactions-count')).toHaveTextContent('2');
    });

    it('should apply margin class when isForFeedTab is true', () => {
      const activity = createMockActivity();

      const { container } = render(
        <ActivityEventFooter isForFeedTab activity={activity} />
      );

      expect(container.querySelector('.m-y-md')).toBeInTheDocument();
    });

    it('should not apply margin class when isForFeedTab is false', () => {
      const activity = createMockActivity();

      const { container } = render(
        <ActivityEventFooter activity={activity} isForFeedTab={false} />
      );

      expect(container.querySelector('.m-y-md')).not.toBeInTheDocument();
    });
  });

  describe('Comment Button', () => {
    it('should call onActivityClick when comment button is clicked and isForFeedTab is true', () => {
      const activity = createMockActivity();
      const mockOnActivityClick = jest.fn();

      render(
        <ActivityEventFooter
          isForFeedTab
          activity={activity}
          onActivityClick={mockOnActivityClick}
        />
      );

      fireEvent.click(screen.getByTestId('comment-button'));

      expect(mockOnActivityClick).toHaveBeenCalledWith(activity);
    });

    it('should NOT call onActivityClick when isForFeedTab is false', () => {
      const activity = createMockActivity();
      const mockOnActivityClick = jest.fn();

      render(
        <ActivityEventFooter
          activity={activity}
          isForFeedTab={false}
          onActivityClick={mockOnActivityClick}
        />
      );

      fireEvent.click(screen.getByTestId('comment-button'));

      expect(mockOnActivityClick).not.toHaveBeenCalled();
    });

    it('should not throw when onActivityClick is not provided', () => {
      const activity = createMockActivity();

      render(<ActivityEventFooter isForFeedTab activity={activity} />);

      expect(() => {
        fireEvent.click(screen.getByTestId('comment-button'));
      }).not.toThrow();
    });
  });

  describe('Reactions', () => {
    it('should call updateActivityReaction when adding a reaction', async () => {
      const activity = createMockActivity();

      render(<ActivityEventFooter activity={activity} />);

      fireEvent.click(screen.getByTestId('add-reaction-btn'));

      await waitFor(() => {
        expect(mockUpdateActivityReaction).toHaveBeenCalledWith(
          'activity-123',
          ReactionType.ThumbsUp,
          ReactionOperation.ADD
        );
      });
    });

    it('should call updateActivityReaction when removing a reaction', async () => {
      const activity = createMockActivity();

      render(<ActivityEventFooter activity={activity} />);

      fireEvent.click(screen.getByTestId('remove-reaction-btn'));

      await waitFor(() => {
        expect(mockUpdateActivityReaction).toHaveBeenCalledWith(
          'activity-123',
          ReactionType.ThumbsUp,
          ReactionOperation.REMOVE
        );
      });
    });

    it('should NOT call updateActivityReaction when activity has no id', async () => {
      const activity = createMockActivity({ id: undefined });

      render(<ActivityEventFooter activity={activity} />);

      fireEvent.click(screen.getByTestId('add-reaction-btn'));

      await waitFor(() => {
        expect(mockUpdateActivityReaction).not.toHaveBeenCalled();
      });
    });

    it('should handle empty reactions array', () => {
      const activity = createMockActivity({ reactions: [] });

      render(<ActivityEventFooter activity={activity} />);

      expect(screen.getByTestId('reactions-count')).toHaveTextContent('0');
    });

    it('should handle undefined reactions', () => {
      const activity = createMockActivity({ reactions: undefined });

      render(<ActivityEventFooter activity={activity} />);

      expect(screen.getByTestId('reactions-count')).toHaveTextContent('0');
    });
  });
});

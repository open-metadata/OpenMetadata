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
import { act, render, renderHook, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import {
  LabelType,
  State,
  TagSource,
  type TagLabel,
} from '../../../generated/type/tagLabel';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import {
  useTagsUpdateHandler,
  useTierSplit,
  useUpdatedEntityData,
} from './CommonWidgets.hooks';
import { GenericEntity } from './CommonWidgets.types';

jest.mock('../../Customization/GenericProvider/GenericContext');

jest.mock('../../../utils/EntityVersionUtilsPure', () => ({
  getEntityVersionByField: jest.fn(
    (_: unknown, field: string, value: string) => `diff:${field}:${value}`
  ),
  getEntityVersionTags: jest.fn(() => [{ tagFQN: 'diff.tag' }]),
}));

jest.mock(
  '../../Glossary/GlossaryUpdateConfirmationModal/GlossaryUpdateConfirmationModal',
  () => ({
    GlossaryUpdateConfirmationModal: ({
      onCancel,
      onValidationSuccess,
    }: {
      onCancel: () => void;
      onValidationSuccess: () => void;
    }) => (
      <div data-testid="glossary-confirmation-modal">
        <button onClick={onValidationSuccess}>confirm</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    ),
  })
);

const tier: TagLabel = {
  tagFQN: 'Tier.Tier1',
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
};
const pii: TagLabel = {
  tagFQN: 'PII.Sensitive',
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Suggested,
};

const entity = {
  id: 'id-1',
  name: 'orders',
  displayName: 'Orders',
  description: 'desc',
  tags: [tier, pii],
  changeDescription: {},
} as unknown as GenericEntity;

const mockOnUpdate = jest.fn();

const mockContext = (type: EntityType) =>
  (useGenericContext as jest.Mock).mockReturnValue({
    type,
    onUpdate: mockOnUpdate,
  });

const TagsHarness = () => {
  const { onTagsChange, confirmationModal } = useTagsUpdateHandler(
    entity,
    tier,
    entity
  );

  return (
    <>
      <button onClick={() => onTagsChange([pii])}>change tags</button>
      {confirmationModal}
    </>
  );
};

describe('CommonWidgets hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useUpdatedEntityData', () => {
    it('returns the entity as-is outside version view', () => {
      const { result } = renderHook(() => useUpdatedEntityData(entity, false));

      expect(result.current).toBe(entity);
    });

    it('applies version diffs to description, name, display name and tags in version view', () => {
      const { result } = renderHook(() => useUpdatedEntityData(entity, true));

      expect(result.current).toEqual(
        expect.objectContaining({
          description: 'diff:description:desc',
          name: 'diff:name:orders',
          displayName: 'diff:displayName:Orders',
          tags: [{ tagFQN: 'diff.tag' }],
        })
      );
    });
  });

  describe('useTierSplit', () => {
    it('separates the tier tag from the other tags', () => {
      const { result } = renderHook(() => useTierSplit(entity));

      expect(result.current).toEqual({ tier, tags: [pii] });
    });

    it('handles an entity without tags', () => {
      const { result } = renderHook(() =>
        useTierSplit({ ...entity, tags: undefined })
      );

      expect(result.current).toEqual({ tier: undefined, tags: [] });
    });
  });

  describe('useTagsUpdateHandler', () => {
    it('saves the selected tags immediately and keeps the tier for non-glossary entities', async () => {
      mockContext(EntityType.TABLE);
      render(<TagsHarness />);

      await act(async () => {
        screen.getByText('change tags').click();
      });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        ...entity,
        tags: [tier, { ...pii, state: State.Confirmed }],
      });
      expect(
        screen.queryByTestId('glossary-confirmation-modal')
      ).not.toBeInTheDocument();
    });

    it('asks for confirmation before saving tags on a glossary term', async () => {
      mockContext(EntityType.GLOSSARY_TERM);
      render(<TagsHarness />);

      await act(async () => {
        screen.getByText('change tags').click();
      });

      expect(mockOnUpdate).not.toHaveBeenCalled();

      await act(async () => {
        (await screen.findByText('confirm')).click();
      });

      expect(mockOnUpdate).toHaveBeenCalledWith({
        ...entity,
        tags: [tier, { ...pii, state: State.Confirmed }],
      });
    });

    it('drops the pending glossary tags when the confirmation is cancelled', async () => {
      mockContext(EntityType.GLOSSARY_TERM);
      render(<TagsHarness />);

      await act(async () => {
        screen.getByText('change tags').click();
      });

      await act(async () => {
        (await screen.findByText('cancel')).click();
      });

      expect(
        screen.queryByTestId('glossary-confirmation-modal')
      ).not.toBeInTheDocument();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });
});

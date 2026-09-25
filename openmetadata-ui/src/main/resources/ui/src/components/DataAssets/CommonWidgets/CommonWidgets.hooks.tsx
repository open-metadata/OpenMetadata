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
import { EntityTags } from 'Models';
import { lazy, ReactNode, useCallback, useMemo, useState } from 'react';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { VersionEntityTypes } from '../../../utils/EntityVersionUtils.interface';
import {
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtilsPure';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TablePureUtils';
import { createTagObject } from '../../../utils/TagsPureUtils';
import withSuspenseFallback, {
  TAB_CONTENT_FALLBACK,
} from '../../AppRouter/withSuspenseFallback';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { GenericEntity } from './CommonWidgets.types';

const GlossaryUpdateConfirmationModal = withSuspenseFallback(
  lazy(() =>
    import(
      '../../Glossary/GlossaryUpdateConfirmationModal/GlossaryUpdateConfirmationModal'
    ).then((m) => ({ default: m.GlossaryUpdateConfirmationModal }))
  ),
  TAB_CONTENT_FALLBACK
);

/**
 * Returns the entity data with version-aware fallbacks applied to the fields
 * the description/tag/name widgets read. In non-version views this is `data`
 * pass-through; in version views the change-description drives the diff.
 */
export const useUpdatedEntityData = (
  data: GenericEntity,
  isVersionView: boolean | undefined
): GenericEntity => {
  return useMemo(() => {
    if (!isVersionView) {
      return data;
    }

    return {
      ...data,
      description: getEntityVersionByField(
        data.changeDescription,
        EntityField.DESCRIPTION,
        data.description
      ),
      name: getEntityVersionByField(
        data.changeDescription,
        EntityField.NAME,
        data.name
      ),
      displayName: getEntityVersionByField(
        data.changeDescription,
        EntityField.DISPLAYNAME,
        data.displayName
      ),
      tags: getEntityVersionTags(
        data as VersionEntityTypes,
        data.changeDescription
      ),
    };
  }, [data, isVersionView]);
};

/**
 * Splits an entity's tag list into `tier` (single tier tag, or `undefined`)
 * and `tags` (every non-tier tag). Both TagsWidget and GlossaryWidget need
 * this split so update handlers can rebuild the full list while preserving
 * the current tier.
 */
export const useTierSplit = (data: GenericEntity) => {
  return useMemo(() => {
    const rawTags = data.tags ?? [];

    return {
      tier: getTierTags(rawTags),
      tags: getTagsWithoutTier(rawTags),
    };
  }, [data.tags]);
};

interface TagsUpdateHandler {
  onTagsChange: (selectedTags: EntityTags[]) => Promise<void>;
  confirmationModal: ReactNode;
}

/**
 * Wraps the "user changed tags on a tag/glossary widget" flow.
 *
 * For any non-glossary entity, the selected tags are combined with the
 * current tier and pushed straight through onUpdate. For a glossary term the
 * selection is captured in local state and a confirmation modal is rendered;
 * onUpdate only fires once the user confirms. Both TagsWidget and
 * GlossaryWidget need this exact flow, so the state and the modal live here
 * rather than being duplicated at the top level.
 */
export const useTagsUpdateHandler = (
  data: GenericEntity,
  tier: TagLabel | undefined,
  updatedData: GenericEntity
): TagsUpdateHandler => {
  const { type, onUpdate } = useGenericContext<GenericEntity>();
  const [tagsUpdating, setTagsUpdating] = useState<TagLabel[]>();

  const onTagsChange = useCallback(
    async (selectedTags: EntityTags[]) => {
      const updatedTags = createTagObject(selectedTags);

      if (type === EntityType.GLOSSARY_TERM) {
        setTagsUpdating(updatedTags);

        return;
      }

      if (updatedTags && data) {
        await onUpdate({
          ...data,
          tags: [...(tier ? [tier] : []), ...updatedTags],
        });
      }
    },
    [data, tier, type, onUpdate]
  );

  const handleConfirm = useCallback(async () => {
    if (tagsUpdating && data) {
      await onUpdate({
        ...data,
        tags: [...(tier ? [tier] : []), ...tagsUpdating],
      });
    }
  }, [data, tier, tagsUpdating, onUpdate]);

  const confirmationModal = tagsUpdating ? (
    <GlossaryUpdateConfirmationModal
      glossaryTerm={updatedData as unknown as GlossaryTerm}
      updatedTags={tagsUpdating}
      onCancel={() => setTagsUpdating(undefined)}
      onValidationSuccess={handleConfirm}
    />
  ) : null;

  return { onTagsChange, confirmationModal };
};

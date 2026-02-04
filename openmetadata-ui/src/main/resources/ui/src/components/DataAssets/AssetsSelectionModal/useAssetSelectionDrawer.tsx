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
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { useCompositeDrawer } from '../../common/atoms/drawer';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { useAssetSelectionContent } from './useAssetSelectionContent';

interface UseAssetSelectionDrawerProps {
  entityFqn: string;
  open: boolean;
  type?: AssetsOfEntity;
  queryFilter?: QueryFilterInterface;
  emptyPlaceHolderText?: string;
  infoBannerText?: string;
  title?: string;
  onSave?: () => void;
  onCancel: () => void;
}

export const useAssetSelectionDrawer = ({
  entityFqn,
  open,
  type = AssetsOfEntity.GLOSSARY,
  queryFilter,
  emptyPlaceHolderText,
  infoBannerText,
  title,
  onSave,
  onCancel,
}: UseAssetSelectionDrawerProps) => {
  const { t } = useTranslation();

  const handleSave = useCallback(() => {
    onSave?.();
    onCancel();
  }, [onSave, onCancel]);

  // Always call the hook, but content only fetches when open is true
  const { content, footer } = useAssetSelectionContent({
    entityFqn,
    type,
    queryFilter,
    emptyPlaceHolderText,
    infoBannerText,
    open,
    variant: 'drawer',
    onSave: handleSave,
    onCancel,
  });

  // Create the drawer - always mounted but content conditionally rendered
  const assetDrawer = useCompositeDrawer({
    anchor: 'right',
    width: 670,
    closeOnEscape: false,
    testId: 'asset-selection-modal',
    onClose: onCancel,
    header: {
      title:
        title ?? t('label.add-entity', { entity: t('label.asset-plural') }),
      onClose: onCancel,
    },
    body: {
      children: open ? content : null,
    },
    footer: {
      customContent: open ? footer : null,
    },
  });

  // Sync parent's open state with drawer's internal state for animation
  useEffect(() => {
    if (open) {
      assetDrawer.openDrawer();
    } else {
      assetDrawer.closeDrawer();
    }
  }, [open, assetDrawer]);

  return assetDrawer.compositeDrawer;
};

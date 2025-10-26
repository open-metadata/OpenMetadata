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
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { useAssetSelectionDrawer } from './useAssetSelectionDrawer';

interface AssetSelectionDrawerProps {
  entityFqn: string;
  open: boolean;
  type?: AssetsOfEntity;
  queryFilter?: QueryFilterInterface;
  emptyPlaceHolderText?: string;
  onSave?: () => void;
  onCancel: () => void;
}

export const AssetSelectionDrawer = ({
  entityFqn,
  open,
  type = AssetsOfEntity.GLOSSARY,
  queryFilter,
  emptyPlaceHolderText,
  onSave,
  onCancel,
}: AssetSelectionDrawerProps) => {
  return useAssetSelectionDrawer({
    entityFqn,
    open,
    type,
    queryFilter,
    emptyPlaceHolderText,
    onSave,
    onCancel,
  });
};

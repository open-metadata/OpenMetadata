/*
 *  Copyright 2026 Collate.
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceType } from '../../constants/Learning.constants';
import { useProductTourStore } from '../../hooks/useProductTourStore';
import { LearningResource } from '../../rest/learningResourceAPI';
import productTourClassBase from '../../utils/ProductTourClassBase';
import { ResourcePlayerModal } from '../Learning/ResourcePlayer/ResourcePlayerModal.component';

const PRODUCT_TOUR_RESOURCE_NAME = 'product-tour';

/**
 * The product tour: its Storylane demo in the learning resource player,
 * opened full screen. Help > Tour and the Welcome screen open it through
 * `useProductTourStore`.
 */
const ProductTourModal = () => {
  const { t } = useTranslation();
  const { isOpen, close } = useProductTourStore();

  const resource = useMemo<LearningResource>(
    () => ({
      id: PRODUCT_TOUR_RESOURCE_NAME,
      name: PRODUCT_TOUR_RESOURCE_NAME,
      displayName: t('label.product-tour'),
      resourceType: ResourceType.Storylane,
      source: { url: productTourClassBase.getTourUrl() },
      categories: [],
      contexts: [],
    }),
    [t]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <ResourcePlayerModal
      isFullScreenByDefault
      open
      isStored={false}
      resource={resource}
      onClose={close}
    />
  );
};

export default ProductTourModal;

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
import { lazy, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceType } from '../../constants/Learning.constants';
import { useProductTourStore } from '../../hooks/useProductTourStore';
import type { LearningResource } from '../../rest/learningResourceAPI';
import productTourClassBase from '../../utils/ProductTourClassBase';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';

// Its own chunk: this component is mounted in the app shell, and a static
// import would pull the whole learning player into the shell chunk.
const loadPlayer = () =>
  import('../Learning/ResourcePlayer/ResourcePlayerModal.component').then(
    (m) => ({ default: m.ResourcePlayerModal })
  );

const ResourcePlayerModal = withSuspenseFallback(lazy(loadPlayer), null);

const PRODUCT_TOUR_RESOURCE_NAME = 'product-tour';

// Where the browser has no idle callback (Safari), preload after this delay.
const PRELOAD_FALLBACK_DELAY_MS = 2000;

/**
 * Fetches the player while the app is idle, so a click opens it from cache:
 * the browser grants full screen only shortly after the click that asks for
 * it, and a player still downloading would miss that window.
 */
const usePreloadPlayer = () => {
  useEffect(() => {
    const preload = () => {
      loadPlayer().catch(() => undefined);
    };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(preload);

      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(preload, PRELOAD_FALLBACK_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);
};

/**
 * The product tour: its Storylane demo in the learning resource player,
 * opened full screen. Help > Tour and the Welcome screen open it through
 * `useProductTourStore`.
 */
const ProductTourModal = () => {
  const { t } = useTranslation();
  const { isOpen, close } = useProductTourStore();
  usePreloadPlayer();

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

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
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import { useProductTourStore } from '../../../hooks/product-tour/useProductTourStore';
import { useAppMode } from '../../../hooks/useAppMode';

/**
 * /tour, reached from Help > Tour and the Welcome screen. It only starts the
 * tour for the app mode the user is in; `ProductTour`, mounted above both
 * shells, then covers the page and replaces /tour with the first step. It
 * renders nothing but the tab title, so no loader shows before the tour's
 * mask does.
 */
const ProductTourPage = () => {
  const { t } = useTranslation();
  const currentMode = useAppMode();
  const start = useProductTourStore((state) => state.start);

  // Starting is a no-op while a tour runs, so the mode switch a tour makes
  // does not restart it.
  useEffect(() => {
    start(currentMode);
  }, [start, currentMode]);

  return <DocumentTitle title={t('label.tour')} />;
};

export default ProductTourPage;

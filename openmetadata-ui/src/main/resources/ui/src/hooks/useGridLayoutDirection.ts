/*
 *  Copyright 2024 Collate.
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

export const useGridLayoutDirection = (isLoading = false) => {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (!isLoading) {
      const gridLayoutContainer = document.querySelector('.react-grid-layout');
      const children = document.querySelectorAll('.react-grid-item');

      if (gridLayoutContainer && children) {
        // parent container should be ltr to avoid RTL issues
        gridLayoutContainer.setAttribute('dir', 'ltr');

        // children should change direction based on i18n direction
        children.forEach((child) => child.setAttribute('dir', i18n.dir()));
      }
    }
  }, [i18n, isLoading]);
};

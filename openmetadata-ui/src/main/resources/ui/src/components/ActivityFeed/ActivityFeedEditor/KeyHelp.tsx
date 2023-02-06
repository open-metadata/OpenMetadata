/*
 *  Copyright 2022 Collate.
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

import React from 'react';
import { useTranslation } from 'react-i18next';

export const KeyHelp = ({ editorValue }: { editorValue: string }) => {
  const { t } = useTranslation();

  return editorValue.length > 2 ? (
    <div className="tw-absolute tw-right-8">
      <p
        className="tw-text-grey-muted tw--mt-1"
        data-testid="key-help"
        style={{ fontSize: '10px' }}>
        <kbd>{t('label.shift')}</kbd>
        {t('label.plus-symbol')} <kbd>{t('label.return')}</kbd>{' '}
        {t('message.to-add-new-line')}
      </p>
    </div>
  ) : null;
};

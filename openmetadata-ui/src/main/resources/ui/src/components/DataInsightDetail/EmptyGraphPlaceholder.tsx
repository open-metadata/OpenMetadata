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

import { DATA_INSIGHT_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from 'enums/common.enum';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';

export const EmptyGraphPlaceholder = () => {
  const { t } = useTranslation();

  return (
    <ErrorPlaceHolder
      classes="m-t-lg"
      doc={DATA_INSIGHT_DOCS}
      heading={t('label.data-insight')}
      size={SIZE.MEDIUM}
      type={ERROR_PLACEHOLDER_TYPE.ADD}
    />
  );
};

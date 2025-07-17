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

import { RichTextEditorPreviewerV1 } from '@openmetadata/common-ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextDiffCustomProperty } from '../../../../../utils/EntityVersionUtils';
import { CustomPropertyFeedProps } from './CustomPropertyFeed.interface';

function CustomPropertyFeed({ feed }: Readonly<CustomPropertyFeedProps>) {
  const { t } = useTranslation();
  const message = useMemo(
    () =>
      getTextDiffCustomProperty(
        feed.feedInfo?.fieldName ?? '',
        feed.feedInfo?.entitySpecificInfo?.previousValue ?? '',
        feed.feedInfo?.entitySpecificInfo?.updatedValue ?? ''
      ),
    [feed]
  );

  return (
    <RichTextEditorPreviewerV1
      className="text-wrap text-grey-muted"
      i18n={t}
      markdown={message}
    />
  );
}

export default CustomPropertyFeed;

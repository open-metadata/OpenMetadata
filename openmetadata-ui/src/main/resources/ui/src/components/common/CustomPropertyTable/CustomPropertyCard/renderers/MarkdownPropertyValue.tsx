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
import { Box } from '@openmetadata/ui-core-components';
import { FormEvent, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../../../AppRouter/withSuspenseFallback';
import RichTextEditorPreviewerV1 from '../../../RichTextEditor/RichTextEditorPreviewerV1';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';

const RichTextEditor = withSuspenseFallback(
  lazy(() => import('../../../RichTextEditor/RichTextEditor'))
);

const MarkdownPropertyView = ({ value }: PropertyViewProps) => (
  <RichTextEditorPreviewerV1 enableSeeMoreVariant markdown={String(value)} />
);

const MarkdownPropertyEdit = ({
  value,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const initialValue = typeof value === 'string' ? value : '';
  const [markdown, setMarkdown] = useState(initialValue);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(markdown.trim() ? markdown : undefined);
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box direction="col" gap={2}>
        <RichTextEditor
          autofocus
          className="tw:rounded-lg tw:border tw:border-primary"
          initialValue={initialValue}
          placeHolder={t('label.enter-property-value')}
          onTextChange={setMarkdown}
        />
        <span className="tw:text-xs tw:text-tertiary">
          {t('message.markdown-supported')}
        </span>
      </Box>
    </form>
  );
};

export const markdownPropertyRenderer: CustomPropertyRenderer = {
  View: MarkdownPropertyView,
  Edit: MarkdownPropertyEdit,
  getEmptyHint: (_property, t) => t('message.add-short-note-or-description'),
};

/*
 *  Copyright 2023 Collate.
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
import { Badge } from '@openmetadata/ui-core-components';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from '../../../../generated/entity/data/container';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getFilterTags } from '../../../../utils/TableTags/TableTags.utils';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagsViewer from '../../../Tag/TagsViewer/TagsViewer';

interface ColumnSummaryProps {
  column: Column;
}

const ColumnSummary: FC<ColumnSummaryProps> = ({ column }) => {
  const { t } = useTranslation();

  const { Classification, Glossary } = useMemo(() => {
    return getFilterTags(column.tags ?? []);
  }, [column.tags]);

  return (
    <div className="tw:h-full tw:rounded-[10px] tw:border tw:border-border-secondary tw:shadow-none">
      <div className="tw:flex tw:items-center tw:gap-3 tw:p-4">
        <p className="tw:m-0 tw:text-md tw:font-medium tw:text-primary">
          {getEntityName(column)}
        </p>
        <Badge className="tw:text-xs" color="gray" size="lg" type="color">
          {column.dataType}
        </Badge>
      </div>
      <hr className="tw:my-0 tw:h-0 tw:border-0 tw:border-t tw:border-border-secondary" />
      <div className="tw:flex tw:flex-col tw:gap-3 tw:p-4">
        <RichTextEditorPreviewerV1
          className="text-grey-muted m-t-xs"
          markdown={column.description ?? ''}
          maxLength={184}
        />
        <hr className="tw:my-0 tw:h-px tw:border-t tw:border-dashed tw:border-secondary" />
        <div className="tw:grid tw:grid-cols-12 tw:gap-4">
          <div className="tw:col-span-2 tw:text-sm tw:text-secondary">
            {t('label.glossary-term-plural')}
          </div>
          <div className="tw:col-span-10">
            <TagsViewer newLook sizeCap={3} tags={Glossary ?? []} />
          </div>
          <div className="tw:col-span-2 tw:text-sm tw:text-secondary">
            {t('label.tag-plural')}
          </div>
          <div className="tw:col-span-10">
            <TagsViewer newLook sizeCap={3} tags={Classification ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnSummary;

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
import { Badge, Box, Card, Grid } from '@openmetadata/ui-core-components';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from '../../../../generated/entity/data/container';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getFilterTags } from '../../../../utils/TableTags/TableTags.utils';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagsViewer from '../../../Tag/TagsViewer/TagsViewer';

interface ColumnSummaryProps {
  column: Column;
  className?: string;
}

const ColumnSummary: FC<ColumnSummaryProps> = ({ column, className }) => {
  const { t } = useTranslation();

  const { Classification, Glossary } = useMemo(() => {
    return getFilterTags(column.tags ?? []);
  }, [column.tags]);

  return (
    <Card className={className}>
      <Card.Header
        title={
          <Box align="center" gap={3}>
            {getEntityName(column)}
            <Badge className="tw:text-xs" color="gray" size="lg" type="color">
              {column.dataType}
            </Badge>
          </Box>
        }
      />
      <Card.Content>
        <Box direction="col" gap={3}>
          <RichTextEditorPreviewerV1
            className="text-grey-muted m-t-xs"
            markdown={column.description ?? ''}
            maxLength={184}
          />
          <hr className="tw:my-0 tw:h-px tw:border-t tw:border-dashed tw:border-secondary" />
          <Grid rowGap="4">
            <Grid.Item
              className="tw:pr-2 tw:text-sm tw:text-secondary"
              span={5}>
              {t('label.glossary-term-plural')}
            </Grid.Item>
            <Grid.Item span={19}>
              <TagsViewer sizeCap={3} tags={Glossary ?? []} />
            </Grid.Item>
            <Grid.Item
              className="tw:pr-2 tw:text-sm tw:text-secondary"
              span={5}>
              {t('label.tag-plural')}
            </Grid.Item>
            <Grid.Item span={19}>
              <TagsViewer sizeCap={3} tags={Classification ?? []} />
            </Grid.Item>
          </Grid>
        </Box>
      </Card.Content>
    </Card>
  );
};

export default ColumnSummary;

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
import {
  Card,
  Divider,
  Grid,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Column } from '../../../../generated/entity/data/container';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getFilterTags } from '../../../../utils/TableTags/TableTags.utils';
import { DataPill } from '../../../common/DataPill/DataPill.styled';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagsViewer from '../../../Tag/TagsViewer/TagsViewer';

interface ColumnSummaryProps {
  column: Column;
}

const ColumnSummary: FC<ColumnSummaryProps> = ({ column }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const { Classification, Glossary } = useMemo(() => {
    return getFilterTags(column.tags ?? []);
  }, [column.tags]);

  return (
    <Card
      sx={{
        borderRadius: '10px',
        border: `1px solid ${theme.palette.grey[200]}`,
        boxShadow: 'none',
        height: '100%',
      }}>
      <Stack alignItems="center" direction="row" spacing={3} sx={{ p: 4 }}>
        <Typography
          sx={{
            fontSize: theme.typography.pxToRem(16),
            fontWeight: theme.typography.fontWeightMedium,
            color: theme.palette.grey[900],
          }}>
          {getEntityName(column)}
        </Typography>
        <DataPill
          sx={{
            border: `1px solid ${theme.palette.grey[200]}`,
            backgroundColor: theme.palette.grey[50],
            fontSize: theme.typography.pxToRem(12),
            fontWeight: theme.typography.fontWeightMedium,
            color: theme.palette.grey[700],
            p: '3px 6px',
          }}>
          {column.dataType}
        </DataPill>
      </Stack>
      <Divider />
      <Stack spacing={3} sx={{ p: 4 }}>
        <RichTextEditorPreviewerV1
          className="text-grey-muted m-t-xs"
          markdown={column.description ?? ''}
          maxLength={184}
        />
        <Divider
          sx={{
            borderStyle: 'dashed',
            borderColor: theme.palette.grey[200],
          }}
        />
        <Grid container spacing={4}>
          <Grid size={2}>{t('label.glossary-term-plural')}</Grid>
          <Grid size={10}>
            <TagsViewer newLook sizeCap={3} tags={Glossary ?? []} />
          </Grid>
          <Grid size={2}>{t('label.tag-plural')}</Grid>
          <Grid size={10}>
            <TagsViewer newLook sizeCap={3} tags={Classification ?? []} />
          </Grid>
        </Grid>
      </Stack>
    </Card>
  );
};

export default ColumnSummary;

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
import { Button, Chip, Grid, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RightArrowIcon } from '../../../../../assets/svg/right-arrow.svg';
import { ReactComponent as NoDataIcon } from '../../../../../assets/svg/ticket-with-check.svg';
import documentationLinksClassBase from '../../../../../utils/DocumentationLinksClassBase';
import './no-profiler-banner.less';

const NoProfilerBanner = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const profilerDocsLink =
    documentationLinksClassBase.getDocsURLS()
      .DATA_QUALITY_PROFILER_WORKFLOW_DOCS;

  return (
    <Grid
      container
      className="no-profiler-banner-container"
      data-testid="no-profiler-placeholder"
      spacing={4}>
      <Grid size="auto">
        <Chip
          color="secondary"
          icon={<NoDataIcon />}
          sx={{
            backgroundColor: theme.palette.allShades.white,
            height: '40px',
            width: '40px',
            borderRadius: '8px',
            '.MuiChip-icon': {
              m: 0,
            },
          }}
          variant="outlined"
        />
      </Grid>

      <Grid size={9}>
        <p className="profiler-title" data-testid="profiler-title">
          {t('message.no-profiler-title')}
        </p>
        <p className="profiler-description" data-testid="profiler-description">
          {t('message.no-profiler-message')}
        </p>
      </Grid>

      <Grid
        size="grow"
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
        <a
          data-testid="documentation-link"
          href={profilerDocsLink}
          rel="noreferrer"
          target="_blank"
          title="data quality observability profiler workflow">
          <Button
            endIcon={<RightArrowIcon />}
            sx={(theme) => ({
              color: theme.palette.primary.main,
              fontWeight: 600,
              '.MuiButton-endIcon>svg': {
                width: '12px',
                height: '12px',
              },
              '&:hover': {
                color: theme.palette.primary.main,
              },
            })}>
            {t('label.learn-more')}
          </Button>
        </a>
      </Grid>
    </Grid>
  );
};

export default NoProfilerBanner;

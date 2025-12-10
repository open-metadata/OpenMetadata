/*
 *  Copyright 2025 Collate.
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
import { Box, Divider, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DownstreamIcon } from '../../../assets/svg/lineage-downstream-icon.svg';
import { ReactComponent as UpstreamIcon } from '../../../assets/svg/lineage-upstream-icon.svg';
import Loader from '../Loader/Loader';
import { LineageSectionProps } from './LineageSection.interface';

const LineageSection: React.FC<LineageSectionProps> = ({
  upstreamCount,
  downstreamCount,
  isLoading = false,
  onLineageClick,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const handleClick = () => {
    onLineageClick?.();
  };

  const textStyles = {
    fontSize: '13px',
    fontWeight: 400,
    color: theme.palette.allShades?.info?.[700],
  };

  const sectionStyles = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  };

  const iconWrapperStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.allShades?.gray?.[600],
  };

  const renderLineageItem = (
    type: 'upstream' | 'downstream',
    Icon: React.FC<React.SVGProps<SVGSVGElement>>,
    count: number,
    gap: number
  ) => (
    <Box
      data-testid={`${type}-lineage`}
      sx={{ ...sectionStyles, gap }}
      onClick={handleClick}>
      <Box sx={iconWrapperStyles}>
        <Icon height={14} width={14} />
      </Box>
      <Stack direction="row" spacing={0.5}>
        <Typography sx={textStyles}>
          {t('label.-with-colon', { text: t(`label.${type}`) })}
        </Typography>
        <Typography data-testid={`${type}-count`} sx={textStyles}>
          {count}
        </Typography>
      </Stack>
    </Box>
  );

  if (isLoading) {
    return (
      <Box sx={{ paddingX: '14px', paddingBottom: 4 }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: '14px',
            mb: 1,
          }}>
          {t('label.lineage')}
        </Typography>
        <Box>
          <Loader size="small" />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="lineage-section"
      sx={{
        paddingX: '14px',
        paddingBottom: 4,
        borderBottom: `0.6px solid ${theme.palette.allShades?.gray?.[200]}`,
      }}>
      <Typography
        sx={{
          fontWeight: 600,
          fontSize: '13px',
          mb: 3,
        }}>
        {t('label.lineage')}
      </Typography>
      {upstreamCount === 0 && downstreamCount === 0 ? (
        <Typography
          fontSize="12px"
          color={theme.palette.allShades?.gray?.[500]}>
          {t('message.no-lineage-available')}
        </Typography>
      ) : (
        <Stack direction="row" spacing={0}>
          {renderLineageItem('upstream', UpstreamIcon, upstreamCount, 2.5)}
          <Divider
            orientation="vertical"
            flexItem
            sx={{
              alignSelf: 'center',
              height: '20px',
              borderColor: theme.palette.allShades?.gray?.[200],
            }}
          />
          <Box sx={{ ml: 4 }}>
            {renderLineageItem(
              'downstream',
              DownstreamIcon,
              downstreamCount,
              2
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
};

export default LineageSection;

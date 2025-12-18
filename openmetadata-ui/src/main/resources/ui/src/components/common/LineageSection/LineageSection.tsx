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
import {
  Box,
  ButtonBase,
  Divider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DownstreamIcon } from '../../../assets/svg/lineage-downstream-icon.svg';
import { ReactComponent as UpstreamIcon } from '../../../assets/svg/lineage-upstream-icon.svg';
import { LineagePagingInfo } from '../../../components/LineageTable/LineageTable.interface';
import { getLineagePagingData } from '../../../rest/lineageAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import { LineageSectionProps } from './LineageSection.interface';
import {
  getIconWrapperStyles,
  getSectionStyles,
  getTextStyles,
} from './LineageSection.styles';

const LineageSection: React.FC<LineageSectionProps> = ({
  entityFqn,
  entityType,
  onLineageClick,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [lineagePagingInfo, setLineagePagingInfo] =
    useState<LineagePagingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLineagePagingData = useCallback(async () => {
    if (!entityFqn || !entityType) {
      setIsLoading(false);
      setLineagePagingInfo(null);

      return;
    }

    try {
      setIsLoading(true);
      const response = await getLineagePagingData({
        fqn: entityFqn,
        type: entityType,
      });

      setLineagePagingInfo(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setLineagePagingInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [entityFqn, entityType]);

  useEffect(() => {
    fetchLineagePagingData();
  }, [fetchLineagePagingData]);

  // Get count for depth 1 entities only
  const upstreamCount =
    lineagePagingInfo?.upstreamDepthInfo?.find((info) => info.depth === 1)
      ?.entityCount ?? 0;
  const downstreamCount =
    lineagePagingInfo?.downstreamDepthInfo?.find((info) => info.depth === 1)
      ?.entityCount ?? 0;

  const handleClick = () => {
    onLineageClick?.();
  };

  const renderLineageItem = (
    type: 'upstream' | 'downstream',
    Icon: React.FC<React.SVGProps<SVGSVGElement>>,
    count: number,
    gap: number
  ) => (
    <ButtonBase
      data-testid={`${type}-lineage`}
      sx={{ ...getSectionStyles(), gap }}
      onClick={handleClick}>
      <Box sx={getIconWrapperStyles(theme)}>
        <Icon height={14} width={14} />
      </Box>
      <Stack direction="row" spacing={0.5}>
        <Typography sx={getTextStyles(theme)}>
          {t('label.-with-colon', { text: t(`label.${type}`) })}
        </Typography>
        <Typography data-testid={`${type}-count`} sx={getTextStyles(theme)}>
          {count}
        </Typography>
      </Stack>
    </ButtonBase>
  );

  return (
    <Box
      data-testid="lineage-section"
      sx={{
        paddingX: theme.spacing(3.25),
        paddingBottom: theme.spacing(4),
        borderBottom: `0.6px solid ${theme.palette.allShades?.gray?.[200]}`,
      }}>
      <Typography
        sx={{
          fontWeight: theme.typography.h1.fontWeight,
          fontSize: '13px',
          mb: theme.spacing(3),
        }}>
        {t('label.lineage')}
      </Typography>
      {isLoading ? (
        <Loader size="small" />
      ) : upstreamCount === 0 && downstreamCount === 0 ? (
        <Typography
          color={theme.palette.allShades?.gray?.[500]}
          fontSize={theme.typography.caption.fontSize}>
          {t('message.no-lineage-available')}
        </Typography>
      ) : (
        <Stack direction="row" spacing={0} width="fit-content">
          {renderLineageItem('upstream', UpstreamIcon, upstreamCount, 2.5)}
          <Divider
            flexItem
            orientation="vertical"
            sx={{
              alignSelf: 'center',
              height: theme.spacing(5),
              marginX: theme.spacing(4),
              borderColor: theme.palette.allShades?.gray?.[200],
            }}
          />
          <Box>
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

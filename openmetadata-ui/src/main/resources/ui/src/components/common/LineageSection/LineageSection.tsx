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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DownstreamIcon } from '../../../assets/svg/lineage-downstream-icon.svg';
import { ReactComponent as UpstreamIcon } from '../../../assets/svg/lineage-upstream-icon.svg';
import { LineagePagingInfo } from '../../../components/LineageTable/LineageTable.interface';
import { getLineagePagingData } from '../../../rest/lineageAPI';
import { getEntityCountAtDepth } from '../../../utils/EntityLineageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import {
  LineageItemProps,
  LineageSectionProps,
} from './LineageSection.interface';
import {
  getIconWrapperStyles,
  getSectionStyles,
  getTextStyles,
} from './LineageSection.styles';

const LineageItem = React.memo<LineageItemProps>(function LineageItem({
  type,
  Icon,
  count,
  onClick,
  sectionSx,
  iconWrapperSx,
  textSx,
}) {
  const { t } = useTranslation();

  return (
    <ButtonBase
      data-testid={`${type}-lineage`}
      sx={sectionSx}
      onClick={onClick}>
      <Box sx={iconWrapperSx}>
        <Icon height={14} width={14} />
      </Box>
      <Stack direction="row" spacing={0.5}>
        <Typography sx={textSx}>
          {t('label.-with-colon', { text: t(`label.${type}`) })}
        </Typography>
        <Typography data-testid={`${type}-count`} sx={textSx}>
          {count}
        </Typography>
      </Stack>
    </ButtonBase>
  );
});

const LineageSection: React.FC<LineageSectionProps> = ({
  entityFqn,
  entityType,
  onLineageClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [lineagePagingInfo, setLineagePagingInfo] =
    useState<LineagePagingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const latestRequestIdRef = useRef(0);

  const fetchLineagePagingData = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;

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

      // Ignore stale requests (e.g., entity changes quickly)
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      setLineagePagingInfo(response);
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      showErrorToast(error as AxiosError);
      setLineagePagingInfo(null);
    } finally {
      // Don't flip loading off if a newer request started after this one
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [entityFqn, entityType]);

  useEffect(() => {
    fetchLineagePagingData();

    // Invalidate in-flight request on unmount / dependency change
    return () => {
      latestRequestIdRef.current += 1;
    };
  }, [fetchLineagePagingData]);

  const { upstreamCount, downstreamCount } = useMemo(() => {
    // Get count for depth 1 entities only
    const upstream = getEntityCountAtDepth(
      lineagePagingInfo?.upstreamDepthInfo,
      1
    );
    const downstream = getEntityCountAtDepth(
      lineagePagingInfo?.downstreamDepthInfo,
      1
    );

    return { upstreamCount: upstream, downstreamCount: downstream };
  }, [lineagePagingInfo]);

  const hasLineage = upstreamCount > 0 || downstreamCount > 0;

  const handleClick = useCallback(() => {
    onLineageClick?.();
  }, [onLineageClick]);

  const iconWrapperSx = useMemo(() => getIconWrapperStyles(theme), [theme]);
  const textSx = useMemo(() => getTextStyles(theme), [theme]);
  const upstreamSectionSx = useMemo(() => getSectionStyles(2.5), []);
  const downstreamSectionSx = useMemo(() => getSectionStyles(2), []);

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
      ) : !hasLineage ? (
        <Typography
          color={theme.palette.allShades?.gray?.[500]}
          fontSize={theme.typography.caption.fontSize}>
          {t('message.no-lineage-available')}
        </Typography>
      ) : (
        <Stack direction="row" spacing={0} width="fit-content">
          <LineageItem
            Icon={UpstreamIcon}
            count={upstreamCount}
            iconWrapperSx={iconWrapperSx}
            sectionSx={upstreamSectionSx}
            textSx={textSx}
            type="upstream"
            onClick={handleClick}
          />
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
          <LineageItem
            Icon={DownstreamIcon}
            count={downstreamCount}
            iconWrapperSx={iconWrapperSx}
            sectionSx={downstreamSectionSx}
            textSx={textSx}
            type="downstream"
            onClick={handleClick}
          />
        </Stack>
      )}
    </Box>
  );
};

export default LineageSection;

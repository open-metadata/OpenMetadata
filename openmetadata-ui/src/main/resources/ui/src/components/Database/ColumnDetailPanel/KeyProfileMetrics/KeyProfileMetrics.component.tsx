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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Box, Chip, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { ColumnProfile } from '../../../../generated/entity/data/table';
import { getTableColumnsByFQN } from '../../../../rest/tableAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { getKeyProfileMetrics } from '../../../../utils/TableProfilerUtils';
import Loader from '../../../common/Loader/Loader';
import {
  KeyProfileMetricsProps,
  ProfileMetric,
} from './KeyProfileMetrics.interface';

export const KeyProfileMetrics = ({
  columnFqn,
  tableFqn,
}: KeyProfileMetricsProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<ColumnProfile | undefined>(undefined);

  const fetchColumnProfile = useCallback(async () => {
    if (!columnFqn || !tableFqn) {
      setProfile(undefined);
      setIsLoading(false);

      return;
    }

    try {
      setIsLoading(true);
      const response = await getTableColumnsByFQN(tableFqn, {
        fields: TabSpecificField.PROFILE,
        limit: 50,
      });

      const columnData = response.data?.find(
        (col) => col.fullyQualifiedName === columnFqn
      );

      setProfile(columnData?.profile);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setProfile(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [columnFqn, tableFqn]);

  useEffect(() => {
    fetchColumnProfile();
  }, [fetchColumnProfile]);

  const metrics: ProfileMetric[] = useMemo(
    () => getKeyProfileMetrics(profile, t),
    [profile, t]
  );

  if (isLoading) {
    return (
      <Box
        sx={{
          borderBottom: `0.6px solid ${theme.palette.allShades.gray[100]}`,
          marginTop: theme.spacing(-2),
          paddingBottom: theme.spacing(4),
          paddingX: theme.spacing(4),
        }}>
        <Typography
          sx={{
            fontSize: theme.typography.pxToRem(13),
            fontWeight: 600,
            marginBottom: theme.spacing(1.5),
          }}>
          {t('label.key-profile-metric-plural')}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing(3),
          }}>
          <Loader size="small" />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderBottom: `0.6px solid ${theme.palette.allShades.gray[100]}`,
        marginTop: theme.spacing(-2),
        paddingBottom: theme.spacing(4),
        paddingX: theme.spacing(4),
      }}>
      <Typography
        sx={{
          fontSize: theme.typography.pxToRem(13),
          fontWeight: 600,
          marginBottom: theme.spacing(1.5),
        }}>
        {t('label.key-profile-metric-plural')}
      </Typography>
      <Stack direction="row" flexWrap="nowrap" gap={2}>
        {metrics.map((metric) => (
          <Chip
            data-testid={`key-profile-metric-${metric.label}`}
            key={metric.label}
            label={
              <Stack
                spacing={0.5}
                sx={{ padding: theme.spacing(1), width: '100%' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing(0.5),
                  }}>
                  <Typography
                    sx={{
                      fontSize: theme.typography.pxToRem(12),
                      color: theme.palette.allShades.gray[600],
                      fontWeight: 500,
                    }}>
                    {metric.label}
                  </Typography>
                  {metric.tooltip && (
                    <Tooltip placement="top" title={metric.tooltip}>
                      <HelpOutlineIcon
                        sx={{
                          fontSize: theme.typography.pxToRem(10),
                          color: theme.palette.allShades.gray[600],
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: theme.typography.pxToRem(16),
                    fontWeight: 600,
                    color: theme.palette.allShades.gray[900],
                  }}>
                  {metric.value}
                </Typography>
              </Stack>
            }
            sx={{
              flex: 1,
              height: 'auto',
              backgroundColor: theme.palette.allShades.gray[50],
              borderRadius: theme.spacing(1),
              border: 'none',
              padding: theme.spacing(1),
              '& .MuiChip-label': {
                padding: 0,
                overflow: 'visible',
                width: '100%',
              },
            }}
            variant="filled"
          />
        ))}
      </Stack>
    </Box>
  );
};

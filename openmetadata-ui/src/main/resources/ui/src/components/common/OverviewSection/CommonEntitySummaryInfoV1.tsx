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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Box, Typography } from '@mui/material';
import { isNil } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ICON_DIMENSION } from '../../../constants/constants';
import {
  CommonEntitySummaryInfoV1Props,
  EntityInfoItemV1,
} from './CommonEntitySummaryInfoV1.interface';

const CommonEntitySummaryInfoV1: React.FC<CommonEntitySummaryInfoV1Props> = ({
  entityInfo,
  componentType,
  isDomainVisible = false,
  excludedItems = [],
  onLinkClick,
}) => {
  const { t } = useTranslation();

  const visibleEntityInfo = useMemo(() => {
    return entityInfo.filter((info) => {
      if (excludedItems.includes(info.name)) {
        return false;
      }

      const isDomain =
        isDomainVisible && info.name === t('label.domain-plural');

      // If componentType is empty and item has no visible field, show it
      // Otherwise, check if componentType is included in visible array
      const hasVisibleField =
        info.visible !== undefined && info.visible.length > 0;
      const isVisibleInComponent =
        componentType === '' && !hasVisibleField
          ? true
          : (info.visible ?? []).includes(componentType);

      return isVisibleInComponent || isDomain;
    });
  }, [entityInfo, componentType, isDomainVisible, excludedItems]);

  const renderInfoValue = (info: EntityInfoItemV1) => {
    if (!info.isLink) {
      return isNil(info.value) ? '-' : info.value;
    }

    if (info.isExternal && info.value !== '-') {
      return (
        <Box
          component="a"
          href={info.url}
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
          target="_blank">
          {info.value}
          <Icon
            component={IconExternalLink}
            data-testid="external-link-icon"
            style={{ ...ICON_DIMENSION, marginLeft: '4px' }}
          />
        </Box>
      );
    }

    return (
      <Box
        component={Link}
        sx={{
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
        to={info.linkProps ?? info.url ?? ''}
        onClick={onLinkClick}>
        {info.value}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
      {visibleEntityInfo.length === 0 ? (
        <Box
          sx={{
            gap: '16px',
            wordBreak: 'break-word',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            minHeight: '20px',
          }}>
          <Typography data-testid="no-data-placeholder">
            {t('label.no-overview-available')}
          </Typography>
        </Box>
      ) : (
        visibleEntityInfo.map((info) => (
          <Box
            key={info.name}
            sx={{
              gap: '16px',
              wordBreak: 'break-word',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              minHeight: '20px',
            }}>
            <Box
              component="span"
              data-testid={`${info.name}-label`}
              sx={{
                fontWeight: 400,
                color: (theme) => theme.palette.allShades.gray[700],
                fontSize: '13px',
                textAlign: 'left',
                flexShrink: 0,
                width: '120px',
              }}>
              {info.name}
            </Box>
            <Box
              component="span"
              data-testid={`${info.name}-value`}
              sx={{
                color: (theme) => theme.palette.allShades.gray[900],
                fontWeight: 500,
                fontSize: '13px',
                textAlign: 'left',
                flex: 1,
              }}>
              {renderInfoValue(info)}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
};

export default CommonEntitySummaryInfoV1;

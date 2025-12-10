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

import { Box, Link, useTheme } from '@mui/material';
import { Tooltip } from 'antd';
import { getTextFromHtmlString } from '../../../utils/BlockEditorUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import { EntityTitleSectionProps } from './EntityTitleSection.interface';

export const EntityTitleSection = ({
  entityDetails,
  entityLink,
  tooltipPlacement = 'topLeft',
  testId = 'entity-link',
  className = '',
}: EntityTitleSectionProps) => {
  const theme = useTheme();
  const entityName = getEntityName(entityDetails);
  const entityType = entityDetails.entityType ?? '';
  const linkHref =
    typeof entityLink === 'string' ? entityLink : entityLink.pathname;

  return (
    <Box
      className={className}
      sx={{
        position: 'sticky',
        padding: '4px',
        zIndex: 999,
        top: 0,
        flex: 1,
        backgroundColor: theme.palette.background.paper,
        ...(className.includes('drawer-title-section') && {
          backgroundColor: 'transparent',
        }),
      }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '8px',
          height: '46px',
          paddingLeft: '4px',
          paddingRight: '4px',
          backgroundColor: theme.palette.allShades.blueGray[50],
        }}>
        <Tooltip
          mouseEnterDelay={0.5}
          placement={tooltipPlacement}
          title={getTextFromHtmlString(entityName)}
          trigger="hover">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}>
            <Box
              sx={{
                color: theme.palette.allShades.blue[600],
                width: '18px',
                height: '18px',
                marginLeft: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 0,
                marginRight: '8px',
              }}>
              {searchClassBase.getEntityIcon(entityType)}
            </Box>
            <Link
              data-testid={testId}
              href={linkHref}
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                fontSize: '15px',
                cursor: 'pointer',
                fontWeight: 600,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                color: theme.palette.allShades.blue[700],
                display: 'block',
                '& .text-highlighter': {
                  color: theme.palette.allShades.blue[700],
                },
              }}
              underline="hover">
              {stringToHTML(entityName)}
            </Link>
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

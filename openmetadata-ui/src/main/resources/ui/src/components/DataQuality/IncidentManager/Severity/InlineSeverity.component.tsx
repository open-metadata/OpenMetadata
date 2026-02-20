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

import { Box, Chip, Divider, Menu, MenuItem } from '@mui/material';
import {
  ChevronDown as ArrowDownIcon,
  ChevronUp as ArrowUpIcon,
} from '@untitledui/icons';
import classNames from 'classnames';
import { startCase, toLower } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEVERITY_COLORS } from '../../../../constants/Color.constants';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import { InlineSeverityProps } from './Severity.interface';

const InlineSeverity = ({
  severity,
  hasEditPermission,
  onSubmit,
}: InlineSeverityProps) => {
  const { t } = useTranslation();
  const chipRef = React.useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const severityColor = severity
    ? SEVERITY_COLORS[severity] || SEVERITY_COLORS.NoSeverity
    : SEVERITY_COLORS.NoSeverity;

  const handleSeverityClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!hasEditPermission) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();

    if (chipRef.current) {
      setAnchorEl(chipRef.current);
      setShowMenu(true);
    }
  };

  const handleCloseMenu = useCallback(() => {
    setShowMenu(false);
    setAnchorEl(null);
  }, []);

  const handleSeverityChange = useCallback(
    async (newSeverity: Severities | undefined) => {
      setShowMenu(false);
      setAnchorEl(null);
      setIsLoading(true);

      try {
        await onSubmit?.(newSeverity);
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit]
  );

  const dropdownIcon = useMemo(() => {
    if (!hasEditPermission) {
      return undefined;
    }

    return showMenu ? <ArrowUpIcon /> : <ArrowDownIcon />;
  }, [hasEditPermission, showMenu]);

  return (
    <Box ref={chipRef} sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Chip
        className={classNames('severity', severity && toLower(severity))}
        deleteIcon={dropdownIcon}
        disabled={isLoading}
        label={severity ? startCase(severity) : 'No Severity'}
        sx={{
          px: 1,
          backgroundColor: severityColor.bg,
          color: severityColor.color,
          border: `1px solid ${severityColor.color}`,
          borderRadius: '16px',
          fontWeight: 500,
          fontSize: '12px',
          cursor: hasEditPermission ? 'pointer' : 'default',
          '& .MuiChip-label': {
            px: 1,
          },
          '& .MuiChip-deleteIcon': {
            color: severityColor.color,
            fontSize: '16px',
            margin: '0 4px 0 -4px',
            height: '16px',
            width: '16px',
          },
          '&:hover': {
            backgroundColor: severityColor.bg,
            color: severityColor.color,
            opacity: 0.8,
          },
        }}
        onClick={handleSeverityClick}
        onDelete={hasEditPermission ? handleSeverityClick : undefined}
      />

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        open={showMenu}
        sx={{
          '.MuiPaper-root': {
            width: 'max-content',
          },
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        onClose={handleCloseMenu}>
        <MenuItem
          selected={!severity}
          sx={{
            minWidth: 150,
            fontWeight: severity ? 400 : 600,
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            },
          }}
          onClick={() => handleSeverityChange(undefined)}>
          {t('label.no-entity', { entity: t('label.severity') })}
        </MenuItem>
        <Divider />
        {Object.values(Severities).map((sev) => (
          <MenuItem
            key={sev}
            selected={sev === severity}
            sx={{
              minWidth: 150,
              fontWeight: sev === severity ? 600 : 400,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              },
            }}
            onClick={() => handleSeverityChange(sev)}>
            {startCase(sev)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default InlineSeverity;

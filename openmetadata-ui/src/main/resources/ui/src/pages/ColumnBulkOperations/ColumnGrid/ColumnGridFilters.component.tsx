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
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MUITextField from '../../../components/common/MUITextField/MUITextField';
import { ColumnGridFilters } from './ColumnGrid.interface';

interface ColumnGridFiltersProps {
  filters: ColumnGridFilters;
  onChange: (filters: ColumnGridFilters) => void;
}

const ColumnGridFiltersComponent: React.FC<ColumnGridFiltersProps> = ({
  filters,
  onChange,
}) => {
  const { t } = useTranslation();
  const [formValues, setFormValues] = useState<ColumnGridFilters>(filters);

  const handleFieldChange = useCallback(
    (field: keyof ColumnGridFilters, value: string | string[]) => {
      const newValues = { ...formValues, [field]: value };
      setFormValues(newValues);
    },
    [formValues]
  );

  const handleApplyFilters = useCallback(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  const handleResetFilters = useCallback(() => {
    const emptyFilters: ColumnGridFilters = {};
    setFormValues(emptyFilters);
    onChange(emptyFilters);
  }, [onChange]);

  const entityTypeOptions = [
    { label: t('label.table'), value: 'table' },
    { label: t('label.dashboard'), value: 'dashboard' },
    { label: t('label.topic'), value: 'topic' },
    { label: t('label.container'), value: 'container' },
    { label: t('label.search-index'), value: 'search_index' },
  ];

  return (
    <Card>
      <CardContent>
        <Stack useFlexGap direction="row" flexWrap="wrap" spacing={2}>
          <Box sx={{ minWidth: '200px' }}>
            <MUITextField
              fullWidth
              label={t('label.column-name-pattern')}
              placeholder={t('message.column-name-pattern-placeholder')}
              size="small"
              value={formValues.columnNamePattern || ''}
              onChange={(e) =>
                handleFieldChange('columnNamePattern', e.target.value)
              }
            />
          </Box>
          <Box sx={{ minWidth: '200px' }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('label.entity-type-plural')}</InputLabel>
              <Select
                multiple
                label={t('label.entity-type-plural')}
                renderValue={(selected) => {
                  if (!selected || selected.length === 0) {
                    return (
                      <Typography color="text.secondary">
                        {t('label.select-field', {
                          field: t('label.entity-type-plural'),
                        })}
                      </Typography>
                    );
                  }

                  return (selected as string[])
                    .map(
                      (val) =>
                        entityTypeOptions.find((opt) => opt.value === val)
                          ?.label || val
                    )
                    .join(', ');
                }}
                value={formValues.entityTypes || []}
                onChange={(e) =>
                  handleFieldChange('entityTypes', e.target.value)
                }>
                {entityTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ minWidth: '180px' }}>
            <MUITextField
              fullWidth
              label={t('label.service')}
              placeholder={t('label.select-field', {
                field: t('label.service'),
              })}
              size="small"
              value={formValues.serviceName || ''}
              onChange={(e) => handleFieldChange('serviceName', e.target.value)}
            />
          </Box>
          <Box sx={{ minWidth: '180px' }}>
            <MUITextField
              fullWidth
              label={t('label.database')}
              placeholder={t('label.select-field', {
                field: t('label.database'),
              })}
              size="small"
              value={formValues.databaseName || ''}
              onChange={(e) =>
                handleFieldChange('databaseName', e.target.value)
              }
            />
          </Box>
          <Box sx={{ minWidth: '180px' }}>
            <MUITextField
              fullWidth
              label={t('label.schema')}
              placeholder={t('label.select-field', {
                field: t('label.schema'),
              })}
              size="small"
              value={formValues.schemaName || ''}
              onChange={(e) => handleFieldChange('schemaName', e.target.value)}
            />
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleApplyFilters}>
              {t('label.apply-filter-plural')}
            </Button>
            <Button variant="outlined" onClick={handleResetFilters}>
              {t('label.reset')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ColumnGridFiltersComponent;

/*
 *  Copyright 2024 Collate.
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

import { InputAdornment, TextField, useTheme } from '@mui/material';
import { SearchLg } from '@untitledui/icons';
import { debounce } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SearchConfig {
  searchPlaceholder: string;
  onSearchChange: (query: string) => void;
  initialSearchQuery?: string;
  customStyles?: Record<string, string | number>;
  testId?: string;
}

export const useSearch = (config: SearchConfig) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState(
    config.initialSearchQuery || ''
  );

  // Create debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        config.onSearchChange(query);
      }, 300), // 300ms delay
    [config.onSearchChange]
  );

  const handleInputChange = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query); // Trigger debounced search
  };

  const handleSearchChange = handleInputChange; // For backwards compatibility

  const clearSearch = () => {
    setSearchQuery('');
    debouncedSearch('');
  };

  // Inline implementation copying exact EntitySearchBox styling
  const search = useMemo(
    () => (
      <TextField
        placeholder={config.searchPlaceholder || t('label.search')}
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchLg
                  style={{
                    color: theme.palette.allShades?.gray?.[725],
                    width: 16,
                    height: 16,
                  }}
                />
              </InputAdornment>
            ),
          },
          htmlInput: config.testId ? { 'data-testid': config.testId } : {},
        }}
        sx={{
          width: config.customStyles?.searchBoxWidth ?? 354,
          '& .MuiOutlinedInput-root': {
            width: '100%',
            backgroundColor: theme.palette.allShades?.blueGray?.[40],
            boxShadow: 'none !important',
            border: `1px solid ${theme.palette.allShades?.blueGray?.[200]} !important`,
            borderRadius: '10px',
            '& .MuiOutlinedInput-input': {
              fontSize: '14px !important',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
            '&:hover': {
              border: `1px solid ${theme.palette.allShades?.blueGray?.[200]} !important`,
            },
            '&.Mui-focused': {
              border: `1px solid ${theme.palette.allShades?.blueGray?.[200]} !important`,
              outline: 'none',
            },
          },
        }}
        value={searchQuery}
        onChange={(e) => handleInputChange(e.target.value)}
      />
    ),
    [searchQuery, config.searchPlaceholder, theme, t, handleInputChange]
  );

  return {
    search,
    searchQuery,
    handleSearchChange,
    clearSearch,
  };
};

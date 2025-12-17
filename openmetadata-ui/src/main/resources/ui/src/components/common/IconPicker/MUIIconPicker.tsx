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

import {
  Box,
  ClickAwayListener,
  FormControl,
  FormLabel,
  Paper,
  Popper,
  Tab,
  Tabs,
  TextField,
  useTheme,
} from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderIcon } from '../../../utils/IconUtils';
import { useSearch } from '../atoms/navigation/useSearch';
import { AVAILABLE_ICONS, DEFAULT_ICON_NAME } from './IconPicker.constants';
import {
  IconPickerTabValue,
  IconPickerValue,
  MUIIconPickerProps,
} from './IconPicker.interface';

const MUIIconPicker: FC<MUIIconPickerProps> = ({
  allowUrl = true,
  backgroundColor,
  disabled = false,
  label,
  placeholder = 'Enter icon URL',
  value,
  toolTip,
  defaultIcon,
  onChange,
  customStyles,
  dataTestId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const resolvedIconName = defaultIcon?.name || DEFAULT_ICON_NAME;

  const parseValue = (val: string | IconPickerValue | undefined) => {
    if (!val) {
      return { type: 'icons' as IconPickerTabValue, value: resolvedIconName };
    }
    if (typeof val === 'string') {
      if (val.startsWith('http') || val.startsWith('/')) {
        return { type: 'url' as IconPickerTabValue, value: val };
      }

      return { type: 'icons' as IconPickerTabValue, value: val };
    }

    return val;
  };

  const parsedValue = parseValue(value);
  const [activeTab, setActiveTab] = useState<IconPickerTabValue>(
    parsedValue.type
  );
  const [urlValue, setUrlValue] = useState(
    parsedValue.type === 'url' ? parsedValue.value : ''
  );

  // Update urlValue when value prop changes
  useEffect(() => {
    const newParsedValue = parseValue(value);
    if (newParsedValue.type === 'url') {
      setUrlValue(newParsedValue.value);
      setActiveTab('url');
    } else {
      setActiveTab('icons');
    }
  }, [value]);

  // Use the search hook from atoms
  const { search } = useSearch({
    searchPlaceholder: t('label.search'),
    onSearchChange: setSearchQuery,
    initialSearchQuery: '',
    customStyles,
  });

  const filteredIcons = searchQuery
    ? AVAILABLE_ICONS.filter((icon) =>
        icon.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : AVAILABLE_ICONS;

  const handleIconSelect = (iconName: string) => {
    if (onChange) {
      onChange(iconName);
    }
    setOpen(false);
  };

  const handleUrlChange = (url: string) => {
    setUrlValue(url);
    if (onChange && url) {
      onChange(url);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue as IconPickerTabValue);
  };

  const handleToggle = () => {
    if (!disabled) {
      setOpen(!open);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const selectedIcon =
    parsedValue.type === 'icons' ? parsedValue.value : undefined;

  return (
    <FormControl component="fieldset" disabled={disabled}>
      {label && (
        <Box sx={{ display: 'inline-flex', gap: '2px' }}>
          <FormLabel>{label}</FormLabel>
          {toolTip}
        </Box>
      )}

      {/* Inline icon display - just a box */}
      <Box
        data-testid={dataTestId}
        ref={anchorRef}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: '4px',
          backgroundColor: backgroundColor || theme.palette.primary?.main,
          color: 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: disabled
              ? undefined
              : backgroundColor || theme.palette.primary?.dark,
          },
          '&:focus-visible': {
            outline: `2px solid ${
              backgroundColor || theme.palette.primary?.main
            }`,
            outlineOffset: '2px',
          },
        }}
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}>
        {renderIcon(parsedValue.value, {
          size: 24,
          strokeWidth: 1.5,
        })}
      </Box>

      {/* Popper with icon selection */}
      <Popper
        anchorEl={anchorRef.current}
        open={open}
        placement="bottom-start"
        style={{ zIndex: 1300 }}>
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            elevation={0}
            sx={{
              mt: 1,
              width: 400,
              maxHeight: 500,
              overflow: 'hidden',
              border: `1px solid ${theme.palette.grey?.[300]}`,
              borderRadius: '8px',
              boxShadow:
                '0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03)',
            }}>
            {allowUrl && (
              <Tabs
                sx={{
                  borderBottom: `1px solid ${theme.palette.grey?.[200]}`,
                  minHeight: 42,
                  '& .MuiTabs-scroller': {
                    border: 'none !important',
                  },
                  '& .MuiTab-root': {
                    minHeight: 42,
                    textTransform: 'capitalize',
                  },
                }}
                value={activeTab}
                onChange={handleTabChange}>
                <Tab label={t('label.icon-plural')} value="icons" />
                <Tab label={t('label.url')} value="url" />
              </Tabs>
            )}

            {activeTab === 'icons' ? (
              <Box sx={{ p: 4 }}>
                {/* Search field */}
                <Box sx={{ mb: 2 }}>{search}</Box>

                {/* Default icon section */}
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      mb: 1.5,
                    }}>
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: theme.palette.grey?.[900],
                      }}>
                      {t('label.default')}
                    </Box>
                  </Box>

                  <Box
                    aria-label={`Select icon ${resolvedIconName}`}
                    role="button"
                    sx={{
                      position: 'relative',
                      width: 36,
                      height: 36,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: 'transparent',
                      color:
                        selectedIcon === resolvedIconName
                          ? theme.palette.primary?.main
                          : theme.palette.grey?.[700],
                      '&:hover': {
                        backgroundColor: theme.palette.grey?.[100],
                      },
                      mb: 2,
                    }}
                    tabIndex={0}
                    onClick={() => handleIconSelect(resolvedIconName)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleIconSelect(resolvedIconName);
                      }
                    }}>
                    {(defaultIcon?.component || AVAILABLE_ICONS[0].component)({
                      size: 20,
                      style: { display: 'block', strokeWidth: 1.25 },
                    })}
                  </Box>
                </Box>

                {/* Icons grid */}
                {filteredIcons.length > 0 && (
                  <>
                    <Box
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: theme.palette.grey?.[900],
                        mb: 1.5,
                      }}>
                      {t('label.icon-plural')}
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(36px, 1fr))',
                        gap: '0',
                        maxHeight: '250px',
                        overflowY: 'auto',
                      }}>
                      {filteredIcons.slice(0).map((icon) => {
                        const IconComponent = icon.component;
                        const isSelected = selectedIcon === icon.name;

                        return (
                          <Box
                            aria-label={`Select icon ${icon.name}`}
                            aria-pressed={isSelected}
                            key={icon.name}
                            role="button"
                            sx={{
                              position: 'relative',
                              width: 36,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              backgroundColor: 'transparent',
                              color: isSelected
                                ? theme.palette.primary?.main
                                : theme.palette.grey?.[700],
                              '&:hover': {
                                backgroundColor: theme.palette.grey?.[100],
                              },
                            }}
                            tabIndex={0}
                            onClick={() => handleIconSelect(icon.name)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleIconSelect(icon.name);
                              }
                            }}>
                            <IconComponent
                              size={20}
                              style={{ display: 'block', strokeWidth: 1.25 }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ p: 2 }}>
                <TextField
                  fullWidth
                  placeholder={placeholder}
                  size="small"
                  value={urlValue}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
              </Box>
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </FormControl>
  );
};

export default MUIIconPicker;

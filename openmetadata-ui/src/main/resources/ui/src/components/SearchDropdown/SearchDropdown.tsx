/*
 *  Copyright 2022 Collate.
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
  Button,
  Card,
  Col,
  Divider,
  Dropdown,
  Input,
  MenuItemProps,
  MenuProps,
  Row,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { debounce, isEmpty, isUndefined } from 'lodash';
import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDown } from '../../assets/svg/DropDown.svg';
import { tabsInfo } from '../../constants/explore.constants';
import {
  generateSearchDropdownLabel,
  getSearchDropdownLabels,
  getSelectedOptionLabelString,
} from '../../utils/AdvancedSearchUtils';
import Loader from '../Loader/Loader';
import {
  SearchDropdownOption,
  SearchDropdownProps,
} from './SearchDropdown.interface';
import './SearchDropdown.less';

const SearchDropdown: FC<SearchDropdownProps> = ({
  isSuggestionsLoading,
  label,
  options,
  searchKey,
  selectedKeys,
  highlight = false,
  showProfilePicture = false,
  fixedOrderOptions = false,
  onChange,
  onGetInitialOptions,
  onSearch,
  index,
}) => {
  const { t } = useTranslation();

  const [isDropDownOpen, setIsDropDownOpen] = useState<boolean>(false);
  const [searchText, setSearchText] = useState('');
  const [selectedOptions, setSelectedOptions] =
    useState<SearchDropdownOption[]>(selectedKeys);

  // derive menu props from options and selected keys
  const menuOptions: MenuProps['items'] = useMemo(() => {
    // Filtering out selected options
    const selectedOptionsObj = options.filter((option) =>
      selectedOptions.find((selectedOpt) => option.key === selectedOpt.key)
    );

    if (fixedOrderOptions) {
      return options.map((item) => ({
        key: item.key,
        label: generateSearchDropdownLabel(
          item,
          selectedOptionsObj.indexOf(item) !== -1,
          highlight ? searchText : '',
          showProfilePicture
        ),
      }));
    } else {
      // Separating selected options to show on top
      const selectedOptionKeys =
        getSearchDropdownLabels(
          selectedOptionsObj,
          true,
          highlight ? searchText : '',
          showProfilePicture
        ) || [];

      // Filtering out unselected options
      const unselectedOptions = options.filter(
        (option) =>
          !selectedOptions.find((selectedOpt) => option.key === selectedOpt.key)
      );

      // Labels for unselected options
      const otherOptions =
        getSearchDropdownLabels(
          unselectedOptions,
          false,
          highlight ? searchText : '',
          showProfilePicture
        ) || [];

      return [...selectedOptionKeys, ...otherOptions];
    }
  }, [options, selectedOptions, fixedOrderOptions]);

  // handle menu item click
  const handleMenuItemClick: MenuItemProps['onClick'] = (info) => {
    const currentKey = info.key;
    // Find out if clicked option is present in selected key
    const selectedKey = selectedOptions.find(
      (option) => option.key === currentKey
    );

    // Get the option object for clicked option
    const option = options.find((op) => op.key === currentKey);

    // Get updated options
    const updatedValues = isUndefined(selectedKey)
      ? [...selectedOptions, ...(option ? [option] : [])]
      : selectedOptions.filter((option) => option.key !== currentKey);

    setSelectedOptions(updatedValues);
  };

  // handle clear all
  const handleClear = () => {
    setSelectedOptions([]);
  };

  // handle search
  const handleSearch = (value: string) => {
    setSearchText(value);
    onSearch(value, searchKey);
  };

  const debouncedOnSearch = debounce(handleSearch, 500);

  // Handle dropdown close
  const handleDropdownClose = () => {
    setIsDropDownOpen(false);
  };

  // Handle update button click
  const handleUpdate = () => {
    // call on change with updated value
    onChange(selectedOptions, searchKey);
    handleDropdownClose();
  };

  const showClearAllBtn = useMemo(
    () => selectedOptions.length > 1,
    [selectedOptions]
  );

  useEffect(() => {
    setSelectedOptions(selectedKeys);
  }, [isDropDownOpen, selectedKeys, options]);

  const getDropdownBody = useCallback(
    (menuNode: ReactNode) => {
      const entityLabel = index && tabsInfo[index]?.label;
      const isDomainKey = searchKey.startsWith('domain');
      if (isSuggestionsLoading) {
        return (
          <Row align="middle" className="p-y-sm" justify="center">
            <Col>
              <Loader size="small" />
            </Col>
          </Row>
        );
      }

      return options.length > 0 || selectedOptions.length > 0 ? (
        menuNode
      ) : (
        <Row align="middle" className="m-y-sm" justify="center">
          <Col>
            <Typography.Text className="m-x-sm">
              {isDomainKey && entityLabel
                ? t('message.no-domain-assigned-to-entity', {
                    entity: entityLabel,
                  })
                : t('message.no-data-available')}
            </Typography.Text>
          </Col>
        </Row>
      );
    },
    [isSuggestionsLoading, options, selectedOptions, index, searchKey]
  );

  const dropdownCardComponent = useCallback(
    (menuNode: ReactNode) => (
      <Card
        bodyStyle={{ padding: 0 }}
        className="custom-dropdown-render"
        data-testid="drop-down-menu">
        <Space direction="vertical" size={0}>
          <div className="p-t-sm p-x-sm">
            <Input
              autoFocus
              data-testid="search-input"
              placeholder={`${t('label.search-entity', {
                entity: label,
              })}...`}
              onChange={(e) => {
                const { value } = e.target;
                debouncedOnSearch(value);
              }}
            />
          </div>
          {showClearAllBtn && (
            <>
              <Divider className="m-t-xs m-b-0" />
              <Button
                className="p-0 m-l-sm"
                data-testid="clear-button"
                type="link"
                onClick={handleClear}>
                {t('label.clear-entity', {
                  entity: t('label.all'),
                })}
              </Button>
            </>
          )}
          <Divider
            className={classNames(showClearAllBtn ? 'm-y-0' : 'm-t-xs m-b-0')}
          />
          {getDropdownBody(menuNode)}
          <Space className="p-sm p-t-xss">
            <Button
              className="update-btn"
              data-testid="update-btn"
              size="small"
              onClick={handleUpdate}>
              {t('label.update')}
            </Button>
            <Button
              data-testid="close-btn"
              size="small"
              type="link"
              onClick={handleDropdownClose}>
              {t('label.close')}
            </Button>
          </Space>
        </Space>
      </Card>
    ),
    [
      label,
      debouncedOnSearch,
      showClearAllBtn,
      handleClear,
      getDropdownBody,
      handleUpdate,
      handleDropdownClose,
    ]
  );

  return (
    <Dropdown
      destroyPopupOnHide
      data-testid={searchKey}
      dropdownRender={dropdownCardComponent}
      key={searchKey}
      menu={{ items: menuOptions, onClick: handleMenuItemClick }}
      open={isDropDownOpen}
      transitionName=""
      trigger={['click']}
      onOpenChange={(visible) => {
        visible &&
          !isUndefined(onGetInitialOptions) &&
          onGetInitialOptions(searchKey);
        setIsDropDownOpen(visible);
        setSearchText('');
      }}>
      <Tooltip
        mouseLeaveDelay={0}
        overlayClassName={isEmpty(selectedKeys) ? 'd-none' : ''}
        placement="bottom"
        title={getSelectedOptionLabelString(selectedKeys, true)}
        trigger="hover">
        <Button className="quick-filter-dropdown-trigger-btn">
          <Space data-testid={`search-dropdown-${label}`} size={4}>
            <Space size={0}>
              <Typography.Text>{label}</Typography.Text>
              {selectedKeys.length > 0 && (
                <span>
                  {': '}
                  <Typography.Text className="text-primary font-medium">
                    {getSelectedOptionLabelString(selectedKeys)}
                  </Typography.Text>
                </span>
              )}
            </Space>
            <DropDown className="flex self-center" height={12} width={12} />
          </Space>
        </Button>
      </Tooltip>
    </Dropdown>
  );
};

export default SearchDropdown;

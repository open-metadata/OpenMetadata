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
  Button,
  Card,
  Checkbox,
  Col,
  Dropdown,
  Form,
  Input,
  MenuItemProps,
  Row,
  Tag,
  Typography,
} from 'antd';
import { debounce, isEmpty, isUndefined } from 'lodash';
import type { MenuInfo } from 'rc-menu/lib/interface';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../../assets/svg/arrow-down-light.svg';
import { SelectOption } from '../../../../components/common/AsyncSelectList/AsyncSelectList.interface';
import Loader from '../../../../components/common/Loader/Loader';
import { Webhook } from '../../../../generated/events/eventSubscription';
import './team-and-user-select-item.less';
import { TeamAndUserSelectItemProps } from './TeamAndUserSelectItem.interface';

function TeamAndUserSelectItem({
  entityType,
  onSearch,
  fieldName,
  destinationNumber,
}: Readonly<TeamAndUserSelectItemProps>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<Array<SelectOption>>([]);

  const selectedOptions =
    Form.useWatch<Webhook['receivers']>(['destinations', ...fieldName], form) ??
    [];

  const getOptions = useCallback(
    (options: Array<SelectOption>) => {
      return options.map(({ label, value }) => {
        const isOptionSelected = selectedOptions.indexOf(value) !== -1;

        return {
          label: (
            <Row data-testid={value} gutter={[8, 8]}>
              <Col flex="0 0 14px">
                <Checkbox
                  checked={isOptionSelected}
                  data-testid={`${label}-option-checkbox`}
                />
              </Col>
              <Col
                className="w-max-90"
                data-testid={`${label}-option-label`}
                flex="1 1 auto">
                <Typography.Text
                  ellipsis
                  className="dropdown-option-label"
                  title={label}>
                  {label}
                </Typography.Text>
              </Col>
            </Row>
          ),
          key: value,
        };
      });
    },
    [selectedOptions]
  );

  const optionsList = useMemo(() => getOptions(options), [options, getOptions]);

  // handle search
  const handleSearch = useCallback(
    async (value: string) => {
      try {
        setLoadingOptions(true);
        const searchResults = await onSearch(value);

        setOptions(searchResults);
      } catch {
        // Error
      } finally {
        setLoadingOptions(false);
      }
    },
    [onSearch]
  );

  const debouncedOnSearch = useCallback(debounce(handleSearch, 500), [
    handleSearch,
  ]);

  const dropdownCardComponent = useCallback(
    (menuNode: ReactNode) => {
      const optionsList = isEmpty(options) ? (
        <div className="p-xss text-center text-grey-muted">
          {t('label.no-data-found')}
        </div>
      ) : (
        menuNode
      );

      return (
        <Card
          bodyStyle={{ padding: 0 }}
          className="team-user-select-dropdown"
          data-testid={`team-user-select-dropdown-${destinationNumber}`}
          ref={dropdownRef}>
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <Input
                autoFocus
                data-testid="search-input"
                placeholder={t('label.search-by-type', {
                  type: entityType,
                })}
                value={searchText}
                onChange={(e) => {
                  const { value } = e.target;
                  setSearchText(value);
                }}
              />
            </Col>
            <Col span={24}>
              {loadingOptions ? (
                <Loader data-testid="loader" size="small" />
              ) : (
                optionsList
              )}
            </Col>
          </Row>
        </Card>
      );
    },
    [options, entityType, searchText, loadingOptions]
  );

  const handleMenuItemClick: MenuItemProps['onClick'] = useCallback(
    ({ key }: MenuInfo) => {
      // Find out if clicked option is present in selected key
      const selectedKey = selectedOptions.find((option) => option === key);

      // Get updated options
      const updatedValues = isUndefined(selectedKey)
        ? [...selectedOptions, key]
        : selectedOptions.filter((option) => option !== key);

      form.setFieldValue(['destinations', ...fieldName], updatedValues);
    },
    [selectedOptions]
  );

  const handleTriggerClick = useCallback(() => {
    setIsDropdownOpen((val) => !val);
  }, []);

  const handleTagClose = useCallback(
    (value: string) => {
      const updatedValues = selectedOptions.filter(
        (option) => option !== value
      );

      form.setFieldValue(['destinations', ...fieldName], updatedValues);
    },
    [selectedOptions]
  );

  useEffect(() => {
    debouncedOnSearch(searchText);
  }, [searchText, entityType]);

  useEffect(() => {
    // Controlling dropdown visibility by 'isDropdownOpen' state
    // to prevent dropdown from closing on click of menu item inside
    // Below is a function to close the dropdown when clicked outside
    const handleOutsideClick = (e: MouseEvent) => {
      const clickedOutsidePopup = !dropdownRef.current?.contains(
        e.target as Node
      );
      const clickedInsideTrigger = triggerRef.current?.contains(
        e.target as Node
      );

      // close the dropdown if clicked outside of the dropdown and not clicked inside the trigger button
      if (clickedOutsidePopup && !clickedInsideTrigger) {
        setIsDropdownOpen(false);
        setSearchText('');
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  return (
    <Dropdown
      destroyPopupOnHide
      data-testid="team-user-select-dropdown-container"
      dropdownRender={dropdownCardComponent}
      key={entityType}
      menu={{
        items: optionsList,
        onClick: handleMenuItemClick,
      }}
      open={isDropdownOpen}
      placement="bottomRight"
      trigger={['click']}>
      <Button
        className="select-trigger"
        data-testid="dropdown-trigger-button"
        ref={triggerRef}
        onClick={handleTriggerClick}>
        <Row gutter={[4, 4]}>
          {isEmpty(selectedOptions) ? (
            <Typography.Text
              className="text-sm p-l-xss text-grey-3"
              data-testid="placeholder-text">
              {t('label.please-select-entity', {
                entity: entityType,
              })}
            </Typography.Text>
          ) : (
            selectedOptions.map((option) => (
              <Col key={option}>
                <Tag
                  closable
                  className="m-0"
                  data-testid={`selected-tag-${option}`}
                  key={option}
                  onClose={() => handleTagClose(option)}>
                  {option}
                </Tag>
              </Col>
            ))
          )}
        </Row>
        <ArrowSvg className="font-small" data-testid="arrow-icon" width={16} />
      </Button>
    </Dropdown>
  );
}

export default TeamAndUserSelectItem;

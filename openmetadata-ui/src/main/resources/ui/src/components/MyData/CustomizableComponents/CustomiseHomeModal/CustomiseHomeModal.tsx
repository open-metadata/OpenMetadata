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
import Icon, { CheckOutlined } from '@ant-design/icons';
import { Button, Col, Divider, Modal, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddIcon } from '../../../../assets/svg/add-square.svg';
import { PAGE_SIZE_MEDIUM } from '../../../../constants/constants';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import {
  CustomiseHomeModalSelectedKey,
  LandingPageWidgetKeys,
} from '../../../../enums/CustomizablePage.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { getAllKnowledgePanels } from '../../../../rest/DocStoreAPI';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import HeaderTheme from '../../HeaderTheme/HeaderTheme';
import AllWidgetsContent from '../AllWidgetsContent/AllWidgetsContent';
import './customise-home-modal.less';
import { CustomiseHomeModalProps } from './CustomiseHomeModal.interface';

const CustomiseHomeModal = ({
  addedWidgetsList,
  handleAddWidget,
  onClose,
  open,
  onBackgroundColorUpdate,
  currentBackgroundColor,
  placeholderWidgetKey,
  onHomePage,
  defaultSelectedKey = CustomiseHomeModalSelectedKey.HEADER_THEME,
}: CustomiseHomeModalProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>(
    currentBackgroundColor ?? DEFAULT_HEADER_BG_COLOR
  );

  const [widgets, setWidgets] = useState<Document[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([
    ...(addedWidgetsList ?? []).filter(
      (widget) => !widget.includes(LandingPageWidgetKeys.CURATED_ASSETS)
    ),
  ]);
  const [selectedKey, setSelectedKey] = useState(defaultSelectedKey);
  const [isFetchingWidgets, setIsFetchingWidgets] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchWidgets = async () => {
    try {
      setIsFetchingWidgets(true);
      const { data } = await getAllKnowledgePanels({
        fqnPrefix: 'KnowledgePanel',
        limit: PAGE_SIZE_MEDIUM,
      });
      setWidgets(
        data.filter(
          (widget) =>
            widget.fullyQualifiedName !== LandingPageWidgetKeys.RECENTLY_VIEWED
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsFetchingWidgets(false);
    }
  };

  useEffect(() => {
    if (!onHomePage) {
      fetchWidgets();
    }
  }, [onHomePage]);

  const handleSelectWidget = (id: string) => {
    const widget = widgets.find((w) => w.id === id);
    if (!widget) {
      return;
    }
    const isAlreadyAdded = addedWidgetsList?.some(
      (addedWidgetId) =>
        addedWidgetId.startsWith(widget.fullyQualifiedName ?? '') &&
        !addedWidgetId.includes(LandingPageWidgetKeys.CURATED_ASSETS)
    );

    if (isAlreadyAdded) {
      return;
    }

    setSelectedWidgets((prev) => {
      const newSelection = prev.includes(id)
        ? prev.filter((w) => w !== id)
        : [...prev, id];

      return newSelection;
    });
  };

  const handleSidebarClick = (key: string) => {
    if (
      [
        CustomiseHomeModalSelectedKey.HEADER_THEME,
        CustomiseHomeModalSelectedKey.ALL_WIDGETS,
      ].includes(key as CustomiseHomeModalSelectedKey)
    ) {
      setSelectedKey(key as CustomiseHomeModalSelectedKey);
    } else {
      const target = contentRef.current?.querySelector(
        `[data-widget-key="${key}"]`
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const customiseOptions = useMemo(() => {
    return [
      {
        key: CustomiseHomeModalSelectedKey.HEADER_THEME,
        label: t('label.header-theme'),
        component: (
          <HeaderTheme
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
          />
        ),
      },
      ...(!onHomePage
        ? [
            {
              key: CustomiseHomeModalSelectedKey.ALL_WIDGETS,
              label: t('label.all-widgets'),
              component: (
                <AllWidgetsContent
                  addedWidgetsList={addedWidgetsList}
                  ref={contentRef}
                  selectedWidgets={selectedWidgets}
                  widgets={widgets}
                  onSelectWidget={handleSelectWidget}
                />
              ),
            },
          ]
        : []),
    ];
  }, [
    onHomePage,
    selectedColor,
    setSelectedColor,
    addedWidgetsList,
    selectedWidgets,
    widgets,
    handleSelectWidget,
  ]);

  const sidebarItems = useMemo(() => {
    return [
      ...customiseOptions.map(({ key, label }) => ({ key, label, id: '' })),
      ...(!onHomePage
        ? widgets.map((widget) => ({
            key: widget.fullyQualifiedName,
            label: widget.name,
            id: widget.id,
          }))
        : []),
    ];
  }, [customiseOptions, onHomePage, widgets]);

  const selectedComponent = useMemo(() => {
    return customiseOptions.find((item) => item.key === selectedKey)?.component;
  }, [customiseOptions, selectedKey]);

  const sidebarOptions = useMemo(() => {
    return (
      <div className="sidebar-options-container d-flex flex-column gap-2">
        {sidebarItems.map((item) => {
          const isWidgetItem = ![
            CustomiseHomeModalSelectedKey.HEADER_THEME,
            CustomiseHomeModalSelectedKey.ALL_WIDGETS,
          ].includes(item.key as CustomiseHomeModalSelectedKey);

          const isAllWidgetsTab =
            item.key === CustomiseHomeModalSelectedKey.ALL_WIDGETS;

          const isAllWidgetsSelected =
            selectedKey === CustomiseHomeModalSelectedKey.ALL_WIDGETS;

          const isSelectedWidget =
            isAllWidgetsSelected &&
            selectedWidgets.some(
              (widget) => widget.startsWith(item.key) || widget === item.id
            );

          const widgetIcon = customizeMyDataPageClassBase.getWidgetIconFromKey(
            item.key
          );

          return (
            <div
              className={classNames(
                'sidebar-option text-md font-medium border-radius-xs cursor-pointer d-flex flex-wrap items-center',
                isWidgetItem ? 'sidebar-widget-item' : '',
                selectedKey === item.key ? 'active' : '',
                isSelectedWidget ? 'selected' : ''
              )}
              data-testid={`sidebar-option-${item.key}`}
              key={item.key}
              onClick={() => handleSidebarClick(item.key)}>
              {isWidgetItem && widgetIcon && (
                <span className="sidebar-widget-icon">
                  <Icon component={widgetIcon} />
                </span>
              )}
              <span>{startCase(item.label)}</span>
              {isAllWidgetsTab && (
                <span className="widget-count text-xs border-radius-md m-l-sm">
                  {widgets.length}
                </span>
              )}
              {isSelectedWidget && (
                <span className="selected-widget-icon">
                  <CheckOutlined />
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [sidebarItems, selectedKey, handleSidebarClick, selectedWidgets]);

  const handleApply = async () => {
    try {
      setIsLoading(true);
      const colorChanged = selectedColor !== currentBackgroundColor;
      if (onBackgroundColorUpdate && colorChanged) {
        await onBackgroundColorUpdate(selectedColor);
      }

      if (handleAddWidget && selectedWidgets.length > 0) {
        selectedWidgets.forEach((widgetId) => {
          const widget = widgets.find((w) => w.id === widgetId);
          if (widget) {
            handleAddWidget(
              widget,
              placeholderWidgetKey ??
                LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
              1
            );
          }
        });
      }

      setSelectedWidgets([]);
      onClose();
    } catch (error) {
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = useMemo(() => {
    const colorChanged = selectedColor !== currentBackgroundColor;
    const widgetsSelected = selectedWidgets.length > 0;

    return colorChanged || widgetsSelected;
  }, [selectedColor, currentBackgroundColor, selectedWidgets]);

  return (
    <Modal
      centered
      className="customise-home-modal"
      footer={null}
      open={open}
      title={
        <div className="customise-home-modal-header p-box d-flex items-center gap-3">
          <Icon className="add-icon" component={AddIcon} />
          <Typography.Text className="text-xl font-semibold text-white">
            {t('label.customize-entity', {
              entity: t('label.home'),
            })}
          </Typography.Text>
        </div>
      }
      width={1800}
      onCancel={onClose}>
      <Row className="customise-home-modal-body d-flex gap-1">
        <Col className="sidebar p-box sticky top-0 self-start">
          {sidebarOptions}
        </Col>
        <Divider
          className="customise-home-modal-divider h-auto self-stretch"
          type="vertical"
        />
        <Col className="content p-box">
          {selectedKey === CustomiseHomeModalSelectedKey.ALL_WIDGETS &&
          isFetchingWidgets ? (
            <div className="d-flex justify-center items-center h-100">
              <Loader />
            </div>
          ) : (
            selectedComponent
          )}
        </Col>
      </Row>
      <Row className="customise-home-modal-footer p-box d-flex justify-end gap-3 bg-white sticky bottom-0">
        <Col className="d-flex items-center gap-4">
          <Button
            className="cancel-btn border-radius-xs font-medium text-md bg-white"
            data-testid="cancel-btn"
            onClick={onClose}>
            {t('label.cancel')}
          </Button>
          <Button
            className="apply-btn border-radius-xs font-semibold text-white text-md"
            data-testid="apply-btn"
            disabled={!hasChanges}
            loading={isLoading}
            type="primary"
            onClick={handleApply}>
            {t('label.apply')}
          </Button>
        </Col>
      </Row>
    </Modal>
  );
};

export default CustomiseHomeModal;

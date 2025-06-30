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
import Icon from '@ant-design/icons';
import { Button, Col, Divider, Modal, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddIcon } from '../../../../assets/svg/add-square.svg';
import { PAGE_SIZE_MEDIUM } from '../../../../constants/constants';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import { LandingPageWidgetKeys } from '../../../../enums/CustomizablePage.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { getAllKnowledgePanels } from '../../../../rest/DocStoreAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
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
}: CustomiseHomeModalProps) => {
  const { t } = useTranslation();
  const [selectedColor, setSelectedColor] = useState<string>(
    currentBackgroundColor ?? DEFAULT_HEADER_BG_COLOR
  );

  const [widgets, setWidgets] = useState<Document[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState('header-theme');
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchWidgets = async () => {
    try {
      const { data } = await getAllKnowledgePanels({
        fqnPrefix: 'KnowledgePanel',
        limit: PAGE_SIZE_MEDIUM,
      });
      setWidgets(
        data.filter(
          (widget) =>
            widget.fullyQualifiedName !== LandingPageWidgetKeys.ANNOUNCEMENTS &&
            widget.fullyQualifiedName !== LandingPageWidgetKeys.RECENTLY_VIEWED
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchWidgets();
  }, []);

  const handleSelectWidget = (id: string) => {
    const widget = widgets.find((w) => w.id === id);
    if (!widget) {
      return;
    }
    const isAlreadyAdded = addedWidgetsList?.some((addedWidgetId) =>
      addedWidgetId.startsWith(widget.fullyQualifiedName ?? '')
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
    if (key === 'header-theme' || key === 'all-widgets') {
      setSelectedKey(key);
    } else {
      const target = contentRef.current?.querySelector(
        `[data-widget-key="${key}"]`
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const customiseOptions = [
    {
      key: 'header-theme',
      label: t('label.header-theme'),
      component: (
        <HeaderTheme
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
        />
      ),
    },
    {
      key: 'all-widgets',
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
  ];

  const sidebarItems = [
    ...customiseOptions.map(({ key, label }) => ({ key, label })),
    ...widgets.map((widget) => ({
      key: widget.fullyQualifiedName,
      label: widget.name,
    })),
  ];

  const selectedComponent = useMemo(() => {
    return customiseOptions.find((item) => item.key === selectedKey)?.component;
  }, [customiseOptions, selectedKey]);

  const sidebarOptions = useMemo(() => {
    return (
      <>
        {sidebarItems.map((item) => {
          const isWidgetItem =
            item.key !== 'header-theme' && item.key !== 'all-widgets';

          const isAllWidgets = item.key === 'all-widgets';

          return (
            <div
              className={`sidebar-option text-md font-semibold border-radius-xs cursor-pointer d-flex flex-wrap items-center
          ${isWidgetItem ? 'sidebar-widget-item' : ''}
          ${selectedKey === item.key ? 'active' : ''}`}
              data-testid={`sidebar-option-${item.key}`}
              key={item.key}
              onClick={() => handleSidebarClick(item.key)}>
              <span>{item.label}</span>
              {isAllWidgets && (
                <span className="widget-count text-xs border-radius-md m-l-sm">
                  {widgets.length}
                </span>
              )}
            </div>
          );
        })}
      </>
    );
  }, [sidebarItems, selectedKey, handleSidebarClick]);

  const handleApply = () => {
    const colorChanged = selectedColor !== currentBackgroundColor;
    if (onBackgroundColorUpdate && colorChanged) {
      onBackgroundColorUpdate(selectedColor);
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
        <Col className="content p-box">{selectedComponent}</Col>
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

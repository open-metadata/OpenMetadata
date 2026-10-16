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
  Dialog,
  Divider,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { isAvailableMyDataWidgetKey } from '../../../../utils/CustomizeMyDataPageWidgetUtils';
import { handleKeyboardActivation } from '../../../../utils/KeyboardUtil';
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
  currentBackgroundColor = DEFAULT_HEADER_BG_COLOR,
  placeholderWidgetKey,
  onHomePage,
  defaultSelectedKey = CustomiseHomeModalSelectedKey.HEADER_THEME,
}: CustomiseHomeModalProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>(
    currentBackgroundColor
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
      const excludedWidgetFqns =
        customizeMyDataPageClassBase.getExcludedWidgetFqns();
      const pickableWidgetKeys =
        customizeMyDataPageClassBase.getPickableWidgetKeyPrefixes();
      // An allowlist off the widget registry, not a denylist of known-bad FQNs.
      // docStore holds every KnowledgePanel ever seeded — retired widgets, this
      // edition's widgets on an install of the other one — and a denylist has to
      // name each one as it appears. Anything it misses is offered to the user
      // and then renders as a blank cell, because the renderer resolves an
      // unknown key to a render-nothing component.
      setWidgets(
        data.filter((widget) =>
          isAvailableMyDataWidgetKey(
            widget.fullyQualifiedName ?? '',
            excludedWidgetFqns,
            pickableWidgetKeys
          )
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

  const handleSelectWidget = useCallback(
    (id: string) => {
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
    },
    [widgets, addedWidgetsList]
  );

  const handleSidebarClick = useCallback((key: string) => {
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
  }, []);

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
    t,
  ]);

  const sidebarItems = useMemo(() => {
    return [
      ...customiseOptions.map(({ key, label }) => ({ key, label, id: '' })),
      ...(!onHomePage
        ? widgets.map((widget) => ({
            key: widget.fullyQualifiedName,
            // `displayName` is what the seed doc calls the widget today; `name`
            // is its stable key and lags a rename. The widget on
            // `KnowledgePanel.ActivityFeed` is "Team Activity" now, so reading
            // `name` would label the new card after the one it replaced.
            //
            // Cased here rather than at the render site: `startCase` is what
            // turns the key-ish `name` into words, but it would also split an
            // already-written displayName on its capitals — "KPIs" renders as
            // "KP Is".
            label: widget.displayName ?? startCase(widget.name ?? ''),
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

          return (
            <div
              className={classNames(
                'sidebar-option text-md font-medium border-radius-xs cursor-pointer d-flex flex-wrap items-center',
                isWidgetItem
                  ? 'sidebar-widget-item tw:hover:bg-primary_hover'
                  : '',
                selectedKey === item.key
                  ? 'active tw:bg-brand-primary tw:text-brand-primary'
                  : '',
                isWidgetItem && selectedKey !== item.key
                  ? 'tw:text-tertiary'
                  : '',
                isSelectedWidget ? 'selected' : ''
              )}
              data-testid={`sidebar-option-${item.key}`}
              key={item.key}
              role="button"
              tabIndex={0}
              onClick={() => handleSidebarClick(item.key)}
              onKeyDown={handleKeyboardActivation(() =>
                handleSidebarClick(item.key)
              )}>
              <span>{item.label}</span>
              {isAllWidgetsTab && (
                <span className="widget-count tw:bg-brand-primary tw:text-brand-primary text-xs border-radius-md m-l-sm">
                  {widgets.length}
                </span>
              )}
              {isSelectedWidget && (
                <span className="selected-widget-icon">
                  <Check />
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [
    sidebarItems,
    selectedKey,
    handleSidebarClick,
    selectedWidgets,
    widgets.length,
  ]);

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
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = useMemo(() => {
    const colorChanged = selectedColor !== currentBackgroundColor;
    const widgetsSelected = selectedWidgets.length > 0;

    return colorChanged || widgetsSelected;
  }, [selectedColor, currentBackgroundColor, selectedWidgets]);

  const title = t('label.customize-entity', { entity: t('label.home') });

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          aria-label={title}
          data-testid="customise-home-modal"
          dividers="scroll"
          panelClassName="customise-home-modal"
          width={1800}
          onClose={onClose}>
          <Box
            align="center"
            className="customise-home-modal-header p-box"
            gap={3}>
            <AddIcon className="add-icon tw:size-8" />
            <Typography className="text-white" size="text-xl" weight="semibold">
              {title}
            </Typography>
          </Box>
          {/* Fixed height: the sidebar and content columns scroll on their own. */}
          <Dialog.Content className="customise-home-modal-body tw:h-[70vh] tw:max-h-none tw:flex-row tw:gap-1 tw:p-0 tw:sm:px-0">
            <div className="sidebar p-box tw:overflow-y-auto">
              {sidebarOptions}
            </div>
            <Divider
              className="tw:h-auto tw:self-stretch"
              orientation="vertical"
            />
            <div className="content p-box tw:overflow-y-auto" ref={contentRef}>
              {selectedKey === CustomiseHomeModalSelectedKey.ALL_WIDGETS &&
              isFetchingWidgets ? (
                <Box align="center" className="tw:h-full" justify="center">
                  <Loader />
                </Box>
              ) : (
                selectedComponent
              )}
            </div>
          </Dialog.Content>
          <Dialog.Footer className="tw:mt-0">
            <Button
              color="secondary"
              data-testid="cancel-btn"
              onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="apply-btn"
              isDisabled={!hasChanges}
              isLoading={isLoading}
              onPress={handleApply}>
              {t('label.apply')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default CustomiseHomeModal;

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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Row } from 'antd';
import { t } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout, Responsive, WidthProvider } from 'react-grid-layout';
import RecentlyViewed from '../../../components/recently-viewed/RecentlyViewed';
import { SIZE } from '../../../enums/common.enum';
import { Document } from '../../../generated/entity/docStore/document';
import { Thread } from '../../../generated/entity/feed/thread';
import { WidgetConfig } from '../../../pages/CustomisablePages/CustomisablePage.interface';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import AddWidgetModal from '../../CustomizableComponents/AddWidgetModal/AddWidgetModal';
import EmptyWidgetPlaceholder from '../../CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import AnnouncementsWidget from './AnnouncementsWidget';
import FollowingWidget from './FollowingWidget';
import './right-sidebar.less';
import { RightSidebarProps } from './RightSidebar.interface';

const ResponsiveGridLayout = WidthProvider(Responsive);

const RightSidebar = ({
  parentLayoutData,
  isEditView = false,
  followedData,
  followedDataCount,
  isLoadingOwnedData,
  layoutConfigData,
  updateParentLayout,
}: RightSidebarProps) => {
  const [announcements, setAnnouncements] = useState<Thread[]>([]);
  const [layout, setLayout] = useState<Array<WidgetConfig>>([
    {
      h: 0.2,
      i: 'ExtraWidget.AddWidgetButton',
      w: 1,
      x: 0,
      y: 0,
      static: true,
    },
    ...(layoutConfigData?.page?.layout ?? []),
  ]);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);

  const handleOpenAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(true);
  }, []);

  const handleCloseAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(false);
  }, []);

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    setLayout((currentLayout) => {
      if (widgetKey.endsWith('.EmptyWidgetPlaceholder')) {
        return currentLayout.filter(
          (widget: WidgetConfig) => widget.i !== widgetKey
        );
      } else {
        return currentLayout.map((widget: WidgetConfig) =>
          widget.i === widgetKey
            ? {
                ...widget,
                i: widgetKey + '.EmptyWidgetPlaceholder',
                h: widget.h > 2.3 ? 2.3 : widget.h,
              }
            : widget
        );
      }
    });
  }, []);

  const handleAddWidget = useCallback(
    (newWidgetData: Document) => {
      setLayout((currentLayout) => {
        const isEmptyPlaceholderPresent = currentLayout.find(
          (widget: WidgetConfig) =>
            widget.i ===
            `${newWidgetData.fullyQualifiedName}.EmptyWidgetPlaceholder`
        );

        if (isEmptyPlaceholderPresent) {
          return currentLayout.map((widget: WidgetConfig) =>
            widget.i ===
            `${newWidgetData.fullyQualifiedName}.EmptyWidgetPlaceholder`
              ? {
                  ...widget,
                  i: newWidgetData.fullyQualifiedName,
                  h: newWidgetData.data.height,
                }
              : widget
          );
        } else {
          return [
            ...currentLayout,
            {
              w: newWidgetData.data.gridSizes[0],
              h: newWidgetData.data.height,
              x: 0,
              y: 0,
              i: newWidgetData.fullyQualifiedName,
              static: false,
            },
          ];
        }
      });
      setIsWidgetModalOpen(false);
    },
    [layout]
  );

  const getWidgetFromKey = useCallback(
    (widgetConfig: WidgetConfig) => {
      if (widgetConfig.i.endsWith('.EmptyWidgetPlaceholder')) {
        return (
          <EmptyWidgetPlaceholder
            handleOpenAddWidgetModal={handleOpenAddWidgetModal}
            handleRemoveWidget={handleRemoveWidget}
            iconHeight={SIZE.SMALL}
            iconWidth={SIZE.SMALL}
            widgetKey={widgetConfig.i}
          />
        );
      }

      switch (widgetConfig.i) {
        case 'KnowledgePanel.Announcements':
          return (
            <AnnouncementsWidget
              announcements={announcements}
              handleRemoveWidget={handleRemoveWidget}
              isEditView={isEditView}
            />
          );

        case 'KnowledgePanel.Following':
          return (
            <FollowingWidget
              followedData={followedData}
              followedDataCount={followedDataCount}
              handleRemoveWidget={handleRemoveWidget}
              isEditView={isEditView}
              isLoadingOwnedData={isLoadingOwnedData}
            />
          );

        case 'KnowledgePanel.RecentlyVisited':
          return (
            <RecentlyViewed
              handleRemoveWidget={handleRemoveWidget}
              isEditView={isEditView}
            />
          );

        case 'ExtraWidget.AddWidgetButton':
          return (
            <Row justify="end">
              <Col>
                <Button
                  ghost
                  className="shadow-none"
                  data-testid="add-widget-placeholder-button"
                  icon={<PlusOutlined />}
                  size="small"
                  type="primary"
                  onClick={handleOpenAddWidgetModal}>
                  {t('label.add')}
                </Button>
              </Col>
            </Row>
          );

        default:
          return;
      }
    },
    [
      announcements,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
      isEditView,
      handleRemoveWidget,
      handleOpenAddWidgetModal,
    ]
  );

  const widgets = useMemo(
    () =>
      layout
        .filter((widget: WidgetConfig) =>
          widget.i === 'KnowledgePanel.Announcements'
            ? !isEmpty(announcements)
            : true
        )
        .map((widget: WidgetConfig) => (
          <div data-grid={widget} key={widget.i}>
            {getWidgetFromKey(widget)}
          </div>
        )),
    [layout, announcements, getWidgetFromKey]
  );

  useEffect(() => {
    getActiveAnnouncement()
      .then((res) => {
        setAnnouncements(res.data);
      })
      .catch((err) => {
        showErrorToast(err);
      });
  }, []);

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(layout) && !isEmpty(updatedLayout)) {
        setLayout((currentLayout) => {
          return updatedLayout.map((widget) => {
            const widgetData = currentLayout.find(
              (a: WidgetConfig) => a.i === widget.i
            );

            return {
              ...(!isEmpty(widgetData) ? widgetData : {}),
              ...widget,
            };
          });
        });
      }
    },
    [layout]
  );

  useEffect(() => {
    !isUndefined(updateParentLayout) &&
      updateParentLayout(
        (parentLayoutData ?? []).map((widget) => {
          if (widget.i === 'Container.RightSidebar') {
            return {
              ...widget,
              data: {
                page: {
                  layout: layout.filter(
                    (widget) => widget.i !== 'ExtraWidget.AddWidgetButton'
                  ),
                },
              },
            };
          } else {
            return widget;
          }
        })
      );
  }, [layout]);

  if (isEditView) {
    return (
      <>
        <ResponsiveGridLayout
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 1, md: 1, sm: 1, xs: 1, xxs: 1 }}
          draggableHandle=".drag-widget-icon"
          isResizable={false}
          rowHeight={100}
          onLayoutChange={handleLayoutUpdate}>
          {widgets}
        </ResponsiveGridLayout>
        <AddWidgetModal
          handleAddWidget={handleAddWidget}
          handleCloseAddWidgetModal={handleCloseAddWidgetModal}
          open={isWidgetModalOpen}
        />
      </>
    );
  }

  return (
    <>
      {!isEmpty(announcements) && (
        <AnnouncementsWidget announcements={announcements} />
      )}
      <FollowingWidget
        followedData={followedData}
        followedDataCount={followedDataCount}
        isLoadingOwnedData={isLoadingOwnedData}
      />
      <RecentlyViewed />
    </>
  );
};

export default RightSidebar;

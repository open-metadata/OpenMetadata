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
import { Button, Col, Row, Space, Typography } from 'antd';
import { compare } from 'fast-json-patch';
import { isEmpty, startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import AddWidgetModal from '../../components/CustomizableComponents/AddWidgetModal/AddWidgetModal';
import CustomizeMyData from '../../components/CustomizableComponents/CustomizeMyData/CustomizeMyData';
import Loader from '../../components/Loader/Loader';
import { LANDING_PAGE_LAYOUT } from '../../constants/CustomisePage.constants';
import { EntityType } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { PageType } from '../../generated/system/ui/page';
import { getDocumentByFQN, updateDocument } from '../../rest/DocStoreAPI';
import { WidgetConfig } from './CustomisablePage.interface';

export const CustomisablePage = () => {
  const { fqn, pageFqn } = useParams<{ fqn: string; pageFqn: PageType }>();
  const [page, setPage] = useState<Document>({} as Document);
  const [layout, setLayout] = useState<Array<WidgetConfig>>([
    {
      h: 0.3,
      i: 'ExtraWidget.AddWidgetButton',
      w: 3,
      x: 0,
      y: 0,
      static: true,
    },
    ...LANDING_PAGE_LAYOUT,
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);
  const { t } = useTranslation();

  const fetchDocument = async () => {
    try {
      setIsLoading(true);
      const pageData = await getDocumentByFQN(
        `${EntityType.PERSONA}.${fqn}.${EntityType.PAGE}.${pageFqn}`
      );
      setPage(pageData);
      setLayout([
        {
          h: 0.3,
          i: 'ExtraWidget.AddWidgetButton',
          w: 3,
          x: 0,
          y: 0,
          static: true,
        },
        ...(pageData.data.page?.layout ?? []),
      ]);
    } catch (error) {
      // Error
    } finally {
      setIsLoading(false);
    }
  };

  const handleLayoutChange = useCallback((newLayout: Array<WidgetConfig>) => {
    setLayout(newLayout);
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
                h: widget.h > 3 ? 3 : widget.h,
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

  const handleOpenAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(true);
  }, []);

  const handleCloseAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(false);
  }, []);

  const pageRendered = useMemo(() => {
    switch (pageFqn) {
      case PageType.LandingPage:
        return (
          <CustomizeMyData
            handleLayoutChange={handleLayoutChange}
            handleLayoutUpdate={handleLayoutUpdate}
            handleOpenAddWidgetModal={handleOpenAddWidgetModal}
            handleRemoveWidget={handleRemoveWidget}
            layoutData={layout}
          />
        );
    }

    return null;
  }, [pageFqn, layout, handleRemoveWidget, handleOpenAddWidgetModal]);

  useEffect(() => {
    fetchDocument();
  }, [fqn, pageFqn]);

  const handleSave = async () => {
    const newPageInfo: Document = {
      ...page,
      data: {
        page: {
          ...page.data.page,
          layout: layout.filter(
            (widget) => widget.i !== 'ExtraWidget.AddWidgetButton'
          ),
        },
      },
    };
    const jsonPatch = compare(page, newPageInfo);

    await updateDocument(page?.id ?? '', jsonPatch);
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row>
      <Col
        className="bg-white d-flex justify-between border-bottom p-sm"
        span={24}>
        <div className="d-flex gap-2 items-center">
          <Typography.Title className="m-0" level={5}>
            {t('label.customise') + ' ' + startCase(pageFqn) + ' '}
          </Typography.Title>
          <span className="text-body">({startCase(fqn)})</span>
        </div>
        <Space>
          <Button size="small">{t('label.cancel')}</Button>
          <Button size="small" type="primary" onClick={handleSave}>
            {t('label.save')}
          </Button>
        </Space>
      </Col>
      <Col span={24}>{pageRendered}</Col>
      <AddWidgetModal
        handleAddWidget={handleAddWidget}
        handleCloseAddWidgetModal={handleCloseAddWidgetModal}
        open={isWidgetModalOpen}
      />
    </Row>
  );
};

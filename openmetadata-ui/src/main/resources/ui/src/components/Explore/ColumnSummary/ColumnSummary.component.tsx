import { Divider, Space, Typography } from 'antd';
import { toLower } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getTagValue } from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import TagsViewer from '../../tags-viewer/tags-viewer';
import { BasicColumnInfo, ColumnSummaryProps } from './ColumnSummary.interface';

const { Text, Paragraph } = Typography;

export default function ColumnSummary({ columns }: ColumnSummaryProps) {
  const { t } = useTranslation();

  const formattedColumnsData: BasicColumnInfo[] =
    columns &&
    columns.map((column) => ({
      name: column.name,
      type: column.dataType,
      tags: column.tags,
      description: column.description,
    }));

  return (
    <Space direction="vertical">
      {columns &&
        formattedColumnsData.map((column) => (
          <React.Fragment key={column.name}>
            <Space direction="vertical" size={0}>
              <Text className="column-name">{column.name}</Text>
              <Space className="text-xs" size={4}>
                <Space size={4}>
                  <Text className="text-gray">{`${t('label.type')}:`}</Text>
                  <Text className="text-semi-bold">{toLower(column.type)}</Text>
                </Space>
                {column.tags?.length !== 0 && (
                  <>
                    <Divider type="vertical" />
                    <Space size={4}>
                      <SVGIcons
                        alt="icon-tag"
                        icon="icon-tag-grey"
                        width="12"
                      />

                      <TagsViewer
                        sizeCap={-1}
                        tags={(column.tags || []).map((tag) =>
                          getTagValue(tag)
                        )}
                      />
                    </Space>
                  </>
                )}
              </Space>
              <Paragraph className="text-gray">
                {column.description
                  ? column.description
                  : t('label.no-description')}
              </Paragraph>
            </Space>
            <Divider />
          </React.Fragment>
        ))}
    </Space>
  );
}

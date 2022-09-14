import { Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { FormattedTableData, GlossaryTermAssets } from 'Models';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Paging } from '../../../generated/type/paging';
import { getEntityLink } from '../../../utils/TableUtils';
import NextPrevious from '../../common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';

interface Props {
  assetData: GlossaryTermAssets;
  currentPage: number;
  onAssetPaginate: (num: string | number, activePage?: number) => void;
}

const AssetsTabs = ({ assetData, onAssetPaginate, currentPage }: Props) => {
  const getLinkForFqn = (fqn: string, entityType?: EntityType) => {
    switch (entityType) {
      case EntityType.TOPIC:
        return getEntityLink(SearchIndex.TOPIC, fqn);

      case EntityType.DASHBOARD:
        return getEntityLink(SearchIndex.DASHBOARD, fqn);

      case EntityType.PIPELINE:
        return getEntityLink(SearchIndex.PIPELINE, fqn);

      case EntityType.MLMODEL:
        return getEntityLink(SearchIndex.MLMODEL, fqn);

      case EntityType.TABLE:
      default:
        return getEntityLink(SearchIndex.TABLE, fqn);
    }
  };

  const tableColumn: ColumnsType<FormattedTableData> = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <Link
            to={getLinkForFqn(
              record.fullyQualifiedName || '',
              record.entityType as EntityType
            )}>
            {text}
          </Link>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (text) =>
          text ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="tw-no-description">No description</span>
          ),
      },
      {
        title: 'Owner',
        dataIndex: 'owner',
        key: 'owner',
        render: (text) => <p>{text?.displayName || text?.name || '--'}</p>,
      },
    ],
    []
  );

  return (
    <div>
      <div data-testid="table-container">
        <Table
          columns={tableColumn}
          data-testid="custom-properties-table"
          dataSource={assetData.data}
          size="small"
        />
      </div>
      {assetData.total > PAGE_SIZE && assetData.data.length > 0 && (
        <NextPrevious
          isNumberBased
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          paging={{} as Paging}
          pagingHandler={onAssetPaginate}
          totalCount={assetData.total}
        />
      )}
    </div>
  );
};

export default AssetsTabs;

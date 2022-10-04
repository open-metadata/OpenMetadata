import { GlossaryTermAssets } from 'Models';
import React from 'react';
import { PAGE_SIZE } from '../../../constants/constants';
import { Paging } from '../../../generated/type/paging';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../common/next-previous/NextPrevious';
import TableDataCard from '../../common/table-data-card/TableDataCard';

interface Props {
  assetData: GlossaryTermAssets;
  currentPage: number;
  onAssetPaginate: (num: string | number, activePage?: number) => void;
}

const AssetsTabs = ({ assetData, onAssetPaginate, currentPage }: Props) => {
  return (
    <div data-testid="table-container">
      {assetData.data.length ? (
        <>
          {assetData.data.map((entity, index) => (
            <div className="m-b-sm" key={index}>
              <TableDataCard
                id={`tabledatacard${index}`}
                searchIndex={entity.type}
                source={entity}
              />
            </div>
          ))}
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
        </>
      ) : (
        <ErrorPlaceHolder>No assets available.</ErrorPlaceHolder>
      )}
    </div>
  );
};

export default AssetsTabs;

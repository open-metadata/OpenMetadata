import { GlossaryTermAssets } from 'Models';
import React from 'react';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE } from '../../../constants/constants';
import { Paging } from '../../../generated/type/paging';
import { getTierFromSearchTableTags } from '../../../utils/TableUtils';
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
                database={entity.database}
                databaseSchema={entity.databaseSchema}
                deleted={entity.deleted}
                description={entity.description}
                fullyQualifiedName={entity.fullyQualifiedName}
                id={`tabledatacard${index}`}
                indexType={entity.index}
                name={entity.name}
                owner={entity.owner}
                service={entity.service}
                serviceType={entity.serviceType || '--'}
                tags={entity.tags}
                tier={
                  (
                    entity.tier?.tagFQN ||
                    getTierFromSearchTableTags(
                      (entity.tags || []).map((tag) => tag.tagFQN)
                    )
                  )?.split(FQN_SEPARATOR_CHAR)[1]
                }
                usage={entity.weeklyPercentileRank}
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

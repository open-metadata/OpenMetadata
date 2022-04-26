import classNames from 'classnames';
import { GlossaryTermAssets } from 'Models';
import React from 'react';
import { Link } from 'react-router-dom';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Paging } from '../../../generated/type/paging';
import { isEven } from '../../../utils/CommonUtils';
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

      case EntityType.TABLE:
      default:
        return getEntityLink(SearchIndex.TABLE, fqn);
    }
  };

  return (
    <div>
      <div className="" data-testid="table-container">
        <table
          className="tw-bg-white tw-w-full tw-mb-4"
          data-testid="database-tables">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell">Name</th>
              <th className="tableHead-cell">Description</th>
              <th className="tableHead-cell">Owner</th>
            </tr>
          </thead>
          <tbody className="tableBody">
            {assetData.data.length > 0 ? (
              assetData.data.map((dataObj, index) => (
                <tr
                  className={classNames(
                    'tableBody-row',
                    !isEven(index + 1) ? 'odd-row' : null
                  )}
                  data-testid="column"
                  key={index}>
                  <td className="tableBody-cell">
                    <Link
                      to={getLinkForFqn(
                        dataObj.fullyQualifiedName || '',
                        dataObj.entityType as EntityType
                      )}>
                      {dataObj.name}
                    </Link>
                  </td>
                  <td className="tableBody-cell">
                    {dataObj.description ? (
                      <RichTextEditorPreviewer markdown={dataObj.description} />
                    ) : (
                      <span className="tw-no-description">No description</span>
                    )}
                  </td>
                  <td className="tableBody-cell">
                    <p>
                      {dataObj.owner?.displayName ||
                        dataObj.owner?.name ||
                        '--'}
                    </p>
                  </td>
                </tr>
              ))
            ) : (
              <tr className="tableBody-row">
                <td className="tableBody-cell tw-text-center" colSpan={4}>
                  No assets available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

import classNames from 'classnames';
import { GlossaryTermAssets } from 'Models';
import React from 'react';
import { Link } from 'react-router-dom';
import { PAGE_SIZE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Database } from '../../../generated/entity/data/database';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Topic } from '../../../generated/entity/data/topic';
import { isEven } from '../../../utils/CommonUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import Pagination from '../../Pagination';
import Tags from '../../tags/tags';

interface Props {
  assetData: GlossaryTermAssets;
  onAssetPaginate: (num: number) => void;
}

const AssetsTabs = ({ assetData, onAssetPaginate }: Props) => {
  const serviceName = ServiceCategory.DATABASE_SERVICES as ServiceCategory;

  const getOptionalTableCells = (data: Database | Topic) => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        const table = data as Topic;

        return (
          <td className="tableBody-cell">
            {table.tags && table.tags?.length > 0
              ? table.tags?.map((tag, tagIndex) => (
                  <Tags
                    key={tagIndex}
                    startWith="#"
                    tag={{
                      ...tag,
                      tagFQN: tag.tagFQN?.startsWith('Tier.Tier')
                        ? tag.tagFQN.split('.')[1]
                        : tag.tagFQN,
                    }}
                    type="label"
                  />
                ))
              : '--'}
          </td>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        const topic = data as Topic;

        return (
          <td className="tableBody-cell">
            {topic.tags && topic.tags?.length > 0
              ? topic.tags.map((tag, tagIndex) => (
                  <Tags
                    className="tw-bg-gray-200"
                    key={tagIndex}
                    startWith="#"
                    tag={{
                      ...tag,
                      tagFQN: `${
                        tag.tagFQN?.startsWith('Tier.Tier')
                          ? tag.tagFQN.split('.')[1]
                          : tag.tagFQN
                      }`,
                    }}
                  />
                ))
              : '--'}
          </td>
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        const dashboard = data as Dashboard;

        return (
          <td className="tableBody-cell">
            {dashboard.tags && dashboard.tags?.length > 0
              ? dashboard.tags.map((tag, tagIndex) => (
                  <Tags
                    className="tw-bg-gray-200"
                    key={tagIndex}
                    startWith="#"
                    tag={{
                      ...tag,
                      tagFQN: `${
                        tag.tagFQN?.startsWith('Tier.Tier')
                          ? tag.tagFQN.split('.')[1]
                          : tag.tagFQN
                      }`,
                    }}
                  />
                ))
              : '--'}
          </td>
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        const pipeline = data as Pipeline;

        return (
          <td className="tableBody-cell">
            {pipeline.tags && pipeline.tags?.length > 0
              ? pipeline.tags.map((tag, tagIndex) => (
                  <Tags
                    className="tw-bg-gray-200"
                    key={tagIndex}
                    startWith="#"
                    tag={{
                      ...tag,
                      tagFQN: `${
                        tag.tagFQN?.startsWith('Tier.Tier')
                          ? tag.tagFQN.split('.')[1]
                          : tag.tagFQN
                      }`,
                    }}
                  />
                ))
              : '--'}
          </td>
        );
      }
      default:
        return <></>;
    }
  };

  const getLinkForFqn = (fqn: string) => {
    switch (serviceName) {
      case ServiceCategory.MESSAGING_SERVICES:
        return getEntityLink(SearchIndex.TOPIC, fqn);

      case ServiceCategory.DASHBOARD_SERVICES:
        return getEntityLink(SearchIndex.DASHBOARD, fqn);

      case ServiceCategory.PIPELINE_SERVICES:
        return getEntityLink(SearchIndex.PIPELINE, fqn);

      case ServiceCategory.DATABASE_SERVICES:
      default:
        return getEntityLink(SearchIndex.DASHBOARD, fqn);
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
              <th className="tableHead-cell">Tags</th>
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
                    <Link to={getLinkForFqn(dataObj.fullyQualifiedName || '')}>
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
                    <p>{(dataObj as unknown as Topic)?.owner?.name || '--'}</p>
                  </td>
                  {getOptionalTableCells(dataObj as unknown as Topic)}
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
        <Pagination
          currentPage={assetData.currPage}
          paginate={onAssetPaginate}
          sizePerPage={PAGE_SIZE}
          totalNumberOfValues={assetData.total}
        />
      )}
    </div>
  );
};

export default AssetsTabs;

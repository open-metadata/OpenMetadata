import classNames from 'classnames';
import { diffArrays, diffWords } from 'diff';
import { cloneDeep, isEqual, isUndefined } from 'lodash';
import React, { useEffect, useState } from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  ChangeDescription,
  ColumnJoins,
  Table,
} from '../../generated/entity/data/table';
import { TagLabel } from '../../generated/type/tagLabel';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import {
  getDiffByFieldName,
  getDiffValue,
} from '../../utils/EntityVersionUtils';
import { getOwnerFromId } from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import SchemaTab from '../SchemaTab/SchemaTab.component';
import { DatasetVersionProp } from './DatasetVersion.interface';

const DatasetVersion: React.FC<DatasetVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedTableName,
  datasetFQN,
  versionList,
  backHandler,
  versionHandler,
}: DatasetVersionProp) => {
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const getExtraInfo = () => {
    const ownerDiff = getDiffByFieldName('owner', changeDescription);
    const oldOwner = getOwnerFromId(
      JSON.parse(ownerDiff?.oldValue ?? '{}')?.id
    );
    const newOwner = getOwnerFromId(
      JSON.parse(ownerDiff?.newValue ?? '{}')?.id
    );
    const ownerPlaceHolder = owner?.name || owner?.displayName || '';

    const tagsDiff = getDiffByFieldName('tags', changeDescription);
    const newTier = [...JSON.parse(tagsDiff?.newValue ?? '[]')].find((t) =>
      (t?.tagFQN as string).startsWith('Tier')
    );

    const oldTier = [...JSON.parse(tagsDiff?.oldValue ?? '[]')].find((t) =>
      (t?.tagFQN as string).startsWith('Tier')
    );

    const extraInfo = [
      {
        key: 'Owner',
        value: !isUndefined(ownerDiff)
          ? getDiffValue(
              oldOwner?.displayName || oldOwner?.name || '',
              newOwner?.displayName || newOwner?.name || ''
            )
          : ownerPlaceHolder
          ? getDiffValue(ownerPlaceHolder, ownerPlaceHolder)
          : '',
      },
      {
        key: 'Tier',
        value:
          !isUndefined(newTier) || !isUndefined(oldTier)
            ? getDiffValue(
                oldTier?.tagFQN?.split('.')[1] || '',
                newTier?.tagFQN?.split('.')[1] || ''
              )
            : tier
            ? tier.split('.')[1]
            : '',
      },
    ];

    return extraInfo;
  };

  const getDescriptionDiff = (
    oldDescription: string | undefined,
    newDescription: string | undefined,
    latestDescription: string | undefined
  ) => {
    if (!isUndefined(newDescription) || !isUndefined(oldDescription)) {
      const diff = diffWords(oldDescription ?? '', newDescription ?? '');
      // eslint-disable-next-line
      const result: Array<string> = diff.map((part: any, index: any) => {
        return ReactDOMServer.renderToString(
          <div
            className={classNames(
              'tw-inline-block',
              { 'diff-added': part.added },
              { 'diff-removed': part.removed }
            )}
            key={index}>
            {part.value}
          </div>
        );
      });

      return result.join('');
    } else {
      return latestDescription || '';
    }
  };

  const getTagsDiff = (
    oldTagList: Array<TagLabel>,
    newTagList: Array<TagLabel>
  ) => {
    const tagDiff = diffArrays(oldTagList, newTagList);
    const result = tagDiff
      // eslint-disable-next-line
      .map((part: any) =>
        (part.value as Array<TagLabel>).map((tag) => ({
          ...tag,
          added: part.added,
          removed: part.removed,
        }))
      )
      ?.flat(Infinity);

    return result;
  };

  const getTableDescription = () => {
    const descriptionDiff = getDiffByFieldName(
      'description',
      changeDescription
    );
    const oldDescription = descriptionDiff?.oldValue;
    const newDescription = descriptionDiff?.newValue;

    return getDescriptionDiff(
      oldDescription,
      newDescription,
      currentVersionData.description
    );
  };

  const updatedColumns = (): Table['columns'] => {
    const colList = cloneDeep(currentVersionData.columns);
    const columnsDiff = getDiffByFieldName('columns', changeDescription);
    const changedColName = columnsDiff?.name?.split('.')?.slice(-2, -1)[0];
    if (columnsDiff?.name?.endsWith('description')) {
      const oldDescription = columnsDiff?.oldValue;
      const newDescription = columnsDiff?.newValue;

      const formatColumnData = (arr: Table['columns']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, changedColName)) {
            i.description = getDescriptionDiff(
              oldDescription,
              newDescription,
              i.description
            );
          } else {
            formatColumnData(i?.children as Table['columns']);
          }
        });
      };

      formatColumnData(colList);

      return colList;
    } else if (columnsDiff?.name?.endsWith('tags')) {
      const oldTags: Array<TagLabel> = JSON.parse(
        columnsDiff?.oldValue ?? '[]'
      );
      const newTags: Array<TagLabel> = JSON.parse(
        columnsDiff?.newValue ?? '[]'
      );

      const formatColumnData = (arr: Table['columns']) => {
        arr?.forEach((i) => {
          if (isEqual(i.name, changedColName)) {
            const flag: { [x: string]: boolean } = {};
            const uniqueTags: Array<
              TagLabel & { added: boolean; removed: boolean }
            > = [];
            const tagsDiff = getTagsDiff(oldTags, newTags);
            [...tagsDiff, ...(i.tags as Array<TagLabel>)].forEach(
              (elem: TagLabel & { added: boolean; removed: boolean }) => {
                if (!flag[elem.tagFQN as string]) {
                  flag[elem.tagFQN as string] = true;
                  uniqueTags.push(elem);
                }
              }
            );
            i.tags = uniqueTags;
          } else {
            formatColumnData(i?.children as Table['columns']);
          }
        });
      };

      formatColumnData(colList);

      return colList;
    } else {
      return colList;
    }
  };

  const tabs = [
    {
      name: 'Schema',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
      },
      isProtected: false,
      position: 1,
    },
  ];

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  updatedColumns();

  return (
    <PageContainer>
      <div
        className={classNames(
          'tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative'
        )}>
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div className={classNames('version-data')}>
            <EntityPageInfo
              isVersionSelected
              entityName={currentVersionData.name}
              extraInfo={getExtraInfo()}
              followersList={[]}
              tags={getTableTags(currentVersionData.columns || [])}
              tier={tier || ''}
              titleLinks={slashedTableName}
              version={version}
              versionHandler={backHandler}
            />
            <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow ">
              <TabsPane activeTab={1} className="tw-flex-initial" tabs={tabs} />
              <div className="tw-bg-white tw-flex-grow">
                <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full tw-mt-4 ">
                  <div className="tw-col-span-full">
                    <Description
                      isReadOnly
                      description={getTableDescription()}
                    />
                  </div>

                  <div className="tw-col-span-full">
                    <SchemaTab
                      isReadOnly
                      columnName={getPartialNameFromFQN(
                        datasetFQN,
                        ['column'],
                        '.'
                      )}
                      columns={updatedColumns()}
                      joins={currentVersionData.joins as ColumnJoins[]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <EntityVersionTimeLine
          show
          currentVersion={version}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </div>
    </PageContainer>
  );
};

export default DatasetVersion;

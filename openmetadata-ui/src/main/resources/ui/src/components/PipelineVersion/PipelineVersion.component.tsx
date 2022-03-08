/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { FC, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChangeDescription } from '../../generated/entity/data/pipeline';
import { TagLabel } from '../../generated/type/tagLabel';
import { isEven } from '../../utils/CommonUtils';
import {
  getDescriptionDiff,
  getDiffByFieldName,
  getDiffValue,
  getTagsDiff,
} from '../../utils/EntityVersionUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getOwnerFromId } from '../../utils/TableUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import { PipelineVersionProp } from './PipelineVersion.interface';

const PipelineVersion: FC<PipelineVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedPipelineName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: PipelineVersionProp) => {
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );
  const tabs = [
    {
      name: 'Details',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Details',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
    },
  ];

  const getPipelineDescription = () => {
    const descriptionDiff = getDiffByFieldName(
      'description',
      changeDescription
    );
    const oldDescription =
      descriptionDiff?.added?.oldValue ??
      descriptionDiff?.deleted?.oldValue ??
      descriptionDiff?.updated?.oldValue;
    const newDescription =
      descriptionDiff?.added?.newValue ??
      descriptionDiff?.deleted?.newValue ??
      descriptionDiff?.updated?.newValue;

    return getDescriptionDiff(
      oldDescription,
      newDescription,
      currentVersionData.description
    );
  };

  const getExtraInfo = () => {
    const ownerDiff = getDiffByFieldName('owner', changeDescription);

    const oldOwner = getOwnerFromId(
      JSON.parse(
        ownerDiff?.added?.oldValue ??
          ownerDiff?.deleted?.oldValue ??
          ownerDiff?.updated?.oldValue ??
          '{}'
      )?.id
    );
    const newOwner = getOwnerFromId(
      JSON.parse(
        ownerDiff?.added?.newValue ??
          ownerDiff?.deleted?.newValue ??
          ownerDiff?.updated?.newValue ??
          '{}'
      )?.id
    );
    const ownerPlaceHolder = owner?.name ?? owner?.displayName ?? '';

    const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
    const newTier = [
      ...JSON.parse(
        tagsDiff?.added?.newValue ??
          tagsDiff?.deleted?.newValue ??
          tagsDiff?.updated?.newValue ??
          '[]'
      ),
    ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

    const oldTier = [
      ...JSON.parse(
        tagsDiff?.added?.oldValue ??
          tagsDiff?.deleted?.oldValue ??
          tagsDiff?.updated?.oldValue ??
          '[]'
      ),
    ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

    const extraInfo: Array<ExtraInfo> = [
      {
        key: 'Owner',
        value:
          !isUndefined(ownerDiff.added) ||
          !isUndefined(ownerDiff.deleted) ||
          !isUndefined(ownerDiff.updated)
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
            : tier?.tagFQN
            ? tier?.tagFQN.split('.')[1]
            : '',
      },
      {
        key: `${currentVersionData.serviceType} Url`,
        value: currentVersionData.pipelineUrl,
        placeholderText:
          currentVersionData.displayName ?? currentVersionData.name,
        isLink: true,
        openInNewTab: true,
      },
    ];

    return extraInfo;
  };

  const getTags = () => {
    const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
    const oldTags: Array<TagLabel> = JSON.parse(
      tagsDiff?.added?.oldValue ??
        tagsDiff?.deleted?.oldValue ??
        tagsDiff?.updated?.oldValue ??
        '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      tagsDiff?.added?.newValue ??
        tagsDiff?.deleted?.newValue ??
        tagsDiff?.updated?.newValue ??
        '[]'
    );
    const flag: { [x: string]: boolean } = {};
    const uniqueTags: Array<TagLabel & { added: boolean; removed: boolean }> =
      [];

    [
      ...(getTagsDiff(oldTags, newTags) ?? []),
      ...(currentVersionData.tags ?? []),
    ].forEach((elem: TagLabel & { added: boolean; removed: boolean }) => {
      if (!flag[elem.tagFQN as string]) {
        flag[elem.tagFQN as string] = true;
        uniqueTags.push(elem);
      }
    });

    return [
      ...uniqueTags.map((t) =>
        t.tagFQN.startsWith('Tier')
          ? { ...t, tagFQN: t.tagFQN.split('.')[1] }
          : t
      ),
    ];
  };

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  return (
    <PageContainer>
      <div
        className={classNames(
          'tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative'
        )}>
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div className={classNames('version-data')}>
            <EntityPageInfo
              isVersionSelected
              deleted={deleted}
              entityName={
                currentVersionData.displayName ?? currentVersionData.name ?? ''
              }
              extraInfo={getExtraInfo()}
              followersList={[]}
              tags={getTags()}
              tier={{} as TagLabel}
              titleLinks={slashedPipelineName}
              version={version}
              versionHandler={backHandler}
            />
            <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow ">
              <TabsPane activeTab={1} className="tw-flex-initial" tabs={tabs} />
              <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
                <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                  <div className="tw-col-span-full">
                    <Description
                      isReadOnly
                      description={getPipelineDescription()}
                    />
                  </div>
                  <div className="tw-table-responsive tw-my-6 tw-col-span-full">
                    <table className="tw-w-full" data-testid="schema-table">
                      <thead>
                        <tr className="tableHead-row">
                          <th className="tableHead-cell">Task Name</th>
                          <th className="tableHead-cell">Description</th>
                          <th className="tableHead-cell">Task Type</th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {currentVersionData?.tasks?.map((task, index) => (
                          <tr
                            className={classNames(
                              'tableBody-row',
                              !isEven(index + 1) ? 'odd-row' : null
                            )}
                            key={index}>
                            <td className="tableBody-cell">
                              <Link
                                target="_blank"
                                to={{ pathname: task.taskUrl }}>
                                <span className="tw-flex">
                                  <span className="tw-mr-1">
                                    {task.displayName}
                                  </span>
                                  <SVGIcons
                                    alt="external-link"
                                    className="tw-align-middle"
                                    icon="external-link"
                                    width="12px"
                                  />
                                </span>
                              </Link>
                            </td>
                            <td className="tw-group tableBody-cell tw-relative">
                              <div
                                className="tw-cursor-pointer hover:tw-underline tw-flex"
                                data-testid="description">
                                <div>
                                  {task.description ? (
                                    <RichTextEditorPreviewer
                                      markdown={task.description}
                                    />
                                  ) : (
                                    <span className="tw-no-description">
                                      No description
                                    </span>
                                  )}
                                </div>
                                <button className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                  <SVGIcons
                                    alt="edit"
                                    icon="icon-edit"
                                    title="Edit"
                                    width="10px"
                                  />
                                </button>
                              </div>
                            </td>
                            <td className="tableBody-cell">{task.taskType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default PipelineVersion;

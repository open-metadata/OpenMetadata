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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Button,
  Card,
  Col,
  Divider,
  Input,
  Row,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, includes, isEmpty, isEqual } from 'lodash';
import {
  EntityTags,
  FormattedGlossaryTermData,
  FormattedUsersData,
  GlossaryTermAssets,
} from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import {
  GlossaryTerm,
  TermReference,
} from '../../generated/entity/data/glossaryTerm';
import { LabelType, State, TagSource } from '../../generated/type/tagLabel';
import jsonData from '../../jsons/en';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import {
  getTagCategories,
  getTaglist,
  getTagOptionsFromFQN,
} from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import DescriptionV1 from '../common/description/DescriptionV1';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import TabsPane from '../common/TabsPane/TabsPane';
import GlossaryReferenceModal from '../Modals/GlossaryReferenceModal/GlossaryReferenceModal';
import RelatedTermsModal from '../Modals/RelatedTermsModal/RelatedTermsModal';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import TagsContainer from '../tags-container/tags-container';
import TagsViewer from '../tags-viewer/tags-viewer';
import Tags from '../tags/tags';
import SummaryDetail from './SummaryDetail';
import AssetsTabs from './tabs/AssetsTabs.component';
const { Text } = Typography;

type Props = {
  assetData: GlossaryTermAssets;
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  currentPage: number;
  handleGlossaryTermUpdate: (data: GlossaryTerm) => Promise<void>;
  onAssetPaginate: (num: string | number, activePage?: number) => void;
  onRelatedTermClick?: (fqn: string) => void;
  handleUserRedirection?: (name: string) => void;
};

const GlossaryTermsV1 = ({
  assetData,
  glossaryTerm,
  handleGlossaryTermUpdate,
  onAssetPaginate,
  onRelatedTermClick,
  currentPage,
  permissions,
}: Props) => {
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [showRevieweModal, setShowRevieweModal] = useState<boolean>(false);
  const [showRelatedTermsModal, setShowRelatedTermsModal] =
    useState<boolean>(false);
  const [isSynonymsEditing, setIsSynonymsEditing] = useState<boolean>(false);
  const [isReferencesEditing, setIsReferencesEditing] =
    useState<boolean>(false);
  const [synonyms, setSynonyms] = useState<string>(
    glossaryTerm.synonyms?.join(',') || ''
  );
  const [references, setReferences] = useState<TermReference[]>(
    glossaryTerm.references || []
  );
  const [reviewer, setReviewer] = useState<Array<FormattedUsersData>>([]);
  const [relatedTerms, setRelatedTerms] = useState<FormattedGlossaryTermData[]>(
    []
  );

  const tabs = [
    {
      name: 'Summary',
      isProtected: false,
      position: 1,
    },
    {
      name: 'Assets',
      isProtected: false,
      position: 2,
    },
  ];

  const onRelatedTermsModalCancel = () => {
    setShowRelatedTermsModal(false);
  };

  const handleRelatedTermsSave = (terms: Array<FormattedGlossaryTermData>) => {
    if (!isEqual(terms, relatedTerms)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      const oldTerms = terms.filter((d) => includes(relatedTerms, d));
      const newTerms = terms
        .filter((d) => !includes(relatedTerms, d))
        .map((d) => ({
          id: d.id,
          type: d.type,
          displayName: d.displayName,
          name: d.name,
        }));
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        relatedTerms: [...oldTerms, ...newTerms],
      };
      setRelatedTerms(terms);
      handleGlossaryTermUpdate(updatedGlossaryTerm);
    }
    onRelatedTermsModalCancel();
  };

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (data: Array<FormattedUsersData>) => {
    if (!isEqual(data, reviewer)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      const oldReviewer = data.filter((d) => includes(reviewer, d));
      const newReviewer = data
        .filter((d) => !includes(reviewer, d))
        .map((d) => ({
          id: d.id,
          type: d.type,
          displayName: d.displayName,
          name: d.name,
        }));
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        reviewers: [...oldReviewer, ...newReviewer],
      };
      setReviewer(data);
      handleGlossaryTermUpdate(updatedGlossaryTerm);
    }
    onReviewerModalCancel();
  };

  const activeTabHandler = (tab: number) => {
    setActiveTab(tab);
  };

  const onDescriptionEdit = () => {
    setIsDescriptionEditable(true);
  };
  const onCancel = () => {
    setIsDescriptionEditable(false);
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        glossaryTerm?.tags?.filter((tag) =>
          selectedTags.includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: TagSource.Tag,
          tagFQN: tag,
        }));
      const updatedTags = [...prevTags, ...newTags];
      const updatedGlossary = { ...glossaryTerm, tags: updatedTags };
      handleGlossaryTermUpdate(updatedGlossary);
    }
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (glossaryTerm.description !== updatedHTML) {
      const updatedGlossaryTermDetails = {
        ...glossaryTerm,
        description: updatedHTML,
      };
      await handleGlossaryTermUpdate(updatedGlossaryTermDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const getSelectedTags = () => {
    return (glossaryTerm.tags || []).map((tag) => ({
      tagFQN: tag.tagFQN,
      isRemovable: true,
    }));
  };

  const fetchTags = () => {
    setIsTagLoading(true);
    getTagCategories()
      .then((res) => {
        setTagList(getTaglist(res.data));
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-tags-error']);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    onTagUpdate?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsTagEditable(false);
  };

  const handleRemoveReviewer = (id: string) => {
    let updatedGlossaryTerm = cloneDeep(glossaryTerm);
    const reviewer = updatedGlossaryTerm.reviewers?.filter(
      (reviewer) => reviewer.id !== id
    );
    updatedGlossaryTerm = {
      ...updatedGlossaryTerm,
      reviewers: reviewer,
    };

    handleGlossaryTermUpdate(updatedGlossaryTerm);
  };

  const handleSynonymsSave = () => {
    if (synonyms !== glossaryTerm.synonyms?.join(',')) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        synonyms: synonyms.split(','),
      };

      handleGlossaryTermUpdate(updatedGlossaryTerm);
    }
    setIsSynonymsEditing(false);
  };

  const handleReferencesSave = (data: TermReference[]) => {
    if (!isEqual(data, references)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        references: data,
      };

      handleGlossaryTermUpdate(updatedGlossaryTerm);
      setReferences(data);
    }
    setIsReferencesEditing(false);
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const eleName = event.target.name;

    switch (eleName) {
      case 'synonyms': {
        setSynonyms(value);

        break;
      }
    }
  };

  const handleTagContainerClick = () => {
    if (!isTagEditable) {
      fetchTags();
      setIsTagEditable(true);
    }
  };

  useEffect(() => {
    if (glossaryTerm.reviewers && glossaryTerm.reviewers.length) {
      setReviewer(
        glossaryTerm.reviewers.map((d) => ({
          ...(d as FormattedUsersData),
          type: 'user',
        }))
      );
    } else {
      setReviewer([]);
    }
  }, [glossaryTerm.reviewers]);

  useEffect(() => {
    if (glossaryTerm.relatedTerms?.length) {
      setRelatedTerms(glossaryTerm.relatedTerms as FormattedGlossaryTermData[]);
    }
  }, [glossaryTerm.relatedTerms]);

  const addReviewerButton = () => {
    return (
      <Tooltip
        placement="topRight"
        title={permissions.EditAll ? 'Add Reviewer' : NO_PERMISSION_FOR_ACTION}>
        <Button
          className="tw-p-0 flex-center"
          data-testid="add-new-reviewer"
          disabled={!permissions.EditAll}
          type="text"
          onClick={() => setShowRevieweModal(true)}>
          <SVGIcons
            alt="edit"
            icon={Icons.IC_EDIT_PRIMARY}
            title="Edit"
            width="16px"
          />
        </Button>
      </Tooltip>
    );
  };

  const getReviewerTabData = () => {
    return (
      <div className="tw--mx-5">
        {glossaryTerm.reviewers && glossaryTerm.reviewers.length > 0 ? (
          <div className="tw-flex tw-flex-col tw-gap-4">
            {glossaryTerm.reviewers?.map((term, i) => (
              <div
                className={classNames(
                  'tw-flex tw-justify-between tw-items-center tw-px-5',
                  {
                    'tw-border-b tw-pb-2 tw-border-border-lite':
                      i !== (glossaryTerm.reviewers || []).length - 1,
                  }
                )}
                key={i}>
                <div className={classNames('tw-flex tw-items-center')}>
                  <div className="tw-inline-block tw-mr-2">
                    <ProfilePicture
                      displayName={getEntityName(term)}
                      id={term.id}
                      name={term?.name || ''}
                      textClass="tw-text-xs"
                      width="25"
                    />
                  </div>

                  <span>{getEntityName(term)}</span>
                </div>
                <span>
                  <Button disabled={!permissions.EditAll} type="text">
                    <span
                      className={classNames('tw-h-8 tw-rounded tw-mb-3')}
                      data-testid="remove"
                      onClick={() => handleRemoveReviewer(term.id)}>
                      <FontAwesomeIcon
                        className="tw-cursor-pointer"
                        icon="remove"
                      />
                    </span>
                  </Button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="tw-text-grey-muted tw-mx-5 tw-text-center">
            No reviewer
          </div>
        )}
      </div>
    );
  };

  const getSynonyms = (synonymsList: string) => {
    return !isEmpty(synonymsList) ? (
      synonymsList.split(',').map((synonym, index) => (
        <>
          {index > 0 ? <span className="tw-mr-2">,</span> : null}
          <span>{synonym}</span>
        </>
      ))
    ) : (
      <></>
    );
  };

  const SummaryTab = () => {
    return (
      <Row gutter={16}>
        <Col flex="75%">
          <Card className="glossary-card">
            <DescriptionV1
              removeBlur
              description={glossaryTerm.description || ''}
              entityName={glossaryTerm?.displayName ?? glossaryTerm?.name}
              hasEditAccess={permissions.EditDescription || permissions.EditAll}
              isEdit={isDescriptionEditable}
              onCancel={onCancel}
              onDescriptionEdit={onDescriptionEdit}
              onDescriptionUpdate={onDescriptionUpdate}
            />
            <Divider className="m-r-1" />
            <SummaryDetail
              data={relatedTerms}
              hasAccess={permissions.EditAll}
              key="related_term"
              setShow={setShowRelatedTermsModal}
              title="Related Terms">
              <>
                {relatedTerms.map((d, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="tw-mr-2">,</span>}
                    <span
                      className="link-text-info tw-flex"
                      data-testid={`related-term-${d?.name}`}
                      onClick={() => {
                        onRelatedTermClick?.(d.fullyQualifiedName);
                      }}>
                      <span
                        className={classNames('tw-inline-block tw-truncate', {
                          'tw-w-52': (d?.name as string).length > 32,
                        })}
                        title={d?.name as string}>
                        {d?.name}
                      </span>
                    </span>
                  </Fragment>
                ))}
              </>
            </SummaryDetail>
            <Divider className="m-r-1" />

            <SummaryDetail
              hasAccess={permissions.EditAll}
              key="synonyms"
              setShow={setIsSynonymsEditing}
              title="Synonyms">
              <>
                {isSynonymsEditing ? (
                  <Space>
                    <Input
                      autoFocus
                      data-testid="synonyms"
                      id="synonyms"
                      key="synonym-input"
                      name="synonyms"
                      placeholder="Enter comma separated term"
                      value={synonyms}
                      onChange={handleValidation}
                    />
                    <Space data-testid="buttons">
                      <Button
                        data-testid="cancelAssociatedTag"
                        size="small"
                        type="primary"
                        onMouseDown={() => setIsSynonymsEditing(false)}>
                        <FontAwesomeIcon
                          className="tw-w-3.5 tw-h-3.5"
                          icon="times"
                        />
                      </Button>
                      <Button
                        data-testid="saveAssociatedTag"
                        size="small"
                        type="primary"
                        onMouseDown={handleSynonymsSave}>
                        <FontAwesomeIcon
                          className="tw-w-3.5 tw-h-3.5"
                          icon="check"
                        />
                      </Button>
                    </Space>
                  </Space>
                ) : (
                  <>{getSynonyms(synonyms)}</>
                )}
              </>
            </SummaryDetail>
            <Divider className="m-r-1" />

            <SummaryDetail
              data={references}
              hasAccess={permissions.EditAll}
              key="references"
              setShow={setIsReferencesEditing}
              title="References">
              <>
                {references &&
                  references.length > 0 &&
                  references.map((d, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="tw-mr-2">,</span>}
                      <a
                        className="link-text-info tw-flex"
                        data-testid="owner-link"
                        href={d?.endpoint}
                        rel="noopener noreferrer"
                        target="_blank">
                        <span
                          className={classNames('tw-inline-block tw-truncate', {
                            'tw-w-52': (d?.name as string).length > 32,
                          })}
                          title={d?.name as string}>
                          {d?.name}
                        </span>
                      </a>
                    </Fragment>
                  ))}
              </>
            </SummaryDetail>
          </Card>
        </Col>
        <Col className="tw-px-10" flex="25%">
          <Card
            className="glossary-card right-card tw-border tw-border-border-gray"
            extra={addReviewerButton()}
            title={<Text>Reviewer</Text>}>
            <div>{getReviewerTabData()}</div>
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <div
      className="tw-w-full tw-h-full tw-flex tw-flex-col"
      data-testid="glossary-term">
      {/* TODO: Add this stat when supporting status updation  */}
      {/* <div className="tw-flex tw-gap-11 tw-mb-2">
        <div className="tw-font-medium">Status</div>
        <div>{glossaryTerm.status}</div>
      </div> */}

      <div className="tw-flex tw-flex-wrap tw-group" data-testid="tags">
        {!isTagEditable && (
          <>
            {glossaryTerm?.tags && glossaryTerm.tags.length > 0 && (
              <>
                <SVGIcons
                  alt="icon-tag"
                  className="tw-mx-1"
                  icon="icon-tag-grey"
                  width="16"
                />
                <TagsViewer tags={glossaryTerm.tags} />
              </>
            )}
          </>
        )}

        <div className="tw-inline-block" onClick={handleTagContainerClick}>
          <TagsContainer
            buttonContainerClass="tw--mt-0"
            containerClass="tw-flex tw-items-center tw-gap-2"
            dropDownHorzPosRight={false}
            editable={isTagEditable}
            isLoading={isTagLoading}
            selectedTags={getSelectedTags()}
            showTags={false}
            size="small"
            tagList={getTagOptionsFromFQN(tagList)}
            type="label"
            onCancel={() => {
              handleTagSelection();
            }}
            onSelectionChange={(tags) => {
              handleTagSelection(tags);
            }}>
            {glossaryTerm?.tags && glossaryTerm?.tags.length ? (
              <button className="tw-ml-1 focus:tw-outline-none">
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title="Edit"
                  width="16px"
                />
              </button>
            ) : (
              <Button
                className="tw-p-0"
                disabled={!(permissions.EditTags || permissions.EditAll)}
                type="text">
                <Tags
                  className="tw-text-primary"
                  startWith="+ "
                  tag="Add tag"
                  type="label"
                />
              </Button>
            )}
          </TagsContainer>
        </div>
      </div>

      <div className="tw-flex tw-flex-col tw-flex-grow">
        <TabsPane
          activeTab={activeTab}
          className="tw-flex-initial"
          setActiveTab={activeTabHandler}
          tabs={tabs}
        />

        <div className="tw-flex-grow tw-py-4">
          {activeTab === 1 && <SummaryTab />}

          {activeTab === 2 && (
            <AssetsTabs
              assetData={assetData}
              currentPage={currentPage}
              onAssetPaginate={onAssetPaginate}
            />
          )}
        </div>

        {showRelatedTermsModal && (
          <RelatedTermsModal
            glossaryTermFQN={glossaryTerm.fullyQualifiedName}
            header="Add Related Terms"
            relatedTerms={relatedTerms}
            onCancel={onRelatedTermsModalCancel}
            onSave={handleRelatedTermsSave}
          />
        )}
        {showRevieweModal && (
          <ReviewerModal
            header="Add Reviewer"
            reviewer={reviewer}
            onCancel={onReviewerModalCancel}
            onSave={handleReviewerSave}
          />
        )}
        {isReferencesEditing && (
          <GlossaryReferenceModal
            header={`Edit References for ${glossaryTerm.name}`}
            referenceList={references}
            onCancel={() => setIsReferencesEditing(false)}
            onSave={handleReferencesSave}
          />
        )}
      </div>
    </div>
  );
};

export default GlossaryTermsV1;

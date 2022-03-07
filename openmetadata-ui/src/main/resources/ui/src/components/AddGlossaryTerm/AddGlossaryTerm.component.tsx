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
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import {
  EditorContentRef,
  FormatedGlossaryTermData,
  FormatedUsersData,
} from 'Models';
import React, { useEffect, useRef, useState } from 'react';
import { UrlEntityCharRegEx } from '../../constants/regex.constants';
import { PageLayoutType } from '../../enums/layout.enum';
import { CreateGlossaryTerm } from '../../generated/api/data/createGlossaryTerm';
import { TermReference } from '../../generated/entity/data/glossaryTerm';
import { errorMsg, requiredField } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import MarkdownWithPreview from '../common/editor/MarkdownWithPreview';
import PageLayout from '../containers/PageLayout';
import Loader from '../Loader/Loader';
import RelatedTermsModal from '../Modals/RelatedTermsModal/RelatedTermsModal';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import Tags from '../tags/tags';
import { AddGlossaryTermProps } from './AddGlossaryTerm.interface';

const Field = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <div className={classNames('tw-mt-4', className)}>{children}</div>;
};

const AddGlossaryTerm = ({
  parentGlossaryData,
  allowAccess,
  glossaryData,
  onSave,
  onCancel,
  saveState = 'initial',
}: AddGlossaryTermProps) => {
  const markdownRef = useRef<EditorContentRef>();

  const [showErrorMsg, setShowErrorMsg] = useState<{ [key: string]: boolean }>({
    name: false,
    invalidName: false,
  });

  const [name, setName] = useState('');
  const [description] = useState<string>('');
  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [showRelatedTermsModal, setShowRelatedTermsModal] = useState(false);
  const [reviewer, setReviewer] = useState<Array<FormatedUsersData>>([]);
  const [relatedTerms, setRelatedTerms] = useState<
    Array<FormatedGlossaryTermData>
  >([]);
  const [synonyms, setSynonyms] = useState('');
  const [references, setReferences] = useState<TermReference[]>([]);

  useEffect(() => {
    if (glossaryData?.reviewers && glossaryData?.reviewers.length) {
      setReviewer(glossaryData?.reviewers as FormatedUsersData[]);
    }
  }, [glossaryData]);

  const onRelatedTermsModalCancel = () => {
    setShowRelatedTermsModal(false);
  };

  const handleRelatedTermsSave = (terms: Array<FormatedGlossaryTermData>) => {
    setRelatedTerms(terms);
    onRelatedTermsModalCancel();
  };

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (reviewer: Array<FormatedUsersData>) => {
    setReviewer(reviewer);
    onReviewerModalCancel();
  };

  const handleReviewerRemove = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    removedTag: string
  ) => {
    setReviewer((pre) => pre.filter((option) => option.name !== removedTag));
  };

  const handleTermRemove = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    removedTag: string
  ) => {
    setRelatedTerms((pre) =>
      pre.filter((option) => option.name !== removedTag)
    );
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!allowAccess) {
      return;
    }
    const value = event.target.value;
    const eleName = event.target.name;
    let { name, invalidName } = cloneDeep(showErrorMsg);

    switch (eleName) {
      case 'name': {
        setName(value);
        name = false;
        invalidName = false;

        break;
      }

      case 'synonyms': {
        setSynonyms(value);

        break;
      }
    }
    setShowErrorMsg((prev) => {
      return { ...prev, name, invalidName };
    });
  };

  const addReferenceFields = () => {
    setReferences([...references, { name: '', endpoint: '' }]);
  };

  const removeReferenceFields = (i: number) => {
    const newFormValues = [...references];
    newFormValues.splice(i, 1);
    setReferences(newFormValues);
  };

  const handleReferenceFieldsChange = (
    i: number,
    field: keyof TermReference,
    value: string
  ) => {
    const newFormValues = [...references];
    newFormValues[i][field] = value;
    setReferences(newFormValues);
  };

  const validateForm = () => {
    const errMsg = {
      name: !name.trim(),
      invalidName: UrlEntityCharRegEx.test(name.trim()),
    };
    setShowErrorMsg(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const handleSave = () => {
    const updatedReference = references.filter(
      (ref) => !isEmpty(ref.endpoint) && !isEmpty(ref.name)
    );

    const updatedTerms = relatedTerms.map((term) => ({
      id: term.id,
      type: term.type,
    }));

    if (validateForm()) {
      const data: CreateGlossaryTerm = {
        name,
        displayName: name,
        description: markdownRef.current?.getEditorContent() || undefined,
        reviewers: reviewer.map((r) => ({
          id: r.id,
          type: r.type,
        })),
        relatedTerms: relatedTerms.length > 0 ? updatedTerms : undefined,
        references: updatedReference.length > 0 ? updatedReference : undefined,
        parent: !isUndefined(parentGlossaryData)
          ? {
              type: 'glossaryTerm',
              id: parentGlossaryData.id,
            }
          : undefined,
        synonyms: synonyms ? synonyms.split(',') : undefined,
        glossary: {
          id: glossaryData.id,
          type: 'glossary',
        },
      };

      onSave(data);
    }
  };

  const getSaveButton = () => {
    return allowAccess ? (
      <>
        {saveState === 'waiting' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <Loader size="small" type="white" />
          </Button>
        ) : saveState === 'success' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <i aria-hidden="true" className="fa fa-check" />
          </Button>
        ) : (
          <Button
            className={classNames('tw-w-16 tw-h-10', {
              'tw-opacity-40': !allowAccess,
            })}
            data-testid="save-webhook"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        )}
      </>
    ) : null;
  };

  const fetchRightPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">Configure Your Glossary</h6>
        <div className="tw-mb-5">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
          <br />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </div>
        {/* {getDocButton('Read Webhook Doc', '', 'webhook-doc')} */}
      </>
    );
  };

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-h-full tw-bg-white tw-pt-4"
      layout={PageLayoutType['2ColRTL']}
      rightPanel={fetchRightPanel()}>
      <h6 className="tw-heading tw-text-base">Add Glossary Term</h6>
      <div className="tw-pb-3">
        <Field>
          <label className="tw-block tw-form-label" htmlFor="name">
            {requiredField('Name:')}
          </label>

          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="name"
            id="name"
            name="name"
            placeholder="Name"
            type="text"
            value={name}
            onChange={handleValidation}
          />

          {showErrorMsg.name
            ? errorMsg('Glossary term name is required.')
            : showErrorMsg.invalidName
            ? errorMsg('Glossary term name is invalid.')
            : null}
        </Field>

        <Field>
          <label
            className="tw-block tw-form-label tw-mb-0"
            htmlFor="description">
            Description:
          </label>
          <MarkdownWithPreview
            data-testid="description"
            readonly={!allowAccess}
            ref={markdownRef}
            value={description}
          />
        </Field>

        <Field>
          <label className="tw-block tw-form-label" htmlFor="synonyms">
            Synonyms:
          </label>

          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="synonyms"
            id="synonyms"
            name="synonyms"
            placeholder="Enter comma seprated keywords"
            type="text"
            value={synonyms}
            onChange={handleValidation}
          />
        </Field>

        <div data-testid="references">
          <div className="tw-flex tw-items-center tw-mt-6">
            <p className="w-form-label tw-mr-3">References</p>
            <Button
              className="tw-h-5 tw-px-2"
              size="x-small"
              theme="primary"
              variant="contained"
              onClick={addReferenceFields}>
              <i aria-hidden="true" className="fa fa-plus" />
            </Button>
          </div>

          {references.map((value, i) => (
            <div className="tw-flex tw-items-center" key={i}>
              <div className="tw-grid tw-grid-cols-2 tw-gap-x-2 tw-w-11/12">
                <Field>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    id={`name-${i}`}
                    name="key"
                    placeholder="Name"
                    type="text"
                    value={value.name}
                    onChange={(e) =>
                      handleReferenceFieldsChange(i, 'name', e.target.value)
                    }
                  />
                </Field>
                <Field>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    id={`url-${i}`}
                    name="endpoint"
                    placeholder="url"
                    type="text"
                    value={value.endpoint}
                    onChange={(e) =>
                      handleReferenceFieldsChange(i, 'endpoint', e.target.value)
                    }
                  />
                </Field>
              </div>
              <button
                className="focus:tw-outline-none tw-mt-3 tw-w-1/12"
                onClick={(e) => {
                  removeReferenceFields(i);
                  e.preventDefault();
                }}>
                <SVGIcons
                  alt="delete"
                  icon="icon-delete"
                  title="Delete"
                  width="12px"
                />
              </button>
            </div>
          ))}
        </div>

        <Field>
          <div className="tw-flex tw-items-center tw-mt-4">
            <p className="w-form-label tw-mr-3">Related terms </p>
            <Button
              className="tw-h-5 tw-px-2"
              size="x-small"
              theme="primary"
              variant="contained"
              onClick={() => setShowRelatedTermsModal(true)}>
              <i aria-hidden="true" className="fa fa-plus" />
            </Button>
          </div>
          <div className="tw-my-4">
            {Boolean(relatedTerms.length) &&
              relatedTerms.map((d, index) => {
                return (
                  <Tags
                    editable
                    isRemovable
                    className="tw-bg-gray-200"
                    key={index}
                    removeTag={handleTermRemove}
                    tag={d.name}
                    type="contained"
                  />
                );
              })}
          </div>
        </Field>
        <Field>
          <div className="tw-flex tw-items-center tw-mt-4">
            <p className="w-form-label tw-mr-3">Reviewers </p>
            <Button
              className="tw-h-5 tw-px-2"
              size="x-small"
              theme="primary"
              variant="contained"
              onClick={() => setShowRevieweModal(true)}>
              <i aria-hidden="true" className="fa fa-plus" />
            </Button>
          </div>
          <div className="tw-my-4">
            {Boolean(reviewer.length) &&
              reviewer.map((d, index) => {
                return (
                  <Tags
                    editable
                    isRemovable
                    className="tw-bg-gray-200"
                    key={index}
                    removeTag={handleReviewerRemove}
                    tag={d.name}
                    type="contained"
                  />
                );
              })}
          </div>
        </Field>

        <Field className="tw-flex tw-justify-end">
          <Button
            data-testid="cancel-glossary"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            Discard
          </Button>
          {getSaveButton()}
        </Field>
      </div>

      {showRelatedTermsModal && (
        <RelatedTermsModal
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
    </PageLayout>
  );
};

export default AddGlossaryTerm;

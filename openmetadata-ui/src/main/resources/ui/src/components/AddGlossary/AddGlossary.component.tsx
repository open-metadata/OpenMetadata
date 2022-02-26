import classNames from 'classnames';
import { cloneDeep, debounce, isEmpty } from 'lodash';
import { EditorContentRef, FormatedUsersData, SearchResponse } from 'Models';
import React, { useRef, useState } from 'react';
import { searchData } from '../../axiosAPIs/miscAPI';
import { PageLayoutType } from '../../enums/layout.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import UserCard from '../../pages/teams/UserCard';
import { formatUsersResponse } from '../../utils/APIUtils';
import {
  errorMsg,
  getCurrentUserId,
  requiredField,
} from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import MarkdownWithPreview from '../common/editor/MarkdownWithPreview';
import PageLayout from '../containers/PageLayout';
import Loader from '../Loader/Loader';
import Tags from '../tags/tags';
import { AddGlossaryProps } from './AddGlossary.interface';

const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const AddGlossary = ({
  header,
  allowAccess = true,
  saveState = 'initial',
  onCancel,
  onSave,
}: AddGlossaryProps) => {
  const markdownRef = useRef<EditorContentRef>();

  const [showErrorMsg, setShowErrorMsg] = useState<{ [key: string]: boolean }>({
    name: false,
  });

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description] = useState<string>('');
  const [searchReviewer, setSearchReviewer] = useState('');
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<FormatedUsersData[]>([]);
  const [options, setOptions] = useState<FormatedUsersData[]>([]);

  const handleSearch = (query: string) => {
    searchData(query, 1, 10, '', '', '', SearchIndex.USER).then(
      (res: SearchResponse) => {
        setOptions(formatUsersResponse(res));
        setIsSearchBoxOpen(true);
      }
    );
  };

  const debounceSearch = debounce(handleSearch, 2000);

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!allowAccess) {
      return;
    }
    const value = event.target.value;
    const eleName = event.target.name;
    let { name } = cloneDeep(showErrorMsg);

    switch (eleName) {
      case 'name': {
        setName(value);
        name = false;

        break;
      }
      case 'displayName': {
        setDisplayName(value);

        break;
      }
      case 'searchReviewer': {
        setSearchReviewer(value);
        if (!isEmpty(value)) {
          debounceSearch(value);
        }

        break;
      }
    }
    setShowErrorMsg((prev) => {
      return { ...prev, name };
    });
  };

  const isIncludeInOptions = (option: FormatedUsersData): boolean => {
    return selectedOption.some((d) => d.name === option.name);
  };

  const handleOptionRemove = (id: string) => {
    setSelectedOption((pre) => pre.filter((option) => option.id !== id));
  };

  const handleSelection = (option: FormatedUsersData) => {
    if (isIncludeInOptions(option)) {
      handleOptionRemove(option.id);
    } else {
      setSelectedOption([...selectedOption, option]);
    }
  };

  const validateForm = () => {
    const errMsg = {
      name: !name.trim(),
    };
    setShowErrorMsg(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const handleSave = () => {
    if (validateForm()) {
      const data: CreateGlossary = {
        name,
        displayName: isEmpty(displayName) ? name : displayName,
        description: markdownRef.current?.getEditorContent() || undefined,
        reviewers: selectedOption.map((d) => d.name),
        owner: {
          id: getCurrentUserId(),
          type: 'user',
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
      <h6 className="tw-heading tw-text-base">{header}</h6>
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

          {showErrorMsg.name && errorMsg('Glossary name is required.')}
        </Field>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="name">
            Display Name:
          </label>

          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="display-name"
            id="displayName"
            name="displayName"
            placeholder="Display name"
            type="text"
            value={displayName}
            onChange={handleValidation}
          />
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
          <label
            className="tw-block tw-form-label tw-mb-0"
            htmlFor="description">
            Reviewers:
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="reviewers"
            id="searchReviewer"
            name="searchReviewer"
            placeholder="Search reviewrs.."
            type="text"
            value={searchReviewer}
            onChange={handleValidation}
          />
        </Field>
        <div className="tw-relative">
          {isSearchBoxOpen && (
            <>
              <button
                className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0"
                data-testid="close-dropdown"
                onClick={() => {
                  isSearchBoxOpen && setIsSearchBoxOpen(false);
                  setSearchReviewer('');
                }}
              />

              <div
                aria-labelledby="menu-button"
                aria-orientation="vertical"
                className="tw-origin-top-right tw-max-h-44 tw-overflow-y-auto tw-left-1 tw-right-1 tw-absolute tw-z-10
           tw-mt-1 tw-rounded-md tw-shadow-lg 
        tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none"
                role="menu">
                <div className="py-1" role="none">
                  {options.map((option, index) => (
                    <span
                      className={classNames(
                        'tw-cursor-pointer tw-flex tw-justify-between tw-px-4 tw-py-2 tw-text-sm',
                        {
                          'tw-bg-primary ': isIncludeInOptions(option),
                          'hover:tw-bg-body-hover': !isIncludeInOptions(option),
                        }
                      )}
                      data-testid="InPage"
                      key={index}
                      onClick={() => handleSelection(option)}>
                      <Tags
                        className={classNames(
                          isIncludeInOptions(option)
                            ? 'tw-text-white'
                            : 'tw-text-grey-body'
                        )}
                        tag={`${option.displayName} (${option.name})`}
                        type="outlined"
                      />
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="tw-my-4 tw-grid tw-grid-cols-2 tw-gap-4">
          {Boolean(selectedOption.length) &&
            selectedOption.map((d) => {
              return (
                <UserCard
                  isActionVisible
                  isIconVisible
                  item={{
                    name: d.name,
                    description: d.displayName,
                    id: d.id,
                  }}
                  key={d.id}
                  onRemove={handleOptionRemove}
                />
              );
            })}
        </div>

        <div className="tw-flex tw-justify-end">
          <Button
            data-testid="cancel-glossary"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            Discard
          </Button>
          {getSaveButton()}
        </div>
      </div>
    </PageLayout>
  );
};

export default AddGlossary;

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
import { Card } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isNil } from 'lodash';
import moment from 'moment';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useState,
} from 'react';
import Select, { SingleValue } from 'react-select';
import { generateUserToken, getUserToken } from '../../axiosAPIs/userAPI';
import { ROUTES } from '../../constants/constants';
import { JWTTokenExpiry, User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName, requiredField } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { Button } from '../buttons/Button/Button';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import Description from '../common/description/Description';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { UserDetails } from '../Users/Users.interface';

interface BotsDetailProp extends HTMLAttributes<HTMLDivElement> {
  botsData: User;
  updateBotsDetails: (data: UserDetails) => void;
  revokeTokenHandler: () => void;
}

interface Option {
  value: string;
  label: string;
}

const BotsDetail: FC<BotsDetailProp> = ({
  botsData,
  updateBotsDetails,
  revokeTokenHandler,
}) => {
  const [displayName, setDisplayName] = useState(botsData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const [botsToken, setBotsToken] = useState<string>('');
  const [botsTokenExpiry, setBotsTokenExpiry] = useState<string>();
  const [isRevokingToken, setIsRevokingToken] = useState<boolean>(false);
  const [isRegeneratingToken, setIsRegeneratingToken] =
    useState<boolean>(false);
  const [generateToken, setGenerateToken] = useState<boolean>(false);
  const [selectedExpiry, setSelectedExpiry] = useState('7');

  const getJWTTokenExpiryOptions = () => {
    return Object.keys(JWTTokenExpiry).map((expiry) => {
      const expiryValue = JWTTokenExpiry[expiry as keyof typeof JWTTokenExpiry];

      return { label: `${expiryValue} days`, value: expiryValue };
    });
  };

  const getExpiryDateText = () => {
    if (selectedExpiry === JWTTokenExpiry.Unlimited) {
      return <p className="tw-mt-2">The token will never expire!</p>;
    } else {
      return (
        <p className="tw-mt-2">
          The token will expire on{' '}
          {moment().add(selectedExpiry, 'days').format('ddd Do MMMM, YYYY')}
        </p>
      );
    }
  };

  const handleOnChange = (
    value: SingleValue<unknown>,
    { action }: { action: string }
  ) => {
    if (isNil(value) || action === 'clear') {
      setSelectedExpiry('');
    } else {
      const selectedValue = value as Option;
      setSelectedExpiry(selectedValue.value);
    }
  };

  const fetchBotsToken = () => {
    getUserToken(botsData.id)
      .then((res: AxiosResponse) => {
        const { JWTToken, JWTTokenExpiresAt } = res.data;
        setBotsToken(JWTToken);
        setBotsTokenExpiry(JWTTokenExpiresAt);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const generateBotsToken = (data: string) => {
    generateUserToken(botsData.id, data)
      .then((res: AxiosResponse) => {
        const { JWTToken, JWTTokenExpiresAt } = res.data;
        setBotsToken(JWTToken);
        setBotsTokenExpiry(JWTTokenExpiresAt);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => {
        setGenerateToken(false);
      });
  };

  const handleTokenGeneration = () => {
    if (botsToken) {
      setIsRegeneratingToken(true);
    } else {
      setGenerateToken(true);
    }
  };

  const handleGenerate = () => {
    generateBotsToken(selectedExpiry);
  };

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleDisplayNameChange = () => {
    if (displayName !== botsData.displayName) {
      updateBotsDetails({ displayName: displayName || '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = (description: string) => {
    if (description !== botsData.description) {
      updateBotsDetails({ description });
    }
    setIsDescriptionEdit(false);
  };

  const getDisplayNameComponent = () => {
    return (
      <div className="tw-mt-4 tw-w-full">
        {isDisplayNameEdit ? (
          <div className="tw-flex tw-items-center tw-gap-2">
            <input
              className="tw-form-inputs tw-form-inputs-padding tw-py-0.5 tw-w-full"
              data-testid="displayName"
              id="displayName"
              name="displayName"
              placeholder="displayName"
              type="text"
              value={displayName}
              onChange={onDisplayNameChange}
            />
            <div className="tw-flex tw-justify-end" data-testid="buttons">
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                data-testid="cancel-displayName"
                size="custom"
                theme="primary"
                variant="contained"
                onMouseDown={() => setIsDisplayNameEdit(false)}>
                <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
              </Button>
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                data-testid="save-displayName"
                size="custom"
                theme="primary"
                variant="contained"
                onClick={handleDisplayNameChange}>
                <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
              </Button>
            </div>
          </div>
        ) : (
          <Fragment>
            {displayName ? (
              <span className="tw-text-base tw-font-medium tw-mr-2">
                {displayName}
              </span>
            ) : (
              <span className="tw-no-description tw-text-sm">
                Add display name
              </span>
            )}

            <button
              className="tw-ml-2 focus:tw-outline-none"
              data-testid="edit-displayName"
              onClick={() => setIsDisplayNameEdit(true)}>
              <SVGIcons alt="edit" icon="icon-edit" title="Edit" width="16px" />
            </button>
          </Fragment>
        )}
      </div>
    );
  };

  const getDescriptionComponent = () => {
    return (
      <div className="tw--ml-5">
        <Description
          hasEditAccess
          description={botsData.description || ''}
          entityName={getEntityName(botsData as unknown as EntityReference)}
          isEdit={isDescriptionEdit}
          onCancel={() => setIsDescriptionEdit(false)}
          onDescriptionEdit={() => setIsDescriptionEdit(true)}
          onDescriptionUpdate={handleDescriptionChange}
        />
      </div>
    );
  };

  const fetchLeftPanel = () => {
    return (
      <Card
        className="ant-card-feed"
        style={{
          ...leftPanelAntCardStyle,
          marginTop: '16px',
        }}>
        <div data-testid="left-panel">
          <div className="tw-flex tw-flex-col">
            <div>
              <SVGIcons
                alt="bot-profile"
                icon={Icons.BOT_PROFILE}
                width="280px"
              />
            </div>
            {getDisplayNameComponent()}

            {getDescriptionComponent()}
          </div>
        </div>
      </Card>
    );
  };

  const fetchRightPanel = () => {
    return (
      <Card
        className="ant-card-feed"
        style={{
          ...leftPanelAntCardStyle,
          marginTop: '16px',
        }}>
        <div data-testid="right-panel">
          <div className="tw-flex tw-flex-col">
            <h6 className="tw-mb-2 tw-text-lg">Token Security</h6>
            <p className="tw-mb-2">
              Anyone who has your JWT Token will be able to send REST API
              requests to the OpenMetadata Server. Do not expose the JWT Token
              in your application code. Do not share it on GitHub or anywhere
              else online.
            </p>
          </div>
        </div>
      </Card>
    );
  };

  const getCopyComponent = () => {
    if (botsToken) {
      return <CopyToClipboardButton copyText={botsToken} />;
    } else {
      return null;
    }
  };

  const getBotsTokenExpiryDate = () => {
    if (botsTokenExpiry) {
      // get the current date timestamp
      const currentTimeStamp = Date.now();

      const isTokenExpired = currentTimeStamp >= Number(botsTokenExpiry);

      // get the token expiry date
      const tokenExpiryDate =
        moment(botsTokenExpiry).format('ddd Do MMMM, YYYY');

      return (
        <p
          className="tw-text-grey-muted tw-mt-2 tw-italic"
          data-testid="token-expiry">
          {isTokenExpired
            ? `Expired on ${tokenExpiryDate}`
            : `Expires on ${tokenExpiryDate}`}
          .
        </p>
      );
    } else {
      return (
        <p
          className="tw-text-grey-muted tw-mt-2 tw-italic"
          data-testid="token-expiry">
          <SVGIcons alt="warning" icon="error" />
          <span className="tw-ml-1 tw-align-middle">
            This token has no expiration date.
          </span>
        </p>
      );
    }
  };

  const centerLayout = () => {
    if (generateToken) {
      return (
        <div className="tw-mt-4" data-testid="generate-token-form">
          <div data-testid="expiry-dropdown">
            <label htmlFor="expiration">{requiredField('Expiration')}</label>
            <Select
              defaultValue={{ label: '7 days', value: '7' }}
              id="expiration"
              isSearchable={false}
              options={getJWTTokenExpiryOptions()}
              styles={reactSingleSelectCustomStyle}
              onChange={handleOnChange}
            />
            {getExpiryDateText()}
          </div>
          <div className="tw-flex tw-justify-end">
            <Button
              className={classNames('tw-mr-2')}
              data-testid="discard-button"
              size="regular"
              theme="primary"
              variant="text"
              onClick={() => setGenerateToken(false)}>
              Cancel
            </Button>
            <Button
              data-testid="generate-button"
              size="regular"
              theme="primary"
              type="submit"
              variant="contained"
              onClick={handleGenerate}>
              Generate
            </Button>
          </div>
        </div>
      );
    } else {
      if (botsToken) {
        return (
          <Fragment>
            <div className="tw-flex tw-justify-between tw-items-center tw-mt-4">
              <input
                disabled
                className="tw-form-inputs tw-p-1.5"
                data-testid="token"
                placeholder="Generate new token..."
                type="password"
                value={botsToken}
              />
              {getCopyComponent()}
            </div>
            {getBotsTokenExpiryDate()}
          </Fragment>
        );
      } else {
        return (
          <div
            className="tw-no-description tw-text-sm tw-mt-4"
            data-testid="no-token">
            No token available
          </div>
        );
      }
    }
  };

  const getCenterLayout = () => {
    return (
      <div
        className="tw-w-full tw-bg-white tw-shadow tw-rounded tw-p-4 tw-mt-4"
        data-testid="center-panel">
        <div className="tw-flex tw-justify-between tw-items-center">
          <h6 className="tw-mb-2 tw-self-center">
            {generateToken ? 'Generate JWT token' : 'JWT Token'}
          </h6>
          {!generateToken ? (
            <div className="tw-flex">
              <Button
                data-testid="generate-token"
                size="small"
                theme="primary"
                variant="outlined"
                onClick={() => handleTokenGeneration()}>
                {botsToken ? 'Re-generate token' : 'Generate new token'}
              </Button>
              {botsToken ? (
                <Button
                  className="tw-px-2 tw-py-0.5 tw-font-medium tw-ml-2 tw-rounded-md tw-border-error hover:tw-border-error tw-text-error hover:tw-text-error focus:tw-outline-none"
                  data-testid="revoke-button"
                  size="custom"
                  variant="outlined"
                  onClick={() => setIsRevokingToken(true)}>
                  Revoke token
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <hr className="tw-mt-2" />
        <p className="tw-mt-4">
          Token you have generated that can be used to access the OpenMetadata
          API.
        </p>
        {centerLayout()}
      </div>
    );
  };

  useEffect(() => {
    if (botsData.id) {
      fetchBotsToken();
    }
  }, [botsData]);

  return (
    <PageLayout
      classes="tw-h-full tw-px-4"
      header={
        <TitleBreadcrumb
          className="tw-px-6"
          titleLinks={[
            {
              name: 'Bots',
              url: ROUTES.BOTS,
            },
            { name: botsData.name || '', url: '', activeTitle: true },
          ]}
        />
      }
      leftPanel={fetchLeftPanel()}
      rightPanel={fetchRightPanel()}>
      {getCenterLayout()}
      {isRevokingToken ? (
        <ConfirmationModal
          bodyText="Are you sure you want to revoke access for JWT token?"
          cancelText="Cancel"
          confirmText="Confirm"
          header="Are you sure?"
          onCancel={() => setIsRevokingToken(false)}
          onConfirm={() => {
            revokeTokenHandler();
            setIsRevokingToken(false);
          }}
        />
      ) : null}
      {isRegeneratingToken ? (
        <ConfirmationModal
          bodyText="Generating a new token will revoke the existing JWT token. Are you sure you want to proceed?"
          cancelText="Cancel"
          confirmText="Confirm"
          header="Are you sure?"
          onCancel={() => setIsRegeneratingToken(false)}
          onConfirm={() => {
            setIsRegeneratingToken(false);
            setGenerateToken(true);
          }}
        />
      ) : null}
    </PageLayout>
  );
};

export default BotsDetail;

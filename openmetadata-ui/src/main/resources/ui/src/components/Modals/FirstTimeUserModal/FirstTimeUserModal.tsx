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
import React, { FunctionComponent, useState } from 'react';
import BGConfetti from '../../../assets/img/confetti-bg.jpeg';
import { urlGithubRepo, urlJoinSlack } from '../../../constants/url.const';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import {
  faAngleDoubleRight,
  faArrowLeft,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

type Props = {
  onSave: () => void;
  onCancel: () => void;
};

const description = [
  'A single place to Discover, Collaborate, and Get your data right',
  'Based on Open metadata standards',
  'Understand your data and collaborate with your team',
];

export const FirstTimeUserModal: FunctionComponent<Props> = ({
  onCancel,
  onSave,
}: Props) => {
  const [active, setActive] = useState<number>(0);
  const [lastSlide, setLastSlide] = useState<boolean>(false);

  const previousClick = () => {
    setActive((pre) => pre - 1);
    setLastSlide(false);
  };

  const nextClick = () => {
    setActive((pre) => {
      const newVal = pre + 1;
      setLastSlide(description.length - 1 === newVal);

      return newVal;
    });
  };

  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop tw-opacity-80" />
      <div
        className="tw-modal-container tw-modal-confetti tw-max-w-xl tw-max-h-90vh"
        style={{ backgroundImage: active === 0 ? `url(${BGConfetti})` : '' }}>
        <div className="tw-modal-header tw-border-0 tw-justify-center tw-pt-8 tw-pb-0">
          <div className="tw-flex tw-flex-col tw-justify-center tw-items-center tw-mt-12">
            {active === 0 ? (
              // TODO: Replace it with Party popper icon
              <SVGIcons alt="Welcome" icon={Icons.WELCOME_POPPER} width="60" />
            ) : (
              <SVGIcons
                alt="OpenMetadata Logo"
                icon={Icons.LOGO_SMALL}
                width="50"
              />
            )}
            <p className="tw-modal-title tw-text-h4 tw-font-semibold tw-text-primary-active tw-mt-5">
              Welcome to OpenMetadata
            </p>
          </div>
        </div>
        <div className="tw-modal-body tw-relative tw-h-32 tw-justify-start tw-items-center">
          {description.map((d, i) => (
            <p
              className={classNames(
                i === active
                  ? 'tw-opacity-100 tw-relative tw-transition-opacity tw-delay-200'
                  : 'tw-opacity-0 tw-absolute',
                'tw-text-xl tw-font-medium tw-text-center tw-bg-white tw-mx-7'
              )}
              key={i}>
              {d}
            </p>
          ))}
        </div>
        <div className="tw-w-full tw-text-center">
          <a href={urlGithubRepo} rel="noopener noreferrer" target="_blank">
            <button className="tw-welcome-button tw-text-grey-body tw-mr-4">
              <SVGIcons alt="Github Logo" icon={Icons.GITHUB_ICON} width="16" />
              <span className="tw-ml-3">Star us on Github</span>
            </button>
          </a>
          <a href={urlJoinSlack} rel="noopener noreferrer" target="_blank">
            <button className="tw-welcome-button tw-text-grey-body">
              <SVGIcons alt="Github Logo" icon={Icons.SLACK} width="16" />
              <span className="tw-ml-3">Join us on Slack</span>
            </button>
          </a>
        </div>

        <div className="tw-modal-footer tw-border-0 tw-justify-between">
          <Button
            className={classNames(
              'tw-text-primary-active',
              active === 0 ? 'tw-invisible' : null
            )}
            size="regular"
            theme="primary"
            variant="text"
            onClick={previousClick}>
            <FontAwesomeIcon
              className="tw-text-sm tw-align-middle tw-pr-1.5"
              icon={faArrowLeft}
            />{' '}
            <span>Previous</span>
          </Button>
          {lastSlide ? (
            <span>
              <Button
                className="tw-text-primary-active tw-hidden"
                size="regular"
                theme="default"
                variant="text"
                onClick={onCancel}>
                <span>Skip</span>
                <FontAwesomeIcon
                  className="tw-text-sm tw-align-middle tw-pl-1.5"
                  icon={faAngleDoubleRight}
                />
              </Button>
              <Button
                className="tw-bg-primary-active tw-text-white"
                id="take-tour"
                size="regular"
                theme="primary"
                variant="contained"
                onClick={onSave}>
                Explore OpenMetadata
              </Button>
            </span>
          ) : (
            <Button
              className="tw-text-primary-active"
              id="next"
              size="regular"
              theme="primary"
              variant="text"
              onClick={nextClick}>
              <span>Next</span>
              <FontAwesomeIcon
                className="tw-text-sm tw-align-middle tw-pl-1.5"
                icon={faArrowRight}
              />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
};

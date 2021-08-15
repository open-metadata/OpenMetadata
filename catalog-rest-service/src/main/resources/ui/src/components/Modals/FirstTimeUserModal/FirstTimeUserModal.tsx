import classNames from 'classnames';
import React, { FunctionComponent, useState } from 'react';
import BGConfetti from '../../../assets/img/confetti-bg.jpeg';
import { Button } from '../../buttons/Button/Button';

type Props = {
  onSave: () => void;
  onCancel: () => void;
};

const description = [
  'OpenMetadata is a Centralized Metadata Store.',
  'Discover all your data assets in a single place, collaborate with your co-workers.',
  'Understand your data assets and contribute to make it richer.',
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
        style={{ backgroundImage: `url(${BGConfetti})` }}>
        <div className="tw-modal-header tw-border-0 tw-justify-center tw-pt-8 tw-pb-0">
          <p className="tw-modal-title tw-text-h4 tw-font-semibold tw-text-primary-active tw-mt-32">
            Welcome to OpenMetadata
          </p>
        </div>
        <div className="tw-modal-body tw-relative tw-h-40 tw-justify-start tw-items-center">
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
            <i className="fas fa-arrow-left tw-text-sm tw-align-middle tw-pr-1.5" />{' '}
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
                <i className="fas fa-angle-double-right tw-text-sm tw-align-middle tw-pl-1.5" />
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
              size="regular"
              theme="primary"
              variant="text"
              onClick={nextClick}>
              <span>Next</span>
              <i className="fas fa-arrow-right tw-text-sm tw-align-middle tw-pl-1.5" />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
};

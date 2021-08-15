import classNames from 'classnames';
import React, { FunctionComponent, useState } from 'react';
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
}: Props) => {
  const [active, setActive] = useState<number>(0);
  const [lastSlide, setLastSlide] = useState<boolean>(false);

  const previousClick = () => {
    if (lastSlide) {
      // to somthing
    } else {
      setActive((pre) => pre - 1);
    }
  };

  const nextClick = () => {
    if (lastSlide) {
      onCancel();
    } else {
      setActive((pre) => {
        const newVal = pre + 1;
        description.length - 1 === newVal && setLastSlide(true);

        return newVal;
      });
    }
  };

  return (
    <dialog className="tw-modal">
      <div className="tw-modal-backdrop tw-opacity-80" />
      <div className="tw-modal-container tw-max-w-xl tw-max-h-90vh tw-bg-gradient-to-bl tw-to-primary-lite tw-from-secondary-lite">
        <div className="tw-modal-header tw-border-0 tw-justify-center tw-pt-8">
          <p className="tw-modal-title tw-text-h4 tw-font-semibold tw-text-primary-active">
            Welcome to OpenMetadata
          </p>
        </div>
        <div className="tw-modal-body tw-relative tw-h-64 tw-justify-center tw-items-center">
          {description.map((d, i) => (
            <p
              className={classNames(
                i === active
                  ? 'tw-opacity-100 tw-relative tw-transition-opacity tw-delay-200'
                  : 'tw-opacity-0 tw-absolute',
                'tw-text-xl tw-font-medium tw-text-center'
              )}
              key={i}>
              {d}
            </p>
          ))}
        </div>
        <div className="tw-modal-footer tw-border-0 tw-justify-between">
          <Button
            className={classNames(
              'tw-bg-primary-active tw-text-white',
              active === 0 ? 'tw-invisible' : null
            )}
            size="regular"
            theme="primary"
            variant="contained"
            onClick={previousClick}>
            {lastSlide ? (
              'Take a Tour'
            ) : (
              <>
                <i className="fas fa-arrow-left tw-text-sm tw-align-middle tw-pr-1.5" />{' '}
                <span>Previous</span>
              </>
            )}
          </Button>

          <Button
            className="tw-bg-primary-active tw-text-white"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={nextClick}>
            {lastSlide ? (
              'Skip and go to landing page'
            ) : (
              <>
                <span>Next</span>
                <i className="fas fa-arrow-right tw-text-sm tw-align-middle tw-pl-1.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </dialog>
  );
};

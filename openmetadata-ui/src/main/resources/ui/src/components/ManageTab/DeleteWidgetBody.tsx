import React from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Button } from '../buttons/Button/Button';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';

type DeleteWidgetBodyProps = {
  header: string;
  description: string;
  buttonText: string;
  isOwner?: boolean;
  hasPermission: boolean;
  onClick: () => void;
};

const DeleteWidgetBody = ({
  header,
  description,
  buttonText,
  isOwner,
  hasPermission,
  onClick,
}: DeleteWidgetBodyProps) => {
  return (
    <div className="tw-flex tw-justify-between tw-px-4 tw-py-2">
      <div data-testid="danger-zone-text">
        <h4 className="tw-text-base" data-testid="danger-zone-text-title">
          {header}
        </h4>
        <p data-testid="danger-zone-text-para">{description}</p>
      </div>
      <NonAdminAction
        className="tw-self-center"
        html={<p>{TITLE_FOR_NON_ADMIN_ACTION}</p>}
        isOwner={isOwner}
        position="left">
        <Button
          className="tw-px-2 tw-py-1 tw-rounded tw-h-auto tw-self-center tw-shadow"
          data-testid="delete-button"
          disabled={!hasPermission}
          size="custom"
          theme="primary"
          type="button"
          variant="outlined"
          onClick={onClick}>
          {buttonText}
        </Button>
      </NonAdminAction>
    </div>
  );
};

export default DeleteWidgetBody;

import { capitalize } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/common/avatar/Avatar';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';

type Props = {
  item: { description: string; name: string; id?: string };
  isActionVisible?: boolean;
  isIconVisible?: boolean;
  isDataset?: boolean;
  isCheckBoxes?: boolean;
  onSelect?: (value: string) => void;
};

const UserCard = ({
  item,
  isActionVisible = false,
  isIconVisible = false,
  isDataset = false,
  isCheckBoxes = false,
  onSelect,
}: Props) => {
  return (
    <div className="tw-card tw-flex tw-justify-between tw-py-2 tw-px-3 tw-group">
      <div className={`tw-flex ${isCheckBoxes ? '' : 'tw-gap-1'}`}>
        {isIconVisible ? <Avatar name={item.description} /> : null}

        <div className="tw-flex tw-flex-col tw-pl-2">
          {isDataset ? (
            <Link to={`/dataset/${item.description}`}>
              <button className="tw-font-normal tw-text-grey-body">
                {getPartialNameFromFQN(item.description, ['database', 'table'])}
              </button>
            </Link>
          ) : (
            <p className="tw-font-normal">{item.description}</p>
          )}

          <p>{isIconVisible ? item.name : capitalize(item.name)}</p>
        </div>
      </div>
      {isActionVisible && (
        <>
          {isCheckBoxes ? (
            <input
              className="tw-px-2 custom-checkbox"
              type="checkbox"
              onChange={() => {
                onSelect?.(item.id as string);
              }}
            />
          ) : (
            <span>
              <SVGIcons
                alt="delete"
                className="tw-text-gray-500 tw-cursor-pointer tw-opacity-0 hover:tw-text-gray-700 group-hover:tw-opacity-100"
                icon="icon-delete"
                title="Remove"
              />
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default UserCard;

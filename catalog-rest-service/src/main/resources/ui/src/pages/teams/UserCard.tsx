import { capitalize } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
type Props = {
  item: { description: string; name: string };
  isActionVisible?: boolean;
  isIconVisible?: boolean;
  isDataset?: boolean;
};
const UserCard = ({
  item,
  isActionVisible = false,
  isIconVisible = false,
  isDataset = false,
}: Props) => {
  const getBgColorByCode = (code: number) => {
    if (code >= 65 && code <= 71) {
      return '#B02AAC40';
    }
    if (code >= 72 && code <= 78) {
      return '#7147E840';
    }
    if (code >= 79 && code <= 85) {
      return '#FFC34E40';
    } else {
      return '#1890FF40';
    }
  };

  return (
    <div className="tw-card tw-flex tw-justify-between tw-py-2 tw-px-3 tw-group">
      <div className="tw-flex tw-gap-1">
        {isIconVisible ? (
          <div
            className="tw-flex tw-justify-center tw-items-center tw-align-middle"
            style={{
              height: '36px',
              width: '36px',
              borderRadius: '50%',
              background: getBgColorByCode(item.description.charCodeAt(0)),
              color: 'black',
            }}>
            <p>{item.description[0]}</p>
          </div>
        ) : null}

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
        <span>
          <SVGIcons
            alt="delete"
            className="tw-text-gray-500 tw-cursor-pointer tw-opacity-0 hover:tw-text-gray-700 group-hover:tw-opacity-100"
            icon="icon-delete"
            title="delete"
          />
        </span>
      )}
    </div>
  );
};

export default UserCard;

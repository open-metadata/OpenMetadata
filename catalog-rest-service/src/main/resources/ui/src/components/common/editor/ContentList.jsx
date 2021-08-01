import classNames from 'classnames';
import propTypes, { arrayOf } from 'prop-types';
import React from 'react';
import placeholder from '../../../assets/img/user-placeholder.png';

const ContentList = React.forwardRef((props, ref) => {
  const { contentList, index, showImage, onItemSelect, className } = props;

  return (
    <ul
      className={classNames('editor-list-container', className || null)}
      ref={ref}>
      {contentList.map((listItem, i) => (
        <li
          className={'editor-list-item ' + (i === index ? 'selected' : '')}
          key={i}
          onMouseDown={() => {
            onItemSelect && onItemSelect(i);
          }}>
          {showImage && (
            <img alt="user" className="tw-inline" src={placeholder} />
          )}
          {listItem}
        </li>
      ))}
    </ul>
  );
});

ContentList.propTypes = {
  contentList: arrayOf(propTypes.string),
  index: propTypes.number,
  showImage: propTypes.bool,
  onItemSelect: propTypes.func,
  className: propTypes.string,
};

ContentList.displayName = 'ContentList';

export default ContentList;

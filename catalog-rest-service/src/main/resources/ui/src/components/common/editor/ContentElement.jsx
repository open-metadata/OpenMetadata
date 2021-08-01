import propTypes from 'prop-types';
import React from 'react';

const ContentElement = ({ attributes, children, element, elementType }) => {
  let prefix = '';
  if (elementType === 'mention') prefix = '@';
  else if (elementType === 'dataset') prefix = '#';

  return (
    <span {...attributes} className="content-element" contentEditable={false}>
      {prefix}
      {element.character}
      {children}
    </span>
  );
};

ContentElement.propTypes = {
  attributes: propTypes.object,
  children: propTypes.object,
  element: propTypes.shape({
    character: propTypes.string,
  }),
  elementType: propTypes.string,
};

export default ContentElement;

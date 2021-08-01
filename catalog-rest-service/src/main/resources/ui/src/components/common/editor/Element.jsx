import propTypes from 'prop-types';
import React from 'react';
import ContentElement from './ContentElement';

const Element = (props) => {
  const { attributes, children, element } = props;
  switch (element.type) {
    case 'block-quote':
      return <blockquote {...attributes}>{children}</blockquote>;
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    case 'numbered-list':
      return <ol {...attributes}>{children}</ol>;
    case 'mention':
      return <ContentElement {...props} elementType="mention" />;
    case 'dataset':
      return <ContentElement {...props} elementType="dataset" />;
    case 'strike':
      return <strike {...attributes}>{children}</strike>;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

Element.propTypes = {
  attributes: propTypes.object,
  children: propTypes.object,
  element: propTypes.shape({
    type: propTypes.string,
  }),
};

export default Element;

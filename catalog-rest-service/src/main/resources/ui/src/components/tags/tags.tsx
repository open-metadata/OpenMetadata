import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import { TagProps } from './tags.interface';
import { tagStyles } from './tags.styles';

const Tags: FunctionComponent<TagProps> = ({
  className,
  editable,
  tag,
  type = 'contained',
  removeTag,
}: TagProps) => {
  const baseStyle = tagStyles.base;
  const layoutStyles = tagStyles[type];
  const textBaseStyle = tagStyles.text.base;
  const textLayoutStyles = editable
    ? tagStyles.text.editable
    : tagStyles.text.default;

  return (
    <span className={classNames(baseStyle, layoutStyles, className)}>
      <span className={classNames(textBaseStyle, textLayoutStyles)}>{tag}</span>
      {editable && (
        <span
          className="tw-py-1 tw-px-2 tw-rounded hover:tw-bg-gray-300"
          onClick={(e: React.MouseEvent<HTMLElement, MouseEvent>) => {
            e.preventDefault();
            e.stopPropagation();
            removeTag && removeTag(e, tag);
          }}>
          <i aria-hidden="true" className="fa fa-times tw-text-grey-300" />
        </span>
      )}
    </span>
  );
};

export default Tags;

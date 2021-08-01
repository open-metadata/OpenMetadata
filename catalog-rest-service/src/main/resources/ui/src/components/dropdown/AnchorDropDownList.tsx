import React from 'react';
import { DropDownListItem, DropDownListProp } from './types';
import { Link } from 'react-router-dom';

const AnchorDropDownList = ({ dropDownList, setIsOpen }: DropDownListProp) => {
  return (
    <>
      <button
        className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0"
        onClick={() => setIsOpen && setIsOpen(false)}
      />
      <div
        aria-labelledby="menu-button"
        aria-orientation="vertical"
        className="tw-origin-top-right tw-absolute tw-z-10
              tw-right-0 tw-mt-2 tw-w-32 tw-rounded-md tw-shadow-lg 
              tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none"
        role="menu">
        <div className="py-1" role="none">
          {dropDownList.map((item: DropDownListItem, index: number) => (
            <Link
              aria-disabled={item.disabled}
              className="link-text tw-block tw-px-4 tw-py-2 hover:tw-bg-gray-200"
              id={`menu-item-${index}`}
              key={index}
              role="menuitem"
              to={item.to as string}
              onClick={() => {
                item.method && item.method();
                setIsOpen && setIsOpen(false);
              }}>
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default AnchorDropDownList;

import React from 'react';

const Avatar = ({ name, width = '36' }: { name: string; width?: string }) => {
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
    <div
      className="tw-flex tw-justify-center tw-items-center tw-align-middle"
      style={{
        height: `${width}px`,
        width: `${width}px`,
        borderRadius: '50%',
        background: getBgColorByCode(name?.charCodeAt(0)),
        color: 'black',
      }}>
      <p className="tw-self-center">{name?.[0]}</p>
    </div>
  );
};

export default Avatar;

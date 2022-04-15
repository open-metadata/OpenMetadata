import React from 'react';
import SVGIcons from '../../utils/SvgUtils';

interface LoginButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ssoBrandName: string;
  ssoBrandLogo?: string;
}

const LoginButton = ({
  ssoBrandName,
  ssoBrandLogo,
  ...props
}: LoginButtonProps) => {
  const svgIcon = ssoBrandLogo ? (
    <SVGIcons alt={`${ssoBrandName} Logo`} icon={ssoBrandLogo} width="30" />
  ) : null;

  return (
    <button className="tw-signin-button tw-mx-auto" {...props}>
      {svgIcon}
      <span className="tw-ml-3 tw-font-medium tw-text-grey-muted tw-text-xl">
        Sign in with {ssoBrandName}
      </span>
    </button>
  );
};

export default LoginButton;

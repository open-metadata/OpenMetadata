import React from "react";
import { getServiceTypeLogo } from "./ServiceUtils";

export interface ServiceLogoProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  serviceType: string;
}

const ServiceLogo: React.FC<ServiceLogoProps> = ({
  serviceType,
  className = "",
  alt,
  ...imgProps
}) => {
  return (
    <img
      {...imgProps}
      alt={alt || serviceType}
      className={className}
      src={getServiceTypeLogo(serviceType)}
    />
  );
};

export default ServiceLogo;

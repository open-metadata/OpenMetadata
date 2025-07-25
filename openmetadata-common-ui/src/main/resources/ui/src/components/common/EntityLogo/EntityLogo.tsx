import React from "react";
import { getEntityTypeIcon } from "./EntityUtils";

export interface EntityLogoProps extends React.SVGAttributes<SVGElement> {
  entityType: string;
}

const EntityLogo: React.FC<EntityLogoProps> = ({
  entityType,
  className = "",
  style,
  ...svgProps
}) => {
  const IconComponent = getEntityTypeIcon(entityType);

  if (!IconComponent) {
    return null;
  }

  return <IconComponent className={className} style={style} {...svgProps} />;
};

export default EntityLogo;

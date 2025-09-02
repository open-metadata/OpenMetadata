/**
 * Compound Card component that combines all card sub-components
 */
import { CardHeader } from './card-header';
import { CardRoot, CardBody, CardFooter } from './card';

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
  Root: CardRoot,
});

// For backward compatibility and ease of use
export default Card;
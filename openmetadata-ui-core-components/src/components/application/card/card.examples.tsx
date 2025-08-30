import { Card } from './card-compound';
import { Button } from '@/components/base/buttons/button';
import { Plus } from '@untitledui/icons';

/**
 * Example 1: Default Card with 1px border
 */
export const DefaultCardExample = () => {
  return (
    <Card border="sm" borderColor="light" radius="xl">
      <Card.Header
        title="Default Card"
        description="This card has small border with light color and 12px radius"
        actions={<Button size="sm">Action</Button>}
      />
      <Card.Body>
        <p>Card content goes here with default medium padding.</p>
      </Card.Body>
    </Card>
  );
};

/**
 * Example 2: Card with extra small border
 */
export const ThinBorderCardExample = () => {
  return (
    <Card border="xs" borderColor="lighter" shadow="sm">
      <Card.Header
        title="Thin Border Card"
        description="This card has extra small border with lighter color and small shadow"
      />
      <Card.Body>
        <p>Very subtle border for a lighter appearance.</p>
      </Card.Body>
    </Card>
  );
};

/**
 * Example 3: Border width variations
 */
export const BorderWidthVariationsExample = () => {
  const borderWidths = ['none', 'xs', 'sm', 'md', 'lg'] as const;
  
  return (
    <div className="space-y-4">
      {borderWidths.map((width) => (
        <Card key={width} border={width} borderColor="default" padding="sm">
          <Card.Body noPadding>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Border: {width}</span>
              <span className="text-sm text-gray-500">
                {width === 'none' ? 'No border' :
                 width === 'xs' ? '0.5px' :
                 width === 'sm' ? '1px' :
                 width === 'md' ? '2px' : '4px'}
              </span>
            </div>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};

/**
 * Example 5: Border color variations
 */
export const BorderColorVariationsExample = () => {
  const borderColors = ['lighter', 'light', 'default', 'dark', 'darker'] as const;
  
  return (
    <div className="space-y-4">
      {borderColors.map((color) => (
        <Card key={color} border="sm" borderColor={color} padding="sm">
          <Card.Body noPadding>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Border Color: {color}</span>
              <span className="text-sm text-gray-500">border-gray-{
                color === 'lighter' ? '100' :
                color === 'light' ? '200' :
                color === 'default' ? '300' :
                color === 'dark' ? '400' : '500'
              }</span>
            </div>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};

/**
 * Example 6: Card with shadow variations
 */
export const ShadowVariationsExample = () => {
  const shadows = ['none', 'sm', 'md', 'lg', 'xl'] as const;
  
  return (
    <div className="space-y-4">
      {shadows.map((shadow) => (
        <Card key={shadow} border="none" shadow={shadow}>
          <Card.Body>
            <h4 className="font-semibold mb-2">Shadow: {shadow}</h4>
            <p className="text-sm text-gray-600">
              This card has shadow-{shadow} with no border
            </p>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};

/**
 * Example 7: Card with different radius options
 */
export const RadiusVariationsExample = () => {
  const radiusOptions = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
  
  return (
    <div className="grid grid-cols-4 gap-4">
      {radiusOptions.map((radius) => (
        <Card 
          key={radius} 
          border="sm" 
          borderColor="light" 
          radius={radius}
          padding="sm"
        >
          <Card.Body noPadding>
            <div className="text-center">
              <p className="font-semibold">rounded-{radius}</p>
            </div>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};

/**
 * Example 8: Clickable card
 */
export const ClickableCardExample = () => {
  return (
    <Card
      border="sm"
      borderColor="light"
      shadow="sm"
      onClick={() => console.log('Card clicked!')}
    >
      <Card.Body>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Plus className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold">Clickable Card</h4>
            <p className="text-sm text-gray-500">Click me to trigger an action</p>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

/**
 * Example 9: Card with footer
 */
export const CardWithFooterExample = () => {
  return (
    <Card border="sm" borderColor="light" shadow="md">
      <Card.Header
        title="Card with Footer"
        description="This card demonstrates the footer component with actions"
      />
      <Card.Body>
        <p>Main content area with standard padding.</p>
      </Card.Body>
      <Card.Footer>
        <div className="flex justify-end gap-3">
          <Button color="secondary">Cancel</Button>
          <Button color="primary">Save Changes</Button>
        </div>
      </Card.Footer>
    </Card>
  );
};

/**
 * Example 10: Card grid with different styles
 */
export const CardGridExample = () => {
  const cards = [
    { title: 'Default', border: 'sm', borderColor: 'light', shadow: 'none' },
    { title: 'Thin Border', border: 'xs', borderColor: 'lighter', shadow: 'sm' },
    { title: 'Shadow Only', border: 'none', borderColor: 'light', shadow: 'md' },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card, index) => (
        <Card
          key={index}
          border={card.border}
          borderColor={card.borderColor}
          shadow={card.shadow}
        >
          <Card.Body>
            <h4 className="font-semibold mb-2">{card.title}</h4>
            <p className="text-sm text-gray-600">
              Border: {card.border}, Shadow: {card.shadow}
            </p>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};

/**
 * Example 11: Card with different backgrounds
 */
export const BackgroundVariationsExample = () => {
  const backgrounds = ['white', 'gray', 'transparent'] as const;
  
  return (
    <div className="space-y-4 bg-gray-100 p-6">
      {backgrounds.map((bg) => (
        <Card 
          key={bg} 
          border="sm" 
          borderColor="light"
          background={bg}
        >
          <Card.Body>
            <h4 className="font-semibold">Background: {bg}</h4>
            <p className="text-sm text-gray-600 mt-2">
              This card has a {bg} background
            </p>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

const TabComponent = ({ value, items, ...rest }) => {
  return (
    <Tabs value={value} variant="standard" {...rest}>
      {items.map(({ label, key }) => (
        <Tab key={key} label={label} value={key} />
      ))}
    </Tabs>
  );
};

export default TabComponent;

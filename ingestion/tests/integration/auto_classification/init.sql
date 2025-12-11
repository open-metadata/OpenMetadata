CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the example_table
CREATE TABLE example_table (
    customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    NHS_number VARCHAR(255),
    DWH_X10 VARCHAR(255),
    user_name VARCHAR(255),
    address VARCHAR(255),
    DWH_X20 VARCHAR(255),
    timestamp BIGINT,
    version VARCHAR(50),
    order_date DATE
);

-- Insert sample data
INSERT INTO example_table (NHS_number, DWH_X10, user_name, address, DWH_X20, timestamp, version, order_date)
VALUES
    ('999-064-3601', 'harsha@gmail.com', 'Harsha', '2240 W Ina Rd', '4242-4242-4242-4242', 1760000000123, 'v1', '2018-01-05'),
    ('999-468-5678', 'suresh@gmail.com', 'Suresh', '7192 Kalanianaole Hwy', '5555-5555-5555-4444', 1760000000131, 'v1.0', '2018-01-09'),
    ('999-813-4595', 'stelle@gmail.com', 'Stelle', '5900 N Cannon Ave', '4000-0566-5566-5556', 1760000000149, 'v1.1', '2018-01-12'),
    ('999-313-2993', 'peter@gmail.com', 'Peter', '4350 Main St', '2223-0031-2200-3222', 1760000000156, 'v2', '2018-01-22'),
    ('999-911-7562', 'teddy@gmail.com', 'Theodore', '903 W Main St', '5200-8282-8282-8210', 1760000000164, 'v3', '2018-01-26'),
    ('999-595-6195', 'akash@gmail.com', 'Akash', '2220 Coit Rd', '5105-1051-0510-5100', 1760000000172, 'v1', '2018-01-28'),
    ('999-056-4418', 'mary@gmail.com', 'Mary', '7 Southside Dr', '5328-7101-2269-1668', 1760000000180, 'V1', '2018-01-29'),
    ('999-329-1099', 'chirag@gmail.com', 'Chirag', '2929 S 25th Ave', '4801-8451-4627-0484', 1760000000198, 'v4', '2018-01-31');

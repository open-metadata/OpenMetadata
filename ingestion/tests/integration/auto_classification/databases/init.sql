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
    order_date DATE,
    academic_year_code INTEGER
);

-- Insert sample data.
-- user_name holds common English given names on purpose: the seeded SpacyRecognizer runs the
-- English NER model, and a name the model does not know yields no match at all rather than a
-- weak one.
-- customer_id is spelled out rather than left to gen_random_uuid() because the test asserts the
-- column stays untagged: the English NER model reads a chunk of roughly one random UUID in three
-- as a name, so random ids make that assertion a coin flip. These eight draw no NER match at all.
INSERT INTO example_table (customer_id, NHS_number, DWH_X10, user_name, address, DWH_X20, timestamp, version, order_date, academic_year_code)
VALUES
    ('ab2a790d-7564-442a-ae8e-61fe465fb044', '999-064-3601', 'harsha@gmail.com', 'John', '2240 W Ina Rd', '4242-4242-4242-4242', 1760000000123, 'v1', '2018-01-05', 1999),
    ('cfd660f6-a09c-4082-9338-a524c4943140', '999-468-5678', 'suresh@gmail.com', 'Michael', '7192 Kalanianaole Hwy', '5555-5555-5555-4444', 1760000000131, 'v1.0', '2018-01-09', 2000),
    ('0759c297-38b3-4b4b-b3ab-0cdaee89ce61', '999-813-4595', 'stelle@gmail.com', 'Sarah', '5900 N Cannon Ave', '4000-0566-5566-5556', 1760000000149, 'v1.1', '2018-01-12', 2001),
    ('7e4537e8-e644-4a72-8ede-83e3c5e1235e', '999-313-2993', 'peter@gmail.com', 'David', '4350 Main St', '2223-0031-2200-3222', 1760000000156, 'v2', '2018-01-22', 2002),
    ('fe47d346-5f61-4868-a2f6-88f745903280', '999-911-7562', 'teddy@gmail.com', 'Emily', '903 W Main St', '5200-8282-8282-8210', 1760000000164, 'v3', '2018-01-26', 2003),
    ('943242e2-eb30-48c7-9e1e-9f57911ca28a', '999-595-6195', 'akash@gmail.com', 'James', '2220 Coit Rd', '5105-1051-0510-5100', 1760000000172, 'v1', '2018-01-28', 2004),
    ('c27259a1-162b-4460-8864-6472f33fa076', '999-056-4418', 'mary@gmail.com', 'Jennifer', '7 Southside Dr', '5328-7101-2269-1668', 1760000000180, 'V1', '2018-01-29', 2005),
    ('d2abde12-37a0-4e7d-9554-1c8bee659e1d', '999-329-1099', 'chirag@gmail.com', 'Robert', '2929 S 25th Ave', '4801-8451-4627-0484', 1760000000198, 'v4', '2018-01-31', 2006);

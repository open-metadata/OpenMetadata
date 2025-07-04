-- Create authentication_config table
CREATE TABLE IF NOT EXISTS authentication_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    config_type VARCHAR(50) NOT NULL,
    config_value JSONB NOT NULL,
    encrypted_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Create index on provider
CREATE INDEX IF NOT EXISTS idx_auth_config_provider ON authentication_config(provider);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auth_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auth_config_updated_at
    BEFORE UPDATE ON authentication_config
    FOR EACH ROW
    EXECUTE FUNCTION update_auth_config_updated_at(); 
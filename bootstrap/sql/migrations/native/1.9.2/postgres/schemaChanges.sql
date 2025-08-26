-- Update entity_extension to move domain to array
update entity_extension set json = jsonb_set(json#-'{domain}', '{domains}',
jsonb_build_array(json#>'{domain}')) where json #>> '{domain}' is not null;
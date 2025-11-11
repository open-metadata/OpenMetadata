-- Pre-populate index mapping versions with 1.8.4 hashes to enable smart reindexing from the first upgrade
-- These hashes were computed from the 1.8.4 release branch
-- This ensures that the first upgrade using this feature will correctly detect changes

INSERT INTO index_mapping_versions (entityType, mappingHash, mappingJson, version, updatedAt, updatedBy) VALUES
('chart', '357fb478cedc60e4f2da327dcf14a213', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('classification', '1539e614d4a3d4356d5ec6662bb0e858', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('container', '7be28db3999be6f5f5c8f7917f87b83f', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('dashboard', '5f04f873711d82318a5baebe1ee05e56', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('database', '43621bd44ca7e8a95810c720e2fec206', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('domain', 'd6750e57c35c25675bf5292e51e89ecd', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('glossary', '569a3b864e6fde696f5760d735cdc23b', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('metric', '2fc0919738bc14e2d2c7309905a72fe6', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('mlmodel', 'aa736fc6eda09aa72ebdc93e6a4bdf98', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('pipeline', '4b762d5c04df867b91009a6d1413cabd', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('query', 'bd38e95a8ae7960ef4c39ab4d119b9cb', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('table', '5c3221ea938bae7a36118b31d786b4cb', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('tag', '777216174abe8111b7c6867a05e28a86', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('team', '8280850b87d66247058d4e60fd11c2ea', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('topic', 'f53864ed2469e281d5d942418e823020', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system'),
('user', 'f73729fc827c0bed5e287e1b390e6c32', '{}', '1.8.4', UNIX_TIMESTAMP() * 1000, 'system')
ON DUPLICATE KEY UPDATE
  mappingHash = VALUES(mappingHash),
  mappingJson = VALUES(mappingJson),
  version = VALUES(version),
  updatedAt = VALUES(updatedAt),
  updatedBy = VALUES(updatedBy);
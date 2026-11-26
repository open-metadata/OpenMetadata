-- Domain lineage rollup writers lock rows of this table, held until their transaction ends
-- (ADR:2026-11-26-domain-lineage-rollup-writers-lock-guard-rows-in-one-order). A domain write holds
-- 'domain-move' exclusively; a lineage write holds it shared, then the stripe of its edge, then the
-- stripes of the domain pairs it counts into, in sorted order. The rows always exist, so two writers
-- of a pair whose rollup row is not written yet still serialize.
CREATE TABLE IF NOT EXISTS domain_lineage_guard (
    id VARCHAR(16) NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO domain_lineage_guard (id) VALUES
    ('domain-move'), ('edge-00'), ('edge-01'), ('edge-02'), ('edge-03'), ('edge-04'), ('edge-05'),
    ('edge-06'), ('edge-07'), ('edge-08'), ('edge-09'), ('edge-10'), ('edge-11'), ('edge-12'),
    ('edge-13'), ('edge-14'), ('edge-15'), ('edge-16'), ('edge-17'), ('edge-18'), ('edge-19'),
    ('edge-20'), ('edge-21'), ('edge-22'), ('edge-23'), ('edge-24'), ('edge-25'), ('edge-26'),
    ('edge-27'), ('edge-28'), ('edge-29'), ('edge-30'), ('edge-31'), ('edge-32'), ('edge-33'),
    ('edge-34'), ('edge-35'), ('edge-36'), ('edge-37'), ('edge-38'), ('edge-39'), ('edge-40'),
    ('edge-41'), ('edge-42'), ('edge-43'), ('edge-44'), ('edge-45'), ('edge-46'), ('edge-47'),
    ('edge-48'), ('edge-49'), ('edge-50'), ('edge-51'), ('edge-52'), ('edge-53'), ('edge-54'),
    ('edge-55'), ('edge-56'), ('edge-57'), ('edge-58'), ('edge-59'), ('edge-60'), ('edge-61'),
    ('edge-62'), ('edge-63'), ('pair-00'), ('pair-01'), ('pair-02'), ('pair-03'), ('pair-04'),
    ('pair-05'), ('pair-06'), ('pair-07'), ('pair-08'), ('pair-09'), ('pair-10'), ('pair-11'),
    ('pair-12'), ('pair-13'), ('pair-14'), ('pair-15'), ('pair-16'), ('pair-17'), ('pair-18'),
    ('pair-19'), ('pair-20'), ('pair-21'), ('pair-22'), ('pair-23'), ('pair-24'), ('pair-25'),
    ('pair-26'), ('pair-27'), ('pair-28'), ('pair-29'), ('pair-30'), ('pair-31'), ('pair-32'),
    ('pair-33'), ('pair-34'), ('pair-35'), ('pair-36'), ('pair-37'), ('pair-38'), ('pair-39'),
    ('pair-40'), ('pair-41'), ('pair-42'), ('pair-43'), ('pair-44'), ('pair-45'), ('pair-46'),
    ('pair-47'), ('pair-48'), ('pair-49'), ('pair-50'), ('pair-51'), ('pair-52'), ('pair-53'),
    ('pair-54'), ('pair-55'), ('pair-56'), ('pair-57'), ('pair-58'), ('pair-59'), ('pair-60'),
    ('pair-61'), ('pair-62'), ('pair-63');

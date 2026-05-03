-- Audit log for swap orders. Partitioned monthly by created_at.
CREATE TABLE IF NOT EXISTS swap_orders (
  request_id              TEXT        NOT NULL,
  taker                   TEXT,
  input_mint              TEXT        NOT NULL,
  output_mint             TEXT        NOT NULL,
  in_amount               NUMERIC     NOT NULL,
  out_amount              NUMERIC     NOT NULL,
  slippage_bps            INT         NOT NULL,
  status                  TEXT        NOT NULL,
  signature               TEXT,
  payload                 JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, created_at)
) PARTITION BY RANGE (created_at);

-- Bootstrap monthly partitions for current and next 3 months.
-- Production: use pg_partman or a maintenance cron to roll forward.
CREATE TABLE IF NOT EXISTS swap_orders_2026_05 PARTITION OF swap_orders
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS swap_orders_2026_06 PARTITION OF swap_orders
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS swap_orders_2026_07 PARTITION OF swap_orders
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS swap_orders_2026_08 PARTITION OF swap_orders
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX IF NOT EXISTS idx_swap_orders_taker_created
  ON swap_orders (taker, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swap_orders_status
  ON swap_orders (status);

-- Sharding note: for >10k TPS use Citus and distribute by hash(taker) so all
-- orders for a given wallet co-locate (point-lookups + per-wallet rate limit).


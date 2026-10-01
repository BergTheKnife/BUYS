-- Retroactively applies "Cassa Reinvestimento" coverage to inventory stock-in
-- expenses (new items + restocks) that were created while quota_cassa was
-- hardcoded to 0, i.e. before this withdrawal was wired back up.
--
-- For every activity, this replays fund transfers into "Cassa Reinvestimento",
-- pre-existing cash-box adjustments (financial_history rows with
-- azione = 'Cassa Reinvestimento') and uncovered inventory stock-in expenses
-- (inventory_batches with a linked spesa and quota_cassa = 0) in chronological
-- order, exactly like the live code path does, so a stock-in only gets
-- covered by cash that was actually available in the box at that point in
-- time.
--
-- Safe to run multiple times: once a batch is covered (quota_cassa <> 0) it is
-- excluded from the next run.
DO $$
DECLARE
  act RECORD;
  ev RECORD;
  v_balance numeric;
  v_coverage numeric;
BEGIN
  FOR act IN SELECT id FROM activities LOOP
    v_balance := 0;

    FOR ev IN
      SELECT * FROM (
        SELECT
          ft.data AS ts, ft.created_at AS created_at,
          CAST(ft.importo AS numeric) AS amount,
          'deposit'::text AS kind,
          NULL::uuid AS batch_id, NULL::uuid AS inventario_id,
          NULL::uuid AS user_id, NULL::text AS voce
        FROM fund_transfers ft
        WHERE ft.activity_id = act.id AND ft.to_account = 'Cassa Reinvestimento'

        UNION ALL

        SELECT
          fh.data AS ts, fh.created_at AS created_at,
          CAST(fh.importo AS numeric) AS amount,
          'adjustment'::text AS kind,
          NULL::uuid, NULL::uuid, NULL::uuid, NULL::text
        FROM financial_history fh
        WHERE fh.activity_id = act.id AND fh.azione = 'Cassa Reinvestimento'

        UNION ALL

        SELECT
          ib.data_acquisto AS ts, ib.created_at AS created_at,
          CAST(s.importo AS numeric) AS amount,
          'stockin'::text AS kind,
          ib.id AS batch_id, ib.inventario_id, ib.user_id, s.voce
        FROM inventory_batches ib
        JOIN spese s ON s.id = ib.spesa_id
        WHERE ib.activity_id = act.id
          AND ib.spesa_id IS NOT NULL
          AND COALESCE(ib.quota_cassa, 0) = 0
      ) events
      ORDER BY ts, created_at
    LOOP
      IF ev.kind IN ('deposit', 'adjustment') THEN
        v_balance := v_balance + ev.amount;
      ELSIF ev.kind = 'stockin' AND v_balance > 0 THEN
        v_coverage := LEAST(v_balance, ev.amount);
        IF v_coverage > 0 THEN
          UPDATE inventory_batches SET quota_cassa = v_coverage WHERE id = ev.batch_id;
          UPDATE inventario SET cassa_coverage = COALESCE(cassa_coverage, 0) + v_coverage WHERE id = ev.inventario_id;

          INSERT INTO financial_history (user_id, activity_id, azione, descrizione, importo, data)
          VALUES (
            ev.user_id,
            act.id,
            'Cassa Reinvestimento',
            'Riconciliazione storica: spesa coperta da cassa reinvestimento: ' || ev.voce,
            (-v_coverage)::numeric,
            now()
          );

          v_balance := v_balance - v_coverage;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

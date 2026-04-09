-- Anonymous-account traffic relief: per-account write quota window.

CREATE TABLE IF NOT EXISTS anonymous_write_quota (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  write_count integer NOT NULL DEFAULT 0 CHECK (write_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE anonymous_write_quota ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION consume_anonymous_write_quota(
  p_user_id uuid,
  p_limit int DEFAULT 20,
  p_window_seconds int DEFAULT 300
)
RETURNS TABLE (
  allowed boolean,
  remaining int,
  reset_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_row anonymous_write_quota%ROWTYPE;
  v_window_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit options' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM anonymous_write_quota
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO anonymous_write_quota (
      user_id,
      window_started_at,
      write_count,
      updated_at
    )
    VALUES (
      p_user_id,
      v_now,
      1,
      v_now
    );

    RETURN QUERY
    SELECT true, p_limit - 1, v_now + make_interval(secs => p_window_seconds);
    RETURN;
  END IF;

  v_window_end := v_row.window_started_at + make_interval(secs => p_window_seconds);

  IF v_now >= v_window_end THEN
    UPDATE anonymous_write_quota
    SET
      window_started_at = v_now,
      write_count = 1,
      updated_at = v_now
    WHERE user_id = p_user_id;

    RETURN QUERY
    SELECT true, p_limit - 1, v_now + make_interval(secs => p_window_seconds);
    RETURN;
  END IF;

  IF v_row.write_count >= p_limit THEN
    RETURN QUERY
    SELECT false, 0, v_window_end;
    RETURN;
  END IF;

  UPDATE anonymous_write_quota
  SET
    write_count = v_row.write_count + 1,
    updated_at = v_now
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT true, p_limit - (v_row.write_count + 1), v_window_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_anonymous_write_quota(
  uuid,
  int,
  int
) TO authenticated;

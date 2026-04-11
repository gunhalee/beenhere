-- Make report_post explicitly return whether the report already existed.
-- Return type changes from void -> jsonb; must drop first (CREATE OR REPLACE is not enough).

DROP FUNCTION IF EXISTS public.report_post(uuid, text);

CREATE OR REPLACE FUNCTION public.report_post(
  p_post_id uuid,
  p_reason_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reports (post_id, reporter_id, reason_code)
  VALUES (p_post_id, auth.uid(), p_reason_code)
  ON CONFLICT (post_id, reporter_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'already_reported',
    v_inserted_count = 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_post(uuid, text) TO authenticated;

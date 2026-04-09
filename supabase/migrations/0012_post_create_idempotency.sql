-- Traffic-relief: idempotent post creation for safe client retries.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_author_client_request_id
  ON posts(author_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION create_post(
  p_content           text,
  p_latitude          float8,
  p_longitude         float8,
  p_place_label       text,
  p_client_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_id uuid;
  v_existing_post_id uuid;
  v_client_request_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  v_client_request_id := NULLIF(trim(p_client_request_id), '');

  IF v_client_request_id IS NOT NULL THEN
    SELECT p.id INTO v_existing_post_id
    FROM posts p
    WHERE p.author_id = auth.uid()
      AND p.client_request_id = v_client_request_id
    LIMIT 1;

    IF v_existing_post_id IS NOT NULL THEN
      RETURN jsonb_build_object('post_id', v_existing_post_id);
    END IF;
  END IF;

  INSERT INTO posts (author_id, content, client_request_id)
  VALUES (auth.uid(), p_content, v_client_request_id)
  RETURNING id INTO v_post_id;

  INSERT INTO post_locations (post_id, shared_by_id, latitude, longitude, place_label)
  VALUES (v_post_id, auth.uid(), p_latitude, p_longitude, p_place_label);

  RETURN jsonb_build_object('post_id', v_post_id);
EXCEPTION
  WHEN unique_violation THEN
    IF v_client_request_id IS NULL THEN
      RAISE;
    END IF;

    SELECT p.id INTO v_existing_post_id
    FROM posts p
    WHERE p.author_id = auth.uid()
      AND p.client_request_id = v_client_request_id
    LIMIT 1;

    IF v_existing_post_id IS NULL THEN
      RAISE;
    END IF;

    RETURN jsonb_build_object('post_id', v_existing_post_id);
END;
$$;

-- Keep the historical 4-arg contract alive for older callers.
CREATE OR REPLACE FUNCTION create_post(
  p_content     text,
  p_latitude    float8,
  p_longitude   float8,
  p_place_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.create_post(
    p_content,
    p_latitude,
    p_longitude,
    p_place_label,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post(
  text,
  double precision,
  double precision,
  text,
  text
) TO authenticated;


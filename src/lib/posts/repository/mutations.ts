import type { CreatePostRpcResult, LikePostRpcResult } from "@/types/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createPostRepository(input: {
  content: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
  clientRequestId?: string;
}): Promise<CreatePostRpcResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_post", {
    p_content: input.content.trim(),
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_place_label: input.placeLabel.trim(),
    p_client_request_id: input.clientRequestId?.trim() || null,
  });

  if (error) throw error;

  return data as CreatePostRpcResult;
}

export async function likePostRepository(input: {
  postId: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
}): Promise<LikePostRpcResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("like_post", {
    p_post_id: input.postId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_place_label: input.placeLabel.trim(),
  });

  if (error) throw error;

  return data as LikePostRpcResult;
}

export async function unlikePostRepository(postId: string): Promise<LikePostRpcResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("unlike_post", {
    p_post_id: postId,
  });

  if (error) throw error;

  return data as LikePostRpcResult;
}

export async function deletePostRepository(postId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("delete_post", {
    p_post_id: postId,
  });

  if (error) throw error;
}

export async function reportPostRepository(input: {
  postId: string;
  reasonCode: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("report_post", {
    p_post_id: input.postId,
    p_reason_code: input.reasonCode,
  });

  if (error) throw error;
}

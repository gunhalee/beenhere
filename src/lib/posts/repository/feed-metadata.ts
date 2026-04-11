import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  FeedPostLikersPreviewRow,
  FeedPostMetadataRow,
} from "@/types/db";

export async function getFeedPostMetadataBatchRepository(input: {
  latitude: number;
  longitude: number;
  postIds: string[];
}): Promise<FeedPostMetadataRow[]> {
  if (!hasSupabaseBrowserConfig() || input.postIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_feed_post_metadata_batch", {
    viewer_lat: input.latitude,
    viewer_lng: input.longitude,
    post_ids: input.postIds,
  });

  if (error) throw error;
  return (data as FeedPostMetadataRow[] | null) ?? [];
}

export async function getFeedPostLikersPreviewBatchRepository(input: {
  latitude: number;
  longitude: number;
  postIds: string[];
}): Promise<FeedPostLikersPreviewRow[]> {
  if (!hasSupabaseBrowserConfig() || input.postIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_feed_post_likers_preview_batch", {
    viewer_lat: input.latitude,
    viewer_lng: input.longitude,
    post_ids: input.postIds,
  });

  if (error) throw error;
  return (data as FeedPostLikersPreviewRow[] | null) ?? [];
}

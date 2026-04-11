import {
  getPostLikersRepository,
  getProfileLikesRepository,
  getProfilePostsRepository,
} from "@/lib/profiles/repository";

type ProfileListInput = {
  userId: string;
  cursor?: string;
  limit: number;
  latitude?: number;
  longitude?: number;
};

export async function getProfilePostsList(input: ProfileListInput) {
  return getProfilePostsRepository(input);
}

export async function getProfileLikesList(input: ProfileListInput) {
  return getProfileLikesRepository(input);
}

export async function getPostLikersList(input: {
  postId: string;
  cursor?: string;
  limit: number;
}) {
  return getPostLikersRepository(input);
}

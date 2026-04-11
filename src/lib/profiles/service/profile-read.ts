import { getMyProfileRepository, getProfileRepository } from "@/lib/profiles/repository";

export async function getPublicProfile(input: { userId: string }) {
  return getProfileRepository(input.userId);
}

export async function getViewerProfile() {
  return getMyProfileRepository();
}

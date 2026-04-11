import { ProfileScreen } from "@/components/profile/profile-screen";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { userId } = await params;

  return <ProfileScreen userId={userId} />;
}


// Home feed route. Middleware enforces authenticated sessions for app pages.

import { FeedScreen } from "@/components/feed/feed-screen";

export default function HomePage() {
  return <FeedScreen />;
}


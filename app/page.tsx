import Board from "./components/Board";
import { getLivePosts } from "@/lib/posts";

export const revalidate = 10;

export default async function Home() {
  const initialPosts = await getLivePosts();
  return <Board initialPosts={initialPosts} />;
}

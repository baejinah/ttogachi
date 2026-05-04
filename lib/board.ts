import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type Post = {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  authorColor: string;
  isPinned: boolean;
  createdAt: Timestamp | null;
};

const postsCol = (familyId: string) =>
  collection(db, "families", familyId, "posts");

export async function createPost(
  familyId: string,
  data: {
    title: string;
    content: string;
    authorUid: string;
    authorName: string;
    authorColor: string;
  }
): Promise<void> {
  await addDoc(postsCol(familyId), {
    ...data,
    isPinned: false,
    createdAt: serverTimestamp(),
  });
}

export async function deletePost(
  familyId: string,
  postId: string
): Promise<void> {
  await deleteDoc(doc(db, "families", familyId, "posts", postId));
}

export async function togglePin(
  familyId: string,
  postId: string,
  isPinned: boolean
): Promise<void> {
  await updateDoc(doc(db, "families", familyId, "posts", postId), {
    isPinned: !isPinned,
  });
}

export function subscribePosts(
  familyId: string,
  callback: (posts: Post[]) => void
): () => void {
  return onSnapshot(postsCol(familyId), (snap) => {
    const posts: Post[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Post, "id">),
    }));
    posts.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const aTime = a.createdAt?.toMillis() ?? 0;
      const bTime = b.createdAt?.toMillis() ?? 0;
      return bTime - aTime;
    });
    callback(posts);
  });
}

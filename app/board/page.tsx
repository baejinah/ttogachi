"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  createPost,
  deletePost,
  subscribePosts,
  togglePin,
  type Post,
} from "@/lib/board";
import type { Family } from "@/lib/types";

export default function BoardPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const [family, setFamily] = useState<Family | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (userDoc && !userDoc.familyId) router.replace("/onboarding");
  }, [loading, user, userDoc, router]);

  useEffect(() => {
    if (!userDoc?.familyId) return;
    return onSnapshot(doc(db, "families", userDoc.familyId), (snap) => {
      if (snap.exists()) {
        setFamily({ id: snap.id, ...(snap.data() as Omit<Family, "id">) });
      }
    });
  }, [userDoc?.familyId]);

  useEffect(() => {
    if (!userDoc?.familyId) return;
    return subscribePosts(userDoc.familyId, setPosts);
  }, [userDoc?.familyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userDoc?.familyId || !family) return;
    const me = family.members[user.uid];
    if (!me) return;
    setSubmitting(true);
    try {
      await createPost(userDoc.familyId, {
        title: title.trim(),
        content: content.trim(),
        authorUid: user.uid,
        authorName: me.displayName,
        authorColor: me.color,
      });
      setTitle("");
      setContent("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user || !userDoc || !userDoc.familyId || !family) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← 메인
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">가족 게시판</h1>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + 새 글
          </button>
        )}
      </header>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4"
        >
          <input
            type="text"
            placeholder="제목"
            required
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <textarea
            placeholder="내용 (서류 정보, 예약, 공지 등)"
            required
            maxLength={2000}
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setTitle("");
                setContent("");
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      )}

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">
            아직 글이 없어요. 첫 글을 작성해주세요.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <PostItem
              key={p.id}
              post={p}
              isAuthor={p.authorUid === user.uid}
              familyId={userDoc.familyId!}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function PostItem({
  post,
  isAuthor,
  familyId,
}: {
  post: Post;
  isAuthor: boolean;
  familyId: string;
}) {
  const handleDelete = async () => {
    if (!confirm("정말 삭제할까요?")) return;
    await deletePost(familyId, post.id);
  };

  const handlePin = async () => {
    await togglePin(familyId, post.id, post.isPinned);
  };

  const dateText = post.createdAt
    ? post.createdAt.toDate().toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "방금";

  return (
    <li
      className={`rounded-2xl border p-4 ${
        post.isPinned
          ? "border-amber-300 bg-amber-50"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {post.isPinned && (
            <span className="text-amber-600" title="고정됨">
              📌
            </span>
          )}
          <h3 className="font-semibold text-zinc-900">{post.title}</h3>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={handlePin}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
          >
            {post.isPinned ? "고정 해제" : "고정"}
          </button>
          {isAuthor && (
            <button
              onClick={handleDelete}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>
      <p className="mb-3 whitespace-pre-wrap text-sm text-zinc-700">
        {post.content}
      </p>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: post.authorColor }}
        />
        <span>{post.authorName}</span>
        <span>·</span>
        <span>{dateText}</span>
      </div>
    </li>
  );
}

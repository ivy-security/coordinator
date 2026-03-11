"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Calendar, LogOut, Plus } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl">
          <Calendar className="w-6 h-6" />
          <span>Coordinator</span>
        </Link>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/meetings/new"
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Meeting
              </Link>
              <div className="flex items-center gap-3">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-stone-600 hidden sm:block">
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-stone-400 hover:text-stone-600 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

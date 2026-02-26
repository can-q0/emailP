"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Mail, FileText, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-card-border bg-[#FAF7F2]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span className="font-semibold tracking-tight">EmailP</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link href="/patients">
              <Button variant="ghost" size="sm">
                <Users className="w-4 h-4 mr-1" />
                Patients
              </Button>
            </Link>
            <Link href="/report">
              <Button variant="ghost" size="sm">
                <FileText className="w-4 h-4 mr-1" />
                Reports
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt=""
              className="w-7 h-7 rounded-full"
            />
          )}
          <span className="text-sm text-text-secondary">
            {session.user?.name}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

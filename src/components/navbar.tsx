"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mail, FileText, LogOut, Users, Settings, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

export function Navbar() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  if (!session) return null;

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: null },
    { href: "/patients", label: "Patients", icon: Users },
    { href: "/report", label: "Reports", icon: FileText },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-card-border bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <span className="font-semibold tracking-tight">EmailP</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <Button variant="ghost" size="sm">
                    {Icon && <Icon className="w-4 h-4 mr-1" />}
                    {label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop user dropdown */}
            <div className="hidden md:block relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-card-hover transition-colors cursor-pointer"
              >
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
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-card-border bg-card shadow-lg py-1 z-50">
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-card-hover transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-foreground hover:bg-card-hover transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-card-hover transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-out menu */}
      <Sheet open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} side="left">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 h-14 border-b border-card-border">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <span className="font-semibold tracking-tight">EmailP</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-card-hover transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {session.user && (
            <div className="px-4 py-3 border-b border-card-border">
              <div className="flex items-center gap-3">
                {session.user.image && (
                  <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{session.user.name}</p>
                  <p className="text-xs text-text-muted truncate">{session.user.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 py-2">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-card-hover transition-colors"
              >
                {Icon ? <Icon className="w-4 h-4 text-text-secondary" /> : <Mail className="w-4 h-4 text-text-secondary" />}
                {label}
              </Link>
            ))}
            <Link
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-card-hover transition-colors"
            >
              <Settings className="w-4 h-4 text-text-secondary" />
              Settings
            </Link>
          </div>

          <div className="border-t border-card-border py-2">
            <button
              onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: "/" }); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-card-hover transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-text-secondary" />
              Sign Out
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

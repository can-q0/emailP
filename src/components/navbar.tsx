"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, FileText, LogOut, Users, Settings, Menu, X, Search, GraduationCap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";

export function Navbar() {
  const { data: session } = useSession();
  const { isDemoMode, startTour } = useOnboarding();
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
    { href: "/search", label: "Search", icon: Search },
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
            <div data-tour="nav-links" className="hidden md:flex items-center gap-1">
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
            {/* Demo mode badge */}
            {isDemoMode && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-600">Demo</span>
              </div>
            )}
            {/* Restart tour */}
            <button
              onClick={() => startTour("dashboard")}
              className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer"
              title="Turu tekrar başlat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
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

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-1 w-48 rounded-xl border border-card-border bg-card shadow-lg py-1 z-50"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
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
            {navLinks.map(({ href, label, icon: Icon }, i) => (
              <motion.div
                key={href}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Link
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-card-hover transition-colors"
                >
                  {Icon ? <Icon className="w-4 h-4 text-text-secondary" /> : <Mail className="w-4 h-4 text-text-secondary" />}
                  {label}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: navLinks.length * 0.05, duration: 0.25 }}
            >
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-card-hover transition-colors"
              >
                <Settings className="w-4 h-4 text-text-secondary" />
                Settings
              </Link>
            </motion.div>
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

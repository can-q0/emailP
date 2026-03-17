"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { ProgressiveSearch } from "@/components/search/progressive-search";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export default function SearchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-14 w-full mt-4 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="p-3 rounded-2xl bg-primary/10"
            >
              <Search className="w-6 h-6 text-primary" />
            </motion.div>
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="text-2xl sm:text-3xl font-bold"
              >
                Arama
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-text-secondary text-sm"
              >
                Hasta, email ve kan değerlerini tek bir arama çubuğundan arayın
              </motion.p>
            </div>
          </div>
        </div>

        <ProgressiveSearch />
      </PageTransition>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { PatientCandidate } from "@/types";
import { User, Mail, Calendar, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientSelectorProps {
  candidates: PatientCandidate[];
  onSelect: (candidate: PatientCandidate) => void;
}

export function PatientSelector({
  candidates,
  onSelect,
}: PatientSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-1">
          Multiple patients found
        </h3>
        <p className="text-sm text-text-secondary">
          Select the correct patient to continue
        </p>
      </div>

      <div className="grid gap-3">
        {candidates.map((candidate, i) => (
          <motion.div
            key={candidate.id || i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <GlassCard
              className={cn(
                "p-5 cursor-pointer transition-all",
                "hover:border-primary/30 hover:shadow-md"
              )}
              onClick={() => onSelect(candidate)}
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xl bg-primary/10">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{candidate.name}</h4>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-text-secondary">
                    {candidate.governmentId && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" />
                        {candidate.governmentId}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {candidate.emailCount} emails
                    </span>
                    {candidate.lastEmailDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(candidate.lastEmailDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

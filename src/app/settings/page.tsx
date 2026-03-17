"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Settings, Brain, Mail, User, ArrowLeft, Bell, GraduationCap } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";

interface UserSettings {
  aiModel: string;
  reportLanguage: string;
  reportDetailLevel: string;
  customSystemPrompt: string | null;
  autoClassify: boolean;
  emailNotifications: boolean;
  displayName: string | null;
  theme: string;
}

const MODEL_OPTIONS = [
  { value: "gpt-5", label: "GPT-5" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "tr", label: "Turkish" },
];

const DETAIL_LEVEL_OPTIONS = [
  { value: "summary", label: "Summary" },
  { value: "detailed", label: "Detailed" },
  { value: "graphical", label: "Graphical" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { setTheme } = useTheme();
  const { resetOnboarding } = useOnboarding();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/settings")
        .then(async (r) => {
          if (!r.ok) throw new Error("Failed to load settings");
          const data = await r.json();
          setSettings(data);
          if (data.theme) setTheme(data.theme as "light" | "dark" | "system");
        })
        .catch(() => setError("Failed to load settings"));
    }
  }, [status, router]);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiModel: settings.aiModel,
          reportLanguage: settings.reportLanguage,
          reportDetailLevel: settings.reportDetailLevel,
          customSystemPrompt: settings.customSystemPrompt || null,
          autoClassify: settings.autoClassify,
          emailNotifications: settings.emailNotifications,
          displayName: settings.displayName || null,
          theme: settings.theme,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const updated = await res.json();
      setSettings(updated);
      setTheme(updated.theme as "light" | "dark" | "system");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || (!settings && !error)) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-card-border/50 rounded-lg" />
          <div className="h-64 bg-card-border/30 rounded-2xl" />
          <div className="h-32 bg-card-border/30 rounded-2xl" />
          <div className="h-40 bg-card-border/30 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>
        <GlassCard className="p-6">
          <p className="text-severity-high">{error}</p>
        </GlassCard>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-card-hover transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      {/* Tutorial / Onboarding */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <GraduationCap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold">Egitici Tur</h2>
              <p className="text-xs text-text-muted">
                Uygulamanin nasil kullanildigini adim adim ogrenin
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={resetting}
            onClick={async () => {
              setResetting(true);
              await resetOnboarding();
              router.push("/dashboard");
            }}
          >
            <GraduationCap className="w-4 h-4 mr-1.5" />
            {resetting ? "Hazirlaniyor..." : "Turu Baslat"}
          </Button>
        </div>
      </GlassCard>

      {/* AI Preferences */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-center gap-2 text-foreground">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">AI Preferences</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              AI Model
            </label>
            <Select
              options={MODEL_OPTIONS}
              value={settings.aiModel}
              onChange={(e) =>
                setSettings({ ...settings, aiModel: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Report Language
            </label>
            <Select
              options={LANGUAGE_OPTIONS}
              value={settings.reportLanguage}
              onChange={(e) =>
                setSettings({ ...settings, reportLanguage: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Default Detail Level
            </label>
            <Select
              options={DETAIL_LEVEL_OPTIONS}
              value={settings.reportDetailLevel}
              onChange={(e) =>
                setSettings({ ...settings, reportDetailLevel: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Custom System Prompt
            </label>
            <Textarea
              placeholder="Optional: Add custom instructions for AI report generation..."
              value={settings.customSystemPrompt || ""}
              onChange={(e) =>
                setSettings({ ...settings, customSystemPrompt: e.target.value })
              }
              rows={3}
            />
            <p className="text-xs text-text-muted mt-1">
              This will be appended to the default system prompt when generating
              reports.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Email Sync */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-center gap-2 text-foreground">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Email Sync</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto-classify emails</p>
            <p className="text-xs text-text-muted">
              Automatically classify synced emails as lab reports using AI
            </p>
          </div>
          <Toggle
            checked={settings.autoClassify}
            onChange={(checked) =>
              setSettings({ ...settings, autoClassify: checked })
            }
          />
        </div>
      </GlassCard>

      {/* Notifications */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-center gap-2 text-foreground">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Notifications</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Email notifications</p>
            <p className="text-xs text-text-muted">
              Receive an email when a report finishes generating
            </p>
          </div>
          <Toggle
            checked={settings.emailNotifications}
            onChange={(checked) =>
              setSettings({ ...settings, emailNotifications: checked })
            }
          />
        </div>
      </GlassCard>

      {/* Profile & Display */}
      <GlassCard className="p-6 space-y-5">
        <div className="flex items-center gap-2 text-foreground">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Profile & Display</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Display Name
            </label>
            <Input
              placeholder="Your display name"
              value={settings.displayName || ""}
              onChange={(e) =>
                setSettings({ ...settings, displayName: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Theme
            </label>
            <Select
              options={THEME_OPTIONS}
              value={settings.theme}
              onChange={(e) =>
                setSettings({ ...settings, theme: e.target.value })
              }
            />
          </div>
        </div>
      </GlassCard>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">
            Settings saved!
          </span>
        )}
        {error && (
          <span className="text-sm text-severity-high font-medium">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

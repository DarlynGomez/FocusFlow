import { useState } from "react";
import {
  BookOpen,
  Accessibility,
  Bot,
  UserRound,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | boolean | undefined)[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type Tab = "reading" | "accessibility" | "ai" | "account";
type GuidanceLevel = "light" | "medium" | "heavy";
type TextSize = "small" | "medium" | "large";
type ReadingWidth = "compact" | "normal" | "wide";
type LineSpacing = "normal" | "relaxed" | "spacious";
type InterventionStyle = "gentle" | "detailed" | "checkin";
type InterruptFrequency = "once" | "freely" | "manual";

const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: "reading", label: "Reading Defaults", icon: BookOpen },
  { key: "accessibility", label: "Accessibility", icon: Accessibility },
  { key: "ai", label: "AI & Interventions", icon: Bot },
  { key: "account", label: "Account", icon: UserRound },
];

/* ------------------------------------------------------------------ */
/*  Small reusable pieces                                             */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase mb-4">
      {children}
    </p>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && (
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0 ml-6">{children}</div>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        enabled ? "bg-indigo-500" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RadioCard({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-6 py-4 text-center transition-all cursor-pointer",
        selected
          ? "border-indigo-400 bg-indigo-50/40"
          : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function ListRadio({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-xl border-2 px-5 py-4 text-left transition-all",
        selected
          ? "border-indigo-400 bg-indigo-50/40"
          : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
          selected ? "border-indigo-500" : "border-slate-300"
        )}
      >
        {selected && (
          <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab panels                                                        */
/* ------------------------------------------------------------------ */

function ReadingDefaultsPanel() {
  const [guidanceLevel, setGuidanceLevel] = useState<GuidanceLevel>("medium");
  const [textSize, setTextSize] = useState<TextSize>("medium");
  const [pauseThreshold, setPauseThreshold] = useState(15);
  const [readingWidth, setReadingWidth] = useState<ReadingWidth>("normal");

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Reading Defaults</h2>
      <p className="text-sm text-slate-400 mt-1 mb-6">
        These apply every time a new document is opened, so you don't have to
        reconfigure each session.
      </p>

      <SettingRow
        label="Default guidance level"
        description="How much AI assistance you receive while reading"
      >
        <Select
          value={guidanceLevel}
          onChange={(v) => setGuidanceLevel(v as GuidanceLevel)}
          options={[
            { value: "light", label: "Light — minimal" },
            { value: "medium", label: "Medium — balance" },
            { value: "heavy", label: "Heavy — maximum" },
          ]}
        />
      </SettingRow>

      <SettingRow
        label="Default text size"
        description="Base font size for document body text"
      >
        <Select
          value={textSize}
          onChange={(v) => setTextSize(v as TextSize)}
          options={[
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]}
        />
      </SettingRow>

      <SettingRow
        label="Pause threshold"
        description="Seconds of inactivity before an AI intervention triggers"
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={120}
            value={pauseThreshold}
            onChange={(e) => setPauseThreshold(Number(e.target.value))}
            className="w-40 accent-indigo-500"
          />
          <span className="text-sm font-medium text-indigo-500 w-10 text-right">
            {pauseThreshold}s
          </span>
        </div>
      </SettingRow>

      {/* Reading width cards */}
      <div className="mt-6">
        <p className="text-sm font-medium text-slate-800 mb-3">
          Preferred reading width
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { key: "compact", label: "Compact", widthClass: "w-8 h-10" },
              { key: "normal", label: "Normal", widthClass: "w-12 h-10" },
              { key: "wide", label: "Wide", widthClass: "w-16 h-10" },
            ] as const
          ).map(({ key, label, widthClass }) => (
            <RadioCard
              key={key}
              selected={readingWidth === key}
              onClick={() => setReadingWidth(key)}
            >
              <div className="flex justify-center mb-2">
                <div
                  className={cn("rounded bg-slate-300", widthClass)}
                />
              </div>
              <p className="text-sm font-medium text-slate-700">{label}</p>
            </RadioCard>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccessibilityPanel() {
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>("normal");
  const [wordSpacing, setWordSpacing] = useState(0);
  const [tts, setTts] = useState(false);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">
        Accessibility Preferences
      </h2>
      <p className="text-sm text-slate-400 mt-1 mb-6">
        Adjustments to make reading more comfortable for your needs.
      </p>

      <SectionLabel>Visual</SectionLabel>

      <SettingRow
        label="High contrast mode"
        description="Increases foreground/background contrast throughout the app"
      >
        <Toggle enabled={highContrast} onChange={setHighContrast} />
      </SettingRow>

      <SettingRow
        label="Dyslexia-friendly font"
        description="Switches body text to OpenDyslexic for improved readability"
      >
        <Toggle enabled={dyslexiaFont} onChange={setDyslexiaFont} />
      </SettingRow>

      <SettingRow
        label="Reduced motion"
        description="Turns off fading animations and transitions"
      >
        <Toggle enabled={reducedMotion} onChange={setReducedMotion} />
      </SettingRow>

      {/* Line spacing */}
      <div className="mt-6 mb-6">
        <p className="text-sm font-medium text-slate-800 mb-3">Line spacing</p>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { key: "normal", label: "Normal", sub: "1.5\u00d7" },
              { key: "relaxed", label: "Relaxed", sub: "1.8\u00d7" },
              { key: "spacious", label: "Spacious", sub: "2.2\u00d7" },
            ] as const
          ).map(({ key, label, sub }) => (
            <RadioCard
              key={key}
              selected={lineSpacing === key}
              onClick={() => setLineSpacing(key)}
            >
              <p className="text-sm font-medium text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">{sub}</p>
            </RadioCard>
          ))}
        </div>
      </div>

      {/* Word spacing */}
      <SettingRow
        label="Word spacing"
        description="Extra space between words"
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={10}
            value={wordSpacing}
            onChange={(e) => setWordSpacing(Number(e.target.value))}
            className="w-40 accent-indigo-500"
          />
          <span className="text-sm font-medium text-indigo-500 w-16 text-right">
            {wordSpacing === 0 ? "Default" : `+${wordSpacing}px`}
          </span>
        </div>
      </SettingRow>

      <div className="mt-4">
        <SectionLabel>Audio</SectionLabel>
        <SettingRow
          label="Text to speech"
          description="Have sections read aloud as you scroll"
        >
          <Toggle enabled={tts} onChange={setTts} />
        </SettingRow>
      </div>
    </div>
  );
}

function AIInterventionsPanel() {
  const [style, setStyle] = useState<InterventionStyle>("gentle");
  const [frequency, setFrequency] = useState<InterruptFrequency>("once");
  const [proactive, setProactive] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">AI & Interventions</h2>
      <p className="text-sm text-slate-400 mt-1 mb-6">
        Control how and when the AI assistant engages with you.
      </p>

      <SectionLabel>Intervention behaviour</SectionLabel>

      <p className="text-sm font-medium text-slate-800 mb-3">
        Intervention style
      </p>
      <div className="space-y-2 mb-8">
        <ListRadio
          selected={style === "gentle"}
          onClick={() => setStyle("gentle")}
          title="Gentle nudge"
          description="A short, non-intrusive prompt asking if you need help"
        />
        <ListRadio
          selected={style === "detailed"}
          onClick={() => setStyle("detailed")}
          title="Detailed recap"
          description="Summarises the last section automatically"
        />
        <ListRadio
          selected={style === "checkin"}
          onClick={() => setStyle("checkin")}
          title="Check-in question"
          description="Asks a comprehension question to gauge understanding"
        />
      </div>

      <p className="text-sm font-medium text-slate-800 mb-3">
        Interrupt frequency
      </p>
      <div className="space-y-2 mb-8">
        <ListRadio
          selected={frequency === "once"}
          onClick={() => setFrequency("once")}
          title="Once per section max"
          description="At most one intervention per reading section"
        />
        <ListRadio
          selected={frequency === "freely"}
          onClick={() => setFrequency("freely")}
          title="Freely"
          description="AI intervenes whenever it detects a focus signal"
        />
        <ListRadio
          selected={frequency === "manual"}
          onClick={() => setFrequency("manual")}
          title="Manual only"
          description="AI never interrupts — only responds when you ask"
        />
      </div>

      <SectionLabel>Knowledge & Memory</SectionLabel>

      <SettingRow
        label="Proactive suggestions"
        description="AI suggests related concepts and ideas beyond the document"
      >
        <Toggle enabled={proactive} onChange={setProactive} />
      </SettingRow>

      <SettingRow
        label="Save chat history"
        description="Persist conversations across sessions"
      >
        <Toggle enabled={saveHistory} onChange={setSaveHistory} />
      </SettingRow>

      <SettingRow
        label="Clear chat history"
        description="Delete all saved conversations"
      >
        <button
          type="button"
          className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Clear history
        </button>
      </SettingRow>
    </div>
  );
}

function AccountPanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900">Account</h2>
      <p className="text-sm text-slate-400 mt-1 mb-6">
        Manage your personal details and security.
      </p>

      <SectionLabel>Personal info</SectionLabel>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Full name
          </label>
          <input
            type="text"
            value={name}
            placeholder="Jane Doe"
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email address
          </label>
          <input
            type="email"
            value={email}
            placeholder="jane@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <button
          type="button"
          className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
        >
          Save changes
        </button>
      </div>

      <div className="border-t border-slate-100 pt-6 mb-6">
        <SectionLabel>Security</SectionLabel>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Change password
        </button>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <SectionLabel>Danger zone</SectionLabel>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Delete account
            </p>
            <p className="text-sm text-red-400 mt-0.5">
              Permanently delete your account and all associated data. This
              cannot be undone.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 ml-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main settings page                                                */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("reading");

  const panels: Record<Tab, React.ReactNode> = {
    reading: <ReadingDefaultsPanel />,
    accessibility: <AccessibilityPanel />,
    ai: <AIInterventionsPanel />,
    account: <AccountPanel />,
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
      <p className="text-sm text-slate-400 mt-1 mb-8">
        Manage your reading preferences and account
      </p>

      <div className="flex gap-8">
        {/* Sidebar navigation */}
        <nav className="w-56 shrink-0 space-y-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                activeTab === key
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {activeTab === key && (
                <span className="ml-auto text-indigo-400">&rsaquo;</span>
              )}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 min-h-[500px]">
          {panels[activeTab]}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Download,
  ExternalLink,
  FileJson,
  Image,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  Plus,
  RefreshCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { DEFAULT_CONTENT } from "../data/defaultContent";
import { downloadJson, hydrateContent } from "../lib/content";
import { cleanUrl, isConfigured, safeAsset, supabase } from "../lib/supabase";
import MfaGate from "./MfaGate";
import Turnstile from "./Turnstile";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "projects", label: "My work", icon: Video },
  { id: "services", label: "Services", icon: Sparkles },
  { id: "brands", label: "Brand partners", icon: CheckCircle2 },
  { id: "metrics", label: "Stats & extras", icon: LayoutDashboard },
  { id: "inbox", label: "Enquiries", icon: Inbox },
  { id: "settings", label: "Settings", icon: BookOpen },
];
const uid = () => crypto.randomUUID();
const newProject = () => ({
  id: uid(),
  title: "New project",
  category: "Food & beverage",
  format: "Instagram Reel",
  description: "",
  coverUrl: "",
  videoUrl: "",
  brand: "",
  result: "",
  seoDescription: "",
  publishedAt: "",
  featured: false,
  placeholder: false,
  palette: "peach",
});
const newService = () => ({
  id: uid(),
  number: "",
  icon: "Sparkles",
  title: "New service",
  description: "",
});
const newBrand = () => ({ id: uid(), name: "New brand", logoUrl: "" });
const newMetric = () => ({ id: uid(), value: "0", label: "New metric" });
const newAdvantage = () => ({
  id: uid(),
  title: "Your strength",
  detail: "Why brands should work with you",
});
const newTestimonial = () => ({ id: uid(), quote: "", author: "", role: "" });
const newPress = () => ({
  id: uid(),
  outlet: "",
  title: "",
  description: "",
  url: "",
});
const newFaq = () => ({ id: uid(), question: "", answer: "" });

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  multiline = false,
  hint = "",
  type = "text",
  maxLength = 3000,
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          maxLength={maxLength}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function StatusMessage({ status }) {
  return (
    status?.text && (
      <div className={`studio-notice ${status.type}`} role="status">
        {status.type === "success" ? (
          <CheckCircle2 size={18} />
        ) : (
          <CircleHelp size={18} />
        )}{" "}
        {status.text}
      </div>
    )
  );
}
function ActionHeading({ eyebrow, title, description, children }) {
  return (
    <div className="admin-heading">
      <div>
        <span className="admin-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="admin-heading-action">{children}</div>}
    </div>
  );
}
async function optimizeUpload(file) {
  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size < 400 * 1024 ||
    !("createImageBitmap" in window)
  )
    return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.84),
    );
    if (blob && blob.size < file.size)
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
        type: "image/webp",
      });
  } catch {
    /* Browser cannot optimize this image; upload original instead. */
  }
  return file;
}
function MediaUpload({
  label,
  accept = "image/*",
  onUploaded,
  onError,
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const change = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (disabled) return;
    const max = file.type.startsWith("video/")
      ? 35 * 1024 * 1024
      : 8 * 1024 * 1024;
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "video/mp4",
        "video/webm",
        "video/quicktime",
      ].includes(file.type)
    ) {
      onError(
        "Unsupported media format. Use JPG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV.",
      );
      return;
    }
    if (file.size > max) {
      onError(`File too large. Maximum ${Math.round(max / 1048576)} MB.`);
      return;
    }
    setBusy(true);
    try {
      const uploadFile = await optimizeUpload(file);
      if (!supabase) {
        if (file.size > 700 * 1024 || !file.type.startsWith("image/"))
          throw new Error(
            "Demo mode supports images smaller than 700 KB. Connect Supabase for permanent media storage and video uploads.",
          );
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        onUploaded(dataUrl);
      } else {
        const name = uploadFile.name
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, "-")
          .slice(-90);
        const path = `media/${Date.now()}-${uid()}-${name}`;
        const { error } = await supabase.storage
          .from("portfolio-media")
          .upload(path, uploadFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: uploadFile.type,
          });
        if (error) throw error;
        const { data } = supabase.storage
          .from("portfolio-media")
          .getPublicUrl(path);
        onUploaded(data.publicUrl);
      }
    } catch (err) {
      onError(err.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="upload-control">
      <input ref={ref} type="file" accept={accept} onChange={change} hidden />
      <button
        className="admin-btn light small"
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy || disabled}
      >
        <Upload size={15} />
        {busy ? "Uploading…" : label}
      </button>
    </div>
  );
}
function PasswordRecovery({ onDone }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const update = async (event) => {
    event.preventDefault();
    if (password.length < 12) {
      setMessage("Use at least 12 characters.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else onDone();
  };
  return (
    <div className="studio-login">
      <div className="login-card">
        <div className="login-logo">K.</div>
        <h1>
          Choose a new <em>password.</em>
        </h1>
        <p>Secure your private creator dashboard with a new password.</p>
        <form onSubmit={update}>
          <Field
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
          />
          <button
            className="admin-btn primary full"
            disabled={busy}
            type="submit"
          >
            {busy ? "Updating…" : "Update my password"} <ArrowRight size={16} />
          </button>
        </form>
        {message && <p className="form-message error">{message}</p>}
      </div>
    </div>
  );
}

function Login({ onBack, route, navigate }) {
  const [mode, setMode] = useState(() => route === "/studio/signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  useEffect(() => {
    setMode(route === "/studio/signup" ? "signup" : "login");
    setCaptchaToken("");
    setCaptchaReset(n => n + 1);
    setStatus({ type: "", text: "" });
  }, [route]);
  const submit = async (e) => {
    e.preventDefault();
    if (!siteKey || !captchaToken) {
      setStatus({
        type: "error",
        text: "Complete the security check to continue.",
      });
      return;
    }
    setBusy(true);
    setStatus({ type: "", text: "" });
    try {
      if (mode === "signup") {
        if (password.length < 12)
          throw new Error("Use a strong password of at least 12 characters.");
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/studio`,
            captchaToken,
          },
        });
        if (error) throw error;
        setStatus({
          type: "success",
          text: "If registration is permitted, check your inbox and verify your email. Only preapproved addresses can enter Studio.",
        });
        setPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: { captchaToken },
        });
        if (error) throw error;
      }
    } catch (error) {
      setStatus({
        type: "error",
        text: error.message || "Authentication failed.",
      });
    } finally {
      setBusy(false);
      setCaptchaToken("");
      setCaptchaReset((n) => n + 1);
    }
  };
  const reset = async () => {
    if (!email || !captchaToken) {
      setStatus({
        type: "error",
        text: "Enter your email and complete verification first.",
      });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/studio`,
      captchaToken,
    });
    setBusy(false);
    setCaptchaToken("");
    setCaptchaReset((n) => n + 1);
    setStatus({
      type: error ? "error" : "success",
      text:
        error?.message ||
        "If that email is registered, a password reset link will be sent.",
    });
  };
  return (
    <div className="studio-login">
      <button className="login-back" onClick={onBack}>
        <ArrowLeft size={17} /> Back to portfolio
      </button>
      <div className="login-card">
        <div className="login-logo">K.</div>
        <span className="admin-eyebrow">APPROVED EDITORS ONLY</span>
        <h1>
          {mode === "signup" ? (
            <>
              Create your <em>Studio account.</em>
            </>
          ) : (
            <>
              Welcome back,
              <br />
              <em>creative mind.</em>
            </>
          )}
        </h1>
        <p>
          {mode === "signup"
            ? "Signup is for preapproved editors only. The owner must allowlist your email first; email verification and an authenticator app are required."
            : "Sign in to manage your portfolio and private brand enquiries."}
        </p>
        <form onSubmit={submit}>
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={
              mode === "signup" ? "At least 12 characters" : "Your password"
            }
          />
          <Turnstile
            siteKey={siteKey}
            onToken={setCaptchaToken}
            resetSignal={captchaReset}
          />
          <button
            className="admin-btn primary full"
            type="submit"
            disabled={busy || !captchaToken}
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create approved account"
                : "Sign in to Studio"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="login-actions">
          <button
            className="reset-link"
            type="button"
            onClick={() => navigate(mode === "login" ? "/studio/signup" : "/studio")}
          >
            {mode === "login"
              ? "Have an invitation? Sign up"
              : "Already have an account? Sign in"}
          </button>
          {mode === "login" && (
            <button className="reset-link" type="button" onClick={reset} disabled={busy}>
              Forgot password?
            </button>
          )}
        </div>
        <StatusMessage status={status} />
        <div className="login-foot">
          <Lock size={14} /> Login + verified email + approved role + TOTP MFA.
        </div>
      </div>
    </div>
  );
}

export default function Studio({
  content,
  saveContent,
  navigate,
  session,
  refresh,
  loadError,
  recovery,
  route,
  setRecovery,
}) {
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState(() => hydrateContent(content));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [checking, setChecking] = useState(isConfigured);
  const [inquiries, setInquiries] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [revisionsBusy, setRevisionsBusy] = useState(false);
  const [inboxBusy, setInboxBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setDraft(hydrateContent(content));
    setDirty(false);
  }, [content]);
  useEffect(() => {
    if (!supabase || !session?.user) {
      setAuthorized(false);
      setMfaVerified(false);
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    (async () => {
      // A verified email with a valid invitation can claim editor privileges.
      await supabase.rpc("claim_portfolio_editor");
      const [{ data, error }, { data: aal, error: aalError }] =
        await Promise.all([
          supabase
            .from("portfolio_editors")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
      if (active) {
        setAuthorized(Boolean(data) && !error);
        setMfaVerified(!aalError && aal?.currentLevel === "aal2");
        setChecking(false);
      }
    })().catch(() => {
      if (active) {
        setAuthorized(false);
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const edit = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };
  const profileEdit = (key, value) => {
    setDraft((d) => ({ ...d, profile: { ...d.profile, [key]: value } }));
    setDirty(true);
  };
  const contactEdit = (key, value) => {
    setDraft((d) => ({ ...d, contact: { ...d.contact, [key]: value } }));
    setDirty(true);
  };
  const editRow = (section, id, key, value) => {
    setDraft((d) => ({
      ...d,
      [section]: d[section].map((x) =>
        x.id === id ? { ...x, [key]: value } : x,
      ),
    }));
    setDirty(true);
  };
  const addRow = (section, row) => {
    setDraft((d) => ({ ...d, [section]: [...d[section], row] }));
    setDirty(true);
  };
  const removeRow = (section, id) => {
    if (
      !confirm(
        "Delete this item from your portfolio? Remember to save your changes.",
      )
    )
      return;
    setDraft((d) => ({
      ...d,
      [section]: d[section].filter((x) => x.id !== id),
    }));
    setDirty(true);
  };
  const moveRow = (section, index, direction) => {
    const next = [...draft[section]];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    edit(section, next);
  };
  const notifyError = (msg) => setStatus({ type: "error", text: msg });
  const persist = async () => {
    if (!dirty) return;
    setSaving(true);
    setStatus({ type: "", text: "" });
    try {
      await saveContent(draft);
      setDirty(false);
      setStatus({
        type: "success",
        text: supabase
          ? "Published! Your changes are now saved to your live portfolio."
          : "Saved in this browser (demo only). Connect Supabase to publish for everyone.",
      });
    } catch (err) {
      notifyError(err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };
  const switchTab = (next) => {
    setTab(next);
    setSidebarOpen(false);
    setStatus({ type: "", text: "" });
    window.scrollTo({ top: 0, behavior: "instant" });
    if (next === "inbox") loadInbox();
  };
  const loadInbox = async () => {
    if (!supabase) return;
    setInboxBusy(true);
    const { data, error } = await supabase
      .from("portfolio_inquiries")
      .select("id,name,email,company,service,message,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) notifyError(error.message);
    else setInquiries(data || []);
    setInboxBusy(false);
  };
  const loadRevisions = async () => {
    setRevisionsBusy(true);
    const { data, error } = await supabase
      .from("portfolio_content_revisions")
      .select("id,data,version,created_at")
      .order("id", { ascending: false })
      .limit(20);
    if (error) notifyError(error.message);
    else setRevisions(data || []);
    setRevisionsBusy(false);
  };
  const restoreRevision = (item) => {
    if (
      !confirm(
        `Restore revision ${item.version} into your draft? Click Save to publish.`,
      )
    )
      return;
    setDraft(hydrateContent(item.data));
    setDirty(true);
    setStatus({
      type: "success",
      text: "Revision loaded as an unsaved draft. Review and click Save changes to publish.",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const markInquiry = async (id, next) => {
    const { error } = await supabase
      .from("portfolio_inquiries")
      .update({ status: next })
      .eq("id", id);
    if (error) notifyError(error.message);
    else
      setInquiries((old) =>
        old.map((x) => (x.id === id ? { ...x, status: next } : x)),
      );
  };
  const importContent = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.profile ||
        typeof parsed.profile.name !== "string"
      )
        throw new Error("Not a valid portfolio backup.");
      setDraft(hydrateContent(parsed));
      setDirty(true);
      setStatus({
        type: "success",
        text: "Backup imported into the editor. Click Save changes to publish.",
      });
    } catch (e) {
      notifyError(e.message);
    }
  };
  const doLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate("/");
  };

  if (supabase && recovery && session)
    return <PasswordRecovery onDone={() => setRecovery(false)} />;
  if (!supabase)
    return (
      <div className="studio-login">
        <div className="login-card">
          <ShieldAlert size={32} />
          <h1>Studio is locked.</h1>
          <p>
            For security, the dashboard is disabled until Supabase is
            configured. Follow START_HERE_PRODUCTION.md to enable approved
            signup, login and MFA.
          </p>
          <button className="admin-btn primary" onClick={() => navigate("/")}>
            Back to portfolio
          </button>
        </div>
      </div>
    );
  if (supabase && !session) return <Login onBack={() => navigate("/")} route={route} navigate={navigate} />;
  if (checking)
    return (
      <div className="app-loading">
        <div className="loading-mark">K.</div>
        <span>Checking Studio access…</span>
      </div>
    );
  if (!authorized)
    return (
      <div className="studio-login">
        <button className="login-back" onClick={() => navigate("/")}>
          <ArrowLeft size={17} /> Back to portfolio
        </button>
        <div className="login-card">
          <ShieldAlert size={35} />
          <h1>Private space.</h1>
          <p>
            This account is not approved. Ask the owner to add your verified
            email to the invitation allowlist, then sign in again.
          </p>
          <button className="admin-btn primary" onClick={doLogout}>
            Sign out
          </button>
        </div>
      </div>
    );

  if (!mfaVerified)
    return (
      <MfaGate onComplete={() => setMfaVerified(true)} onSignOut={doLogout} />
    );

  const seoChecks = [
    {
      label: "Unique SEO page title",
      ok: Boolean(draft.profile.seoTitle?.trim()),
    },
    {
      label: "Search description (70–170 characters)",
      ok:
        (draft.profile.seoDescription || "").trim().length >= 70 &&
        (draft.profile.seoDescription || "").trim().length <= 170,
    },
    { label: "Real creator portrait", ok: Boolean(draft.profile.portraitUrl) },
    { label: "Social sharing image", ok: Boolean(draft.profile.ogImageUrl) },
    {
      label: "At least three approved case studies",
      ok:
        draft.projects.filter((p) => !p.placeholder && p.title && p.description)
          .length >= 3,
    },
    {
      label: "Real case-study cover images",
      ok: draft.projects
        .filter((p) => !p.placeholder)
        .every((p) => Boolean(p.coverUrl)),
    },
    {
      label: "Three useful FAQ answers",
      ok: (draft.faqs || []).filter((f) => f.question && f.answer).length >= 3,
    },
    { label: "Professional contact email", ok: Boolean(draft.profile.email) },
    { label: "Demo preview cards hidden", ok: !draft.showPlaceholderWork },
  ];
  return (
    <div className="studio-shell">
      <aside className={`studio-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-monogram">K.</span>
          <div>
            <strong>Kawalpreet Studio</strong>
            <small>CREATOR CONTROL ROOM</small>
          </div>
          <button className="side-close" onClick={() => setSidebarOpen(false)}>
            <X size={19} />
          </button>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`side-nav-item ${id === tab ? "active" : ""}`}
              onClick={() => switchTab(id)}
            >
              <Icon size={18} />
              {label}
              {id === "inbox" &&
                inquiries.filter((q) => q.status === "new").length > 0 && (
                  <span className="inbox-count">
                    {inquiries.filter((q) => q.status === "new").length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-status">
            <span className="availability-dot" />
            <div>
              <strong>
                {supabase ? "Connected to Supabase" : "Preview mode"}
              </strong>
              <span>
                {supabase
                  ? "Secure cloud workspace"
                  : "Browser-only draft storage"}
              </span>
            </div>
          </div>
          <button onClick={() => navigate("/")}>
            <ExternalLink size={16} /> View website
          </button>
          {supabase && (
            <button onClick={doLogout}>
              <LogOut size={16} /> Sign out
            </button>
          )}
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}
      <div className="studio-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumbs">CREATOR STUDIO</span>
            <span className="slash">/</span>
            <strong>{TABS.find((t) => t.id === tab)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className={`draft-status ${dirty ? "unsaved" : ""}`}>
              <span />
              {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <button
              className="admin-btn primary"
              disabled={!dirty || saving}
              onClick={persist}
            >
              <Save size={16} />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </header>
        <div className="admin-content">
          {!supabase && (
            <div className="demo-banner">
              <CircleHelp size={18} />
              <span>
                <strong>Demo mode:</strong> edits are saved only in this browser
                and are not shared publicly. Connect a Supabase project to
                enable secure login, cloud publishing, uploads and enquiries.
              </span>
            </div>
          )}
          {loadError && (
            <div className="demo-banner warning">
              Database notice: {loadError}. Check that you ran{" "}
              <code>sql/setup.sql</code>.
            </div>
          )}
          <StatusMessage status={status} />
          {tab === "overview" && (
            <>
              <ActionHeading
                eyebrow="THE CREATIVE DESK"
                title={
                  <>
                    Your space, <em>your story.</em>
                  </>
                }
                description="Everything you need to keep your portfolio looking sharp and ready for your next big collaboration."
              />
              <div className="overview-banner">
                <div>
                  <span className="admin-eyebrow">
                    A NOTE TO YOUR FUTURE SELF
                  </span>
                  <h2>
                    You're doing amazing.
                    <br />
                    <em>Keep creating.</em>
                  </h2>
                  <p>
                    Every good portfolio starts with work worth showing. Let’s
                    make yours unforgettable.
                  </p>
                  <button
                    className="admin-btn light"
                    onClick={() => switchTab("projects")}
                  >
                    Manage your work <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="overview-art">
                  K<span>✳</span>
                </div>
              </div>
              <div className="overview-stats">
                <div>
                  <span>WORK ITEMS</span>
                  <strong>{draft.projects?.length || 0}</strong>
                  <small>
                    {draft.projects?.filter((x) => x.placeholder).length || 0}{" "}
                    preview slots
                  </small>
                </div>
                <div>
                  <span>BRAND PARTNERS</span>
                  <strong>{draft.brands?.length || 0}</strong>
                  <small>Trusted collaborations</small>
                </div>
                <div>
                  <span>SERVICES</span>
                  <strong>{draft.services?.length || 0}</strong>
                  <small>Ways to work together</small>
                </div>
                <div>
                  <span>INBOX</span>
                  <strong>{inquiries.length || "—"}</strong>
                  <small>Load in Enquiries tab</small>
                </div>
              </div>
              <div className="admin-panel">
                <h3>Your launch checklist</h3>
                <div className="checklist">
                  <div>
                    <CheckCircle2 size={19} /> Profile copy & career stats added
                    from PDF
                  </div>
                  <div className={draft.profile.portraitUrl ? "done" : ""}>
                    <CheckCircle2 size={19} /> Upload a real hero portrait
                  </div>
                  <div
                    className={
                      draft.projects.some((x) => !x.placeholder) ? "done" : ""
                    }
                  >
                    <CheckCircle2 size={19} /> Replace portfolio preview slots
                    with 6–12 real videos
                  </div>
                  <div className={draft.profile.email ? "done" : ""}>
                    <CheckCircle2 size={19} /> Add your professional contact
                    email
                  </div>
                  <div className={supabase ? "done" : ""}>
                    <CheckCircle2 size={19} /> Connect Supabase and configure
                    the website
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "profile" && (
            <>
              <ActionHeading
                eyebrow="THE PERSON BEHIND THE CAMERA"
                title={
                  <>
                    Make it <em>you.</em>
                  </>
                }
                description="Update your story, portraits, social links and collaboration contact information."
              />
              <div className="admin-panel">
                <h3>Basic details</h3>
                <div className="admin-form-grid">
                  {[
                    ["name", "Full name"],
                    ["shortName", "First name / hero name"],
                    ["eyebrow", "Creator title"],
                    ["location", "Location"],
                    ["availability", "Availability text"],
                    ["email", "Business email"],
                    ["whatsapp", "WhatsApp (optional)"],
                  ].map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      value={draft.profile[key]}
                      onChange={(v) => profileEdit(key, v)}
                    />
                  ))}
                </div>
                <Field
                  label="Hero tagline"
                  value={draft.profile.tagline}
                  onChange={(v) => profileEdit("tagline", v)}
                />
                <Field
                  label="Hero introduction"
                  multiline
                  value={draft.profile.intro}
                  onChange={(v) => profileEdit("intro", v)}
                />
                <Field
                  label="About me / personal story"
                  multiline
                  value={draft.profile.bio}
                  onChange={(v) => profileEdit("bio", v)}
                />
              </div>
              <div className="admin-panel">
                <h3>Photography & visuals</h3>
                <p className="panel-help">
                  Use your own photography or images you have permission to
                  publish. Portraits and hero images can be different.
                </p>
                <div className="image-edit-grid">
                  {[
                    ["portraitUrl", "Portrait / about photo"],
                    ["heroImageUrl", "Hero cover photo"],
                  ].map(([key, label]) => (
                    <div className="media-box" key={key}>
                      <div className="media-thumb">
                        {safeAsset(draft.profile[key]) ||
                        draft.profile[key]?.startsWith("data:image/") ? (
                          <img src={draft.profile[key]} alt="Current preview" />
                        ) : (
                          <Image size={28} />
                        )}
                      </div>
                      <Field
                        label={label + " URL"}
                        value={draft.profile[key]}
                        onChange={(v) => profileEdit(key, v)}
                        placeholder="https://..."
                      />
                      <MediaUpload
                        label="Upload photo"
                        onUploaded={(url) => profileEdit(key, url)}
                        onError={notifyError}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="admin-panel">
                <h3>Socials & external links</h3>
                <div className="admin-form-grid">
                  {[
                    ["instagram", "Instagram URL"],
                    ["youtube", "YouTube channel URL"],
                    ["snapchat", "Snapchat URL"],
                    ["linkedin", "LinkedIn URL"],
                    ["mediaKitUrl", "External media kit URL"],
                  ].map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      value={draft.profile[key]}
                      onChange={(v) => profileEdit(key, v)}
                      placeholder="https://..."
                    />
                  ))}
                </div>
              </div>
              <div className="admin-panel">
                <h3>Contact section</h3>
                <Field
                  label="Headline"
                  value={draft.contact.heading}
                  onChange={(v) => contactEdit("heading", v)}
                />
                <Field
                  label="Supporting text"
                  multiline
                  value={draft.contact.subheading}
                  onChange={(v) => contactEdit("subheading", v)}
                />
                <Field
                  label="Send button text"
                  value={draft.contact.buttonText}
                  onChange={(v) => contactEdit("buttonText", v)}
                />
              </div>
            </>
          )}

          {tab === "projects" && (
            <>
              <ActionHeading
                eyebrow="THE CREATIVE ARCHIVE"
                title={
                  <>
                    Your work, <em>front & center.</em>
                  </>
                }
                description="Add videos, reels and project examples, rearrange them, and group them by category."
              >
                <button
                  className="admin-btn primary"
                  onClick={() => addRow("projects", newProject())}
                >
                  <Plus size={16} /> Add project
                </button>
              </ActionHeading>
              <div className="admin-tip">
                <CircleHelp size={18} /> Placeholder cards are marked as
                previews on the live site. Publish actual work by switching off
                “Preview slot” and adding approved content.
              </div>
              {draft.projects.map((p, index) => (
                <div key={p.id} className="admin-panel row-editor">
                  <div className="row-editor-head">
                    <div className="row-preview palette-mini">
                      {safeAsset(p.coverUrl) ||
                      p.coverUrl?.startsWith("data:image/") ? (
                        <img src={p.coverUrl} alt="" />
                      ) : (
                        <Video size={20} />
                      )}
                    </div>
                    <div className="row-title">
                      <small>
                        PROJECT {String(index + 1).padStart(2, "0")}
                      </small>
                      <h3>{p.title || "Untitled project"}</h3>
                    </div>
                    <div className="row-actions">
                      <button
                        title="Move up"
                        disabled={!index}
                        onClick={() => moveRow("projects", index, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        title="Move down"
                        disabled={index === draft.projects.length - 1}
                        onClick={() => moveRow("projects", index, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        title="Delete"
                        className="delete"
                        onClick={() => removeRow("projects", p.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="admin-form-grid">
                    <Field
                      label="Project title"
                      value={p.title}
                      onChange={(v) => editRow("projects", p.id, "title", v)}
                    />
                    <Field
                      label="Category"
                      value={p.category}
                      onChange={(v) => editRow("projects", p.id, "category", v)}
                      hint="For example: Food & beverage, Lifestyle, Travel, Tech"
                    />
                    <Field
                      label="Format / deliverable"
                      value={p.format}
                      onChange={(v) => editRow("projects", p.id, "format", v)}
                    />
                    <Field
                      label="Brand name (optional)"
                      value={p.brand}
                      onChange={(v) => editRow("projects", p.id, "brand", v)}
                    />
                  </div>
                  <Field
                    label="Project story / brief"
                    multiline
                    value={p.description}
                    onChange={(v) =>
                      editRow("projects", p.id, "description", v)
                    }
                  />
                  <div className="admin-form-grid">
                    <Field
                      label="SEO case-study summary (optional)"
                      value={p.seoDescription}
                      onChange={(v) =>
                        editRow("projects", p.id, "seoDescription", v)
                      }
                      hint="Factual summary for this project page."
                    />
                    <Field
                      label="Video publication date (optional)"
                      type="date"
                      value={p.publishedAt}
                      onChange={(v) =>
                        editRow("projects", p.id, "publishedAt", v)
                      }
                      hint="Use the actual published date for VideoObject structured data."
                    />
                  </div>
                  <Field
                    label="Approved result / KPI (optional)"
                    value={p.result}
                    onChange={(v) => editRow("projects", p.id, "result", v)}
                    hint="Use verified results only, with permission to share."
                  />
                  <div className="admin-form-grid">
                    <div>
                      <Field
                        label="Cover image URL"
                        value={p.coverUrl}
                        onChange={(v) =>
                          editRow("projects", p.id, "coverUrl", v)
                        }
                      />
                      <MediaUpload
                        label="Upload cover"
                        onUploaded={(url) =>
                          editRow("projects", p.id, "coverUrl", url)
                        }
                        onError={notifyError}
                        accept="image/*"
                      />
                    </div>
                    <div>
                      <Field
                        label="Video URL / YouTube Shorts / Instagram Reel"
                        value={p.videoUrl}
                        onChange={(v) =>
                          editRow("projects", p.id, "videoUrl", v)
                        }
                        hint="YouTube embeds; Instagram links open externally; MP4 files play inside the site."
                      />
                      <MediaUpload
                        label="Upload MP4/video"
                        onUploaded={(url) =>
                          editRow("projects", p.id, "videoUrl", url)
                        }
                        onError={notifyError}
                        accept="video/*"
                      />
                    </div>
                  </div>
                  <div className="row-toggle">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(p.placeholder)}
                        onChange={(e) =>
                          editRow(
                            "projects",
                            p.id,
                            "placeholder",
                            e.target.checked,
                          )
                        }
                      />{" "}
                      Preview slot (not real work)
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(p.featured)}
                        onChange={(e) =>
                          editRow(
                            "projects",
                            p.id,
                            "featured",
                            e.target.checked,
                          )
                        }
                      />{" "}
                      Featured work
                    </label>
                    <label>
                      Card mood{" "}
                      <select
                        value={p.palette || "peach"}
                        onChange={(e) =>
                          editRow("projects", p.id, "palette", e.target.value)
                        }
                      >
                        {[
                          "peach",
                          "lilac",
                          "sage",
                          "rose",
                          "blue",
                          "amber",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ))}
              {!draft.projects.length && (
                <div className="empty-admin">
                  No projects yet. Add your first project to get started.
                </div>
              )}
              <button
                className="admin-btn light"
                onClick={() => addRow("projects", newProject())}
              >
                <Plus size={16} /> Add another project
              </button>
            </>
          )}

          {tab === "services" && (
            <>
              <ActionHeading
                eyebrow="YOUR CREATIVE OFFERINGS"
                title={
                  <>
                    What you <em>bring to the table.</em>
                  </>
                }
                description="Manage the services brands can book. Adjust the descriptions to match what you actually offer."
              >
                <button
                  className="admin-btn primary"
                  onClick={() => addRow("services", newService())}
                >
                  <Plus size={16} /> Add service
                </button>
              </ActionHeading>
              {draft.services.map((s, index) => (
                <div className="admin-panel row-editor" key={s.id}>
                  <div className="row-editor-head">
                    <div className="row-title">
                      <small>SERVICE {index + 1}</small>
                      <h3>{s.title}</h3>
                    </div>
                    <div className="row-actions">
                      <button
                        disabled={!index}
                        onClick={() => moveRow("services", index, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        disabled={index === draft.services.length - 1}
                        onClick={() => moveRow("services", index, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        className="delete"
                        onClick={() => removeRow("services", s.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="admin-form-grid">
                    <Field
                      label="Title"
                      value={s.title}
                      onChange={(v) => editRow("services", s.id, "title", v)}
                    />
                    <label className="studio-field">
                      <span>Icon</span>
                      <select
                        value={s.icon || "Sparkles"}
                        onChange={(e) =>
                          editRow("services", s.id, "icon", e.target.value)
                        }
                      >
                        {[
                          "Video",
                          "Clapperboard",
                          "Utensils",
                          "Plane",
                          "Sparkles",
                          "Smartphone",
                        ].map((icon) => (
                          <option key={icon}>{icon}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Field
                    label="Description"
                    multiline
                    value={s.description}
                    onChange={(v) =>
                      editRow("services", s.id, "description", v)
                    }
                  />
                </div>
              ))}
            </>
          )}

          {tab === "brands" && (
            <>
              <ActionHeading
                eyebrow="BRAND LOVE"
                title={
                  <>
                    In very good <em>company.</em>
                  </>
                }
                description="Brands shown here are based on the supplied media kit. Keep only collaborations you can publicly confirm."
              >
                <button
                  className="admin-btn primary"
                  onClick={() => addRow("brands", newBrand())}
                >
                  <Plus size={16} /> Add brand
                </button>
              </ActionHeading>
              <div className="brand-edit-list">
                {draft.brands.map((b, index) => (
                  <div className="admin-panel compact-panel" key={b.id}>
                    <div className="row-editor-head">
                      <div className="row-title">
                        <small>BRAND {index + 1}</small>
                        <h3>{b.name}</h3>
                      </div>
                      <div className="row-actions">
                        <button
                          disabled={!index}
                          onClick={() => moveRow("brands", index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          disabled={index === draft.brands.length - 1}
                          onClick={() => moveRow("brands", index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="delete"
                          onClick={() => removeRow("brands", b.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <Field
                      label="Brand name"
                      value={b.name}
                      onChange={(v) => editRow("brands", b.id, "name", v)}
                    />
                    <Field
                      label="Logo image URL (optional)"
                      value={b.logoUrl}
                      onChange={(v) => editRow("brands", b.id, "logoUrl", v)}
                    />
                    <MediaUpload
                      label="Upload logo"
                      onUploaded={(url) =>
                        editRow("brands", b.id, "logoUrl", url)
                      }
                      onError={notifyError}
                      accept="image/*"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "metrics" && (
            <>
              <ActionHeading
                eyebrow="THE DETAILS THAT MATTER"
                title={
                  <>
                    Numbers & <em>nice things.</em>
                  </>
                }
                description="Keep stats, reasons to work with you, and genuine client testimonials up to date."
              />
              <div className="admin-panel">
                <div className="panel-heading-inline">
                  <h3>Audience & career metrics</h3>
                  <button
                    className="admin-btn light small"
                    onClick={() => addRow("metrics", newMetric())}
                  >
                    <Plus size={15} /> Add metric
                  </button>
                </div>
                <div className="metric-edit-list">
                  {draft.metrics.map((m, index) => (
                    <div key={m.id} className="metric-edit-row">
                      <Field
                        label="Value"
                        value={m.value}
                        onChange={(v) => editRow("metrics", m.id, "value", v)}
                      />
                      <Field
                        label="Label"
                        value={m.label}
                        onChange={(v) => editRow("metrics", m.id, "label", v)}
                      />
                      <button
                        className="delete-button"
                        onClick={() => removeRow("metrics", m.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="panel-help">
                  Stats aren't automatically fetched from social networks.
                  Update them manually when they change.
                </p>
              </div>
              <div className="admin-panel">
                <div className="panel-heading-inline">
                  <h3>Why work with me</h3>
                  <button
                    className="admin-btn light small"
                    onClick={() => addRow("advantages", newAdvantage())}
                  >
                    <Plus size={15} /> Add point
                  </button>
                </div>
                {draft.advantages.map((a) => (
                  <div className="extra-edit-row" key={a.id}>
                    <button
                      className="extra-remove"
                      onClick={() => removeRow("advantages", a.id)}
                    >
                      <X size={16} />
                    </button>
                    <Field
                      label="Headline"
                      value={a.title}
                      onChange={(v) => editRow("advantages", a.id, "title", v)}
                    />
                    <Field
                      label="Explanation"
                      value={a.detail}
                      onChange={(v) => editRow("advantages", a.id, "detail", v)}
                    />
                  </div>
                ))}
              </div>
              <div className="admin-panel">
                <div className="panel-heading-inline">
                  <h3>Client testimonials</h3>
                  <button
                    className="admin-btn light small"
                    onClick={() => addRow("testimonials", newTestimonial())}
                  >
                    <Plus size={15} /> Add testimonial
                  </button>
                </div>
                <p className="panel-help">
                  Only include a quote if the client gave permission to publish
                  it. No testimonials are invented in this template.
                </p>
                {draft.testimonials.map((t) => (
                  <div className="extra-edit-row" key={t.id}>
                    <button
                      className="extra-remove"
                      onClick={() => removeRow("testimonials", t.id)}
                    >
                      <X size={16} />
                    </button>
                    <Field
                      label="Quote"
                      multiline
                      value={t.quote}
                      onChange={(v) =>
                        editRow("testimonials", t.id, "quote", v)
                      }
                    />
                    <div className="admin-form-grid">
                      <Field
                        label="Person / client name"
                        value={t.author}
                        onChange={(v) =>
                          editRow("testimonials", t.id, "author", v)
                        }
                      />
                      <Field
                        label="Role / brand"
                        value={t.role}
                        onChange={(v) =>
                          editRow("testimonials", t.id, "role", v)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="admin-panel">
                <div className="panel-heading-inline">
                  <h3>Press features</h3>
                  <button
                    className="admin-btn light small"
                    onClick={() => addRow("press", newPress())}
                  >
                    <Plus size={15} /> Add press
                  </button>
                </div>
                <p className="panel-help">
                  The included ThePrint mention was found in public reporting.
                  You can change or remove it.
                </p>
                {(draft.press || []).map((t) => (
                  <div className="extra-edit-row" key={t.id}>
                    <button
                      className="extra-remove"
                      onClick={() => removeRow("press", t.id)}
                    >
                      <X size={16} />
                    </button>
                    <div className="admin-form-grid">
                      <Field
                        label="Publication / outlet"
                        value={t.outlet}
                        onChange={(v) => editRow("press", t.id, "outlet", v)}
                      />
                      <Field
                        label="Feature title"
                        value={t.title}
                        onChange={(v) => editRow("press", t.id, "title", v)}
                      />
                    </div>
                    <Field
                      label="Description"
                      value={t.description}
                      onChange={(v) => editRow("press", t.id, "description", v)}
                    />
                    <Field
                      label="Article URL"
                      value={t.url}
                      onChange={(v) => editRow("press", t.id, "url", v)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "inbox" && (
            <>
              <ActionHeading
                eyebrow="PEOPLE WANT TO WORK WITH YOU"
                title={
                  <>
                    Your <em>brand enquiries.</em>
                  </>
                }
                description="Messages sent through the website live here. Reply via email to keep conversations personal."
              >
                <button className="admin-btn light" onClick={loadInbox}>
                  <RefreshCcw size={16} /> Refresh inbox
                </button>
              </ActionHeading>
              {!supabase ? (
                <div className="admin-panel">
                  <h3>Connect your database first</h3>
                  <p>
                    Inbox messages require Supabase. Once connected, enquiries
                    from the website will appear here.
                  </p>
                </div>
              ) : inboxBusy ? (
                <div className="empty-admin">Loading your enquiries…</div>
              ) : !inquiries.length ? (
                <div className="empty-admin">
                  <Mail size={29} />
                  <h3>Inbox zero, for now.</h3>
                  <p>
                    When someone fills out your contact form, their message will
                    land right here.
                  </p>
                </div>
              ) : (
                <div className="inbox-list">
                  {inquiries.map((msg) => (
                    <article
                      className={`admin-panel inquiry-card ${msg.status === "new" ? "unread" : ""}`}
                      key={msg.id}
                    >
                      <div className="inquiry-head">
                        <div>
                          <span className="inquiry-pill">
                            {msg.status === "new"
                              ? "NEW ENQUIRY"
                              : msg.status.toUpperCase()}
                          </span>
                          <h3>{msg.name}</h3>
                          <p>
                            {msg.company || "Independent enquiry"} ·{" "}
                            {msg.service}
                          </p>
                        </div>
                        <time>{new Date(msg.created_at).toLocaleString()}</time>
                      </div>
                      <p className="inquiry-message">{msg.message}</p>
                      <div className="inquiry-bottom">
                        <a
                          href={`mailto:${encodeURIComponent(msg.email)}?subject=${encodeURIComponent("Re: Your collaboration enquiry")}`}
                          className="admin-btn light small"
                        >
                          <Mail size={15} /> Reply to {msg.email}
                        </a>
                        <button
                          className="admin-btn light small"
                          onClick={() =>
                            markInquiry(
                              msg.id,
                              msg.status === "new" ? "read" : "new",
                            )
                          }
                        >
                          {msg.status === "new" ? "Mark read" : "Mark unread"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "settings" && (
            <>
              <ActionHeading
                eyebrow="THE ENGINE ROOM"
                title={
                  <>
                    Little details, <em>big impact.</em>
                  </>
                }
                description="SEO, content visibility, backups and publishing preferences."
              />
              <div className="admin-panel">
                <h3>
                  Content readiness — {seoChecks.filter((x) => x.ok).length}/
                  {seoChecks.length}
                </h3>
                <p className="panel-help">
                  A practical publishing checklist, not a Google ranking or AI
                  visibility score. Domain verification and live testing are
                  separate.
                </p>
                <div className="seo-health-grid">
                  {seoChecks.map((item) => (
                    <div
                      key={item.label}
                      className={item.ok ? "ready" : "pending"}
                    >
                      <CheckCircle2 size={16} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="admin-panel">
                <h3>SEO, GEO & AEO content</h3>
                <Field
                  label="SEO page title"
                  value={draft.profile.seoTitle}
                  onChange={(v) => profileEdit("seoTitle", v)}
                  hint="A natural, accurate title describing her work."
                />
                <Field
                  label="Search result description"
                  multiline
                  value={draft.profile.seoDescription}
                  onChange={(v) => profileEdit("seoDescription", v)}
                  hint="Concise, unique and factual. Search engines may choose their own snippet."
                />
                <Field
                  label="Social sharing image URL (optional)"
                  value={draft.profile.ogImageUrl}
                  onChange={(v) => profileEdit("ogImageUrl", v)}
                  hint="Use an approved 1200×630 public image. Otherwise the portrait is used."
                />
                <MediaUpload
                  label="Upload social sharing image"
                  onUploaded={(url) => profileEdit("ogImageUrl", url)}
                  onError={notifyError}
                  accept="image/*"
                />
                <p className="panel-help">
                  The published title, description, creator details and verified
                  work are rendered into server HTML and structured data.
                  AEO/GEO does not guarantee search ranking or AI citations.
                </p>
              </div>
              <div className="admin-panel">
                <div className="panel-heading-inline">
                  <h3>Questions brands ask (FAQ)</h3>
                  <button
                    className="admin-btn light small"
                    onClick={() => addRow("faqs", newFaq())}
                  >
                    <Plus size={15} /> Add question
                  </button>
                </div>
                <p className="panel-help">
                  Write answers based on her real services and policies. These
                  appear publicly and are crawlable by search engines.
                </p>
                {(draft.faqs || []).map((f) => (
                  <div className="extra-edit-row" key={f.id}>
                    <button
                      className="extra-remove"
                      onClick={() => removeRow("faqs", f.id)}
                    >
                      <X size={16} />
                    </button>
                    <Field
                      label="Question"
                      value={f.question}
                      onChange={(v) => editRow("faqs", f.id, "question", v)}
                    />
                    <Field
                      label="Answer"
                      multiline
                      value={f.answer}
                      onChange={(v) => editRow("faqs", f.id, "answer", v)}
                    />
                  </div>
                ))}
              </div>
              <div className="admin-panel">
                <h3>Portfolio visibility</h3>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.showPlaceholderWork)}
                    onChange={(e) =>
                      edit("showPlaceholderWork", e.target.checked)
                    }
                  />{" "}
                  Show preview slots in public gallery
                </label>
                <p className="panel-help">
                  Turn this OFF once you have real work uploaded. Preview slots
                  are design examples, not endorsements or completed projects.
                </p>
              </div>
              <div className="admin-panel">
                <h3>Backup and restore</h3>
                <p className="panel-help">
                  Download everything you have typed into the Studio, including
                  media URLs. Image and video files are not included in JSON
                  backups.
                </p>
                <div className="settings-actions">
                  <button
                    className="admin-btn light"
                    onClick={() => downloadJson(draft)}
                  >
                    <Download size={16} /> Export content (JSON)
                  </button>
                  <input
                    type="file"
                    accept="application/json,.json"
                    ref={fileRef}
                    onChange={importContent}
                    hidden
                  />
                  <button
                    className="admin-btn light"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={16} /> Import JSON backup
                  </button>
                  <button
                    className="admin-btn light"
                    onClick={() => {
                      if (
                        confirm(
                          "Restore all example content into your unsaved editor?",
                        )
                      ) {
                        setDraft(hydrateContent(DEFAULT_CONTENT));
                        setDirty(true);
                      }
                    }}
                  >
                    <RefreshCcw size={16} /> Reset to demo content
                  </button>
                </div>
              </div>
              <div className="admin-panel">
                <div className="panel-heading-inline">
                  <h3>Version history & rollback</h3>
                  <button
                    className="admin-btn light small"
                    onClick={loadRevisions}
                    disabled={revisionsBusy}
                  >
                    <RefreshCcw size={15} />
                    {revisionsBusy ? "Loading…" : "Load revisions"}
                  </button>
                </div>
                <p className="panel-help">
                  Up to 50 previous published versions are kept. Restoring a
                  version loads it into your editor; you must click Save changes
                  to publish it.
                </p>
                {revisions.map((r) => (
                  <div className="revision-item" key={r.id}>
                    <span>
                      Version {r.version} ·{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <button
                      className="admin-btn light small"
                      onClick={() => restoreRevision(r)}
                    >
                      Restore draft
                    </button>
                  </div>
                ))}
              </div>
              <div className="admin-panel">
                <h3>Security & deployment</h3>
                <p>
                  Cloud database:{" "}
                  <strong>{supabase ? "Connected" : "Not connected"}</strong>
                </p>
                <p>
                  Editor access:{" "}
                  <strong>
                    {supabase
                      ? "Supabase email/password with row-level policies"
                      : "Locked until configured"}
                  </strong>
                </p>
                <p>
                  Public website:{" "}
                  <strong>Cloudflare Pages Functions + Vite</strong>
                </p>
                <p className="panel-help">
                  For a live site, run <code>sql/setup.sql</code> then{" "}
                  <code>sql/production_v2.sql</code> in your Supabase project
                  and grant editor access to a confirmed Supabase user. The
                  public anon key may be exposed in the browser; never expose a
                  service role key.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from "react";
import Site from "./components/Site";
import Studio from "./components/Studio";
import ProjectPage from "./components/ProjectPage";
import PrivacyPage from "./components/PrivacyPage";
import { DEFAULT_CONTENT } from "./data/defaultContent";
import { hydrateContent } from "./lib/content";
import { isConfigured, supabase } from "./lib/supabase";

const DRAFT_KEY = "kawalpreet-portfolio-local-demo-v1";

export default function App() {
  const [content, setContent] = useState(() => {
    if (isConfigured) return hydrateContent(DEFAULT_CONTENT);
    try {
      return hydrateContent(JSON.parse(localStorage.getItem(DRAFT_KEY)));
    } catch {
      return hydrateContent(DEFAULT_CONTENT);
    }
  });
  const [initializing, setInitializing] = useState(Boolean(isConfigured));
  const [contentVersion, setContentVersion] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [session, setSession] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const [route, setRoute] = useState(window.location.pathname);

  const navigate = useCallback((path) => {
    if (window.location.pathname !== path)
      window.history.pushState(null, "", path);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("portfolio_content")
      .select("data,version")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      setLoadError(error.message);
      return;
    }
    if (data?.data) {
      setContent(hydrateContent(data.data));
      setContentVersion(data.version || 1);
    }
    setLoadError("");
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.all([
      supabase
        .from("portfolio_content")
        .select("data,version")
        .eq("id", 1)
        .maybeSingle(),
      supabase.auth.getSession(),
    ])
      .then(([portfolioResult, authResult]) => {
        if (!active) return;
        if (portfolioResult.data?.data) {
          setContent(hydrateContent(portfolioResult.data.data));
          setContentVersion(portfolioResult.data.version || 1);
        }
        if (portfolioResult.error) setLoadError(portfolioResult.error.message);
        setSession(authResult.data?.session || null);
        setInitializing(false);
      })
      .catch((err) => {
        if (active) {
          setLoadError(err.message);
          setInitializing(false);
        }
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (evt, current) => {
        setSession(current);
        if (evt === "PASSWORD_RECOVERY") setRecovery(true);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const name = content.profile.name || "Creator Portfolio";
    const workId = route.startsWith("/work/")
      ? decodeURIComponent(route.slice("/work/".length))
      : "";
    const project = content.projects.find(
      (p) => String(p.id) === workId && !p.placeholder,
    );
    document.title = route.startsWith("/studio")
      ? `Studio — ${name}`
      : route === "/privacy"
        ? `Privacy | ${name}`
        : project
          ? `${project.title} | ${name}`
          : content.profile.seoTitle ||
            `${name} | UGC Creator & Content Strategist`;
    const tag = document.querySelector('meta[name="description"]');
    if (tag)
      tag.content =
        project?.description ||
        content.profile.seoDescription ||
        content.profile.intro ||
        "";
  }, [content, route]);

  const saveContent = async (next) => {
    const cleaned = hydrateContent(next);
    if (!supabase)
      throw new Error("Publishing requires a configured Supabase project.");
    const { data: newVersion, error } = await supabase.rpc(
      "publish_portfolio",
      { next_data: cleaned, expected_version: contentVersion },
    );
    if (error)
      throw new Error(
        error.code === "40001"
          ? "Another editor published changes. Export your draft, refresh, and merge before saving."
          : error.message,
      );
    setContentVersion(newVersion);
    setContent(cleaned);
  };

  if (initializing)
    return (
      <div className="app-loading">
        <div className="loading-mark">K.</div>
        <span>Preparing something lovely…</span>
      </div>
    );
  if (route.startsWith("/studio"))
    return (
      <Studio
        content={content}
        saveContent={saveContent}
        navigate={navigate}
        session={session}
        refresh={refresh}
        loadError={loadError}
        recovery={recovery}
        route={route}
        setRecovery={setRecovery}
      />
    );
  if (route === "/privacy")
    return <PrivacyPage content={content} navigate={navigate} />;
  if (route.startsWith("/work/")) {
    const id = decodeURIComponent(route.slice("/work/".length));
    const project = content.projects.find(
      (p) => String(p.id) === id && !p.placeholder,
    );
    return project ? (
      <ProjectPage content={content} project={project} navigate={navigate} />
    ) : (
      <div className="app-loading">
        <h1>Project not found</h1>
        <a href="/">Back to portfolio</a>
      </div>
    );
  }
  return <Site content={content} navigate={navigate} loadError={loadError} />;
}

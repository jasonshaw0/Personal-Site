import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDot,
  FileClock,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { session, errorMessage, type Session } from "./api";
import {
  ConfirmDialog,
  ErrorNotice,
  Loading,
  Toast,
  type Confirmation,
} from "./components/UI";
const Overview = lazy(() => import("./pages/Overview"));
const Writing = lazy(() => import("./pages/Writing"));
const Editor = lazy(() => import("./pages/Editor"));
const Media = lazy(() => import("./pages/Media"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Security = lazy(() => import("./pages/Security"));
const Settings = lazy(() => import("./pages/Settings"));
const Audit = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.AuditLog })),
);
const links = [
  { path: "overview", label: "Overview", icon: LayoutDashboard },
  { path: "writing", label: "Blog & writing", icon: BookOpen },
  { path: "media", label: "Media library", icon: FolderOpen },
  { path: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { path: "security", label: "Security", icon: ShieldCheck },
  { path: "audit", label: "Activity log", icon: FileClock },
  { path: "settings", label: "Settings", icon: Settings2 },
];
const route = () => location.hash.slice(1) || "overview";
export default function App() {
  const [identity, setIdentity] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [path, setPath] = useState(route),
    [mobile, setMobile] = useState(false),
    [compact, setCompact] = useState(
      () => matchMedia("(max-width:700px)").matches,
    ),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [toast, setToast] = useState<{ message: string; error?: boolean } | null>(
      null,
    );
  const dirty = useRef(false),
    activePath = useRef(path),
    sidebar = useRef<HTMLElement>(null),
    menuButton = useRef<HTMLButtonElement>(null);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const notify = useCallback(
    (message: string, error?: boolean) => setToast({ message, error }),
    [],
  );
  const clearToast = useCallback(() => setToast(null), []),
    closeConfirmation = useCallback(() => setConfirmation(null), []);
  const commitNavigation = (next: string, replace = false) => {
    dirty.current = false;
    activePath.current = next;
    setPath(next);
    setMobile(false);
    if (replace) history.replaceState(null, "", `#${next}`);
    else location.hash = next;
    window.scrollTo(0, 0);
  };
  const navigate = useCallback((next: string, replace = false) => {
    if (next === activePath.current) return;
    if (dirty.current && !replace) {
      setConfirmation({
        title: "Leave unsaved changes?",
        description:
          "The current changes have not been saved privately. Stay to save or export a backup, or discard these changes and leave.",
        label: "Discard and leave",
        danger: true,
        run: async () => commitNavigation(next),
      });
      return;
    }
    commitNavigation(next, replace);
  }, []);
  useEffect(() => {
    void session().then(setIdentity, (value) => setError(errorMessage(value)));
    const change = () => {
      const next = route();
      if (next === activePath.current) return;
      history.replaceState(null, "", `#${activePath.current}`);
      navigate(next);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [navigate]);
  useEffect(() => {
    const query = matchMedia("(max-width:700px)"),
      change = () => {
        setCompact(query.matches);
        if (!query.matches) setMobile(false);
      };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobile || !compact) return;
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [mobile, compact]);
  const section = path.split("/")[0],
    label = links.find((link) => link.path === section)?.label ?? "Overview";
  useEffect(() => {
    document.title = `${label} · Jason Shaw Admin`;
  }, [label]);
  if (error)
    return (
      <main className="auth-screen">
        <span className="brand">
          JS<span> / ADMIN</span>
        </span>
        <h1>Your workspace is protected.</h1>
        <ErrorNotice message={error} />
        <button className="button primary" onClick={() => location.reload()}>
          Renew Access session
        </button>
      </main>
    );
  if (!identity)
    return (
      <main className="auth-screen">
        <Loading text="Verifying your Access session…" />
      </main>
    );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={compact && !mobile}
        role={compact && mobile ? "dialog" : undefined}
        aria-modal={compact && mobile ? true : undefined}
        aria-label={compact && mobile ? "Main navigation" : undefined}
        className={`sidebar ${mobile ? "is-open" : ""}`}
      >
        <div className="sidebar-brand">
          <button className="brand" onClick={() => navigate("overview")}>
            JS<span> / ADMIN</span>
          </button>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="good-dot" />
          PERSONAL WORKSPACE
        </div>
        <nav aria-label="Main navigation">
          {links.map(({ path: target, label: caption, icon: Icon }, index) => (
            <div key={target}>
              {index === 3 && <span className="nav-caption">INSIGHTS</span>}
              {index === 5 && <span className="nav-caption">WORKSPACE</span>}
              <a
                href={`#${target}`}
                aria-current={section === target ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(target);
                }}
              >
                <Icon size={17} />
                {caption}
                {section === target && <ChevronRight size={14} />}
              </a>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="https://www.jason-shaw.com" target="_blank" rel="noreferrer">
            View public site
            <ArrowUpRight size={15} />
          </a>
          <div className="identity">
            <span className="avatar">JS</span>
            <div>
              <strong>Jason Shaw</strong>
              <span>{identity.email}</span>
            </div>
          </div>
          <span className="protected">
            <ShieldCheck size={12} />
            Protected by Cloudflare Access
          </span>
        </div>
      </aside>
      <div className="app-main" inert={compact && mobile}>
        <header className="topbar">
          <div>
            <button
              ref={menuButton}
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span className="topbar-site">jason-shaw.com</span>
            <span className="topbar-slash">/</span>
            <span>{label}</span>
            {path.includes("/") && (
              <>
                <ChevronRight size={12} />
                <span>Editor</span>
              </>
            )}
          </div>
          <span className="private-indicator">
            <CircleDot size={12} />
            Private workspace
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Suspense fallback={<Loading text="Opening your workspace…" />}>
            {section === "writing" ? (
              path.includes("/") ? (
                <Editor
                  key={path}
                  id={path.split("/")[1]}
                  navigate={navigate}
                  notify={notify}
                  confirm={setConfirmation}
                  onDirty={onDirty}
                />
              ) : (
                <Writing navigate={navigate} notify={notify} />
              )
            ) : section === "media" ? (
              <Media notify={notify} confirm={setConfirmation} />
            ) : section === "analytics" ? (
              <Analytics />
            ) : section === "security" ? (
              <Security notify={notify} confirm={setConfirmation} />
            ) : section === "settings" ? (
              <Settings />
            ) : section === "audit" ? (
              <Audit />
            ) : (
              <Overview navigate={navigate} />
            )}
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>
            JASON SHAW <span>© {new Date().getFullYear()}</span>
          </span>
          <span>ADMINISTRATION · V{identity.version}</span>
        </footer>
      </div>
      <ConfirmDialog value={confirmation} onClose={closeConfirmation} />
      <Toast value={toast} onClose={clearToast} />
    </div>
  );
}

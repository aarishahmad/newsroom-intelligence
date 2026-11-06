import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  FolderSearch,
  ShieldCheck,
  Users,
  LogOut,
  Plus,
  UserRound,
  Newspaper,
} from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/Auth";
import { api } from "../services/api";
import { Action } from "./UI";
export default function Layout() {
  const { user, setUser } = useAuth(),
    navigate = useNavigate(),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (user.role === "journalist" && user.verificationStatus !== "verified")
      return;
    const socket = io({ withCredentials: true });
    let timer;
    socket.on("story:updated", (event) => {
      setNotice(`${event.title} · ${event.status.replaceAll("_", " ")}`);
      window.dispatchEvent(new Event("stories:refresh"));
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(""), 7000);
    });
    return () => {
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [user._id, user.verificationStatus]);
  const items =
    user.role === "admin"
      ? [
          [ShieldCheck, "Verification desk", "/admin"],
          [Users, "Organization", "/admin/organization"],
        ]
      : user.role === "editor"
        ? [
            [LayoutDashboard, "Editorial overview", "/editor"],
            [Newspaper, "Review queue", "/editor/reviews"],
            [Compass, "Story discovery", "/stories"],
          ]
        : [
            [LayoutDashboard, "Overview", "/dashboard"],
            [Compass, "Story discovery", "/stories"],
            [FolderSearch, "My investigations", "/investigations"],
          ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/dashboard">
          N
          <span>
            Newsroom<span className="brand-sub">INTELLIGENCE</span>
          </span>
        </NavLink>
        <div className="org-label">
          {user.organization?.name || "Your newsroom"}
          <small>COLLABORATIVE WORKSPACE</small>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {items.map(([Icon, title, to]) => (
            <NavLink key={to} to={to} end>
              <Icon size={18} />
              {title}
            </NavLink>
          ))}
        </nav>
        {user.role === "journalist" && (
          <NavLink className="sidebar-new" to="/stories/create">
            <Plus size={17} />
            Submit a lead
          </NavLink>
        )}
        <div className="sidebar-bottom">
          <div className="principle">
            <ShieldCheck size={19} />
            <strong>Evidence before certainty.</strong>
            <p>
              A lead is a starting point. Verification happens through
              reporting.
            </p>
          </div>
          <NavLink to="/profile" className="profile">
            <span className="avatar">{user.fullName[0]}</span>
            <span>
              {user.fullName}
              <small>{user.role}</small>
            </span>
            <UserRound size={16} />
          </NavLink>
          <Action
            className="logout"
            onClick={async () => {
              await api.post("/auth/logout");
              setUser(null);
              navigate("/login");
            }}
          >
            <LogOut size={15} />
            Sign out
          </Action>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>Newsroom intelligence</strong>
          </span>
          <span className="live">
            <i />
            Connected newsroom
          </span>
        </header>
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
        <main className="content">
          <Outlet />
        </main>
        <footer>
          NEWSROOM INTELLIGENCE{" "}
          <span>Built for careful, collaborative journalism.</span>
        </footer>
      </div>
    </div>
  );
}

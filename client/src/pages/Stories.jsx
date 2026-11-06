import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, MapPin, Clock3, Plus, Search } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { useAuth } from "../context/Auth";
import { Badge, Empty, Field, Action } from "../components/UI";
export const categories = [
  "Local",
  "Politics",
  "Environment",
  "Business",
  "Health",
  "Education",
  "Technology",
];
export const statuses = [
  "NEW_LEAD",
  "CLAIMED",
  "INVESTIGATING",
  "EDITOR_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
];
export function Stories() {
  const { user } = useAuth(),
    { pathname } = useLocation();
  const mine = pathname === "/investigations",
    editor = pathname.startsWith("/editor"),
    overview = pathname === "/dashboard" || pathname === "/editor";
  const [stories, setStories] = useState([]),
    [filters, setFilters] = useState({
      search: "",
      category: "",
      location: "",
      priority: "",
      status: "",
      sort: "newest",
    }),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = () => {
      setError("");
      api
        .get(editor ? "/editor/reviews" : "/stories", {
          params: { ...filters, mine },
        })
        .then((r) => {
          if (active) setStories(r.data);
        })
        .catch((e) => active && setError(errorMessage(e)))
        .finally(() => active && setLoading(false));
    };
    const timer = setTimeout(load, 200);
    window.addEventListener("stories:refresh", load);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("stories:refresh", load);
    };
  }, [filters, mine, editor]);
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {editor ? "THE EDITORIAL DESK" : "THE REPORTING DESK"}
          </p>
          <h1>
            {mine
              ? "My investigations"
              : editor
                ? "Editorial workspace"
                : overview
                  ? `Good to see you, ${user.fullName.split(" ")[0]}.`
                  : "Follow the next story."}
          </h1>
          <p className="muted">
            {mine
              ? "Your active reporting, from first question to final draft."
              : editor
                ? "Review the reporting. Strengthen the story."
                : "Discover leads, connect the evidence, and move stories forward."}
          </p>
        </div>
        {user.role === "journalist" && (
          <Link className="button primary" to="/stories/create">
            <Plus size={17} />
            Submit a lead
          </Link>
        )}
      </div>
      <div className="stats">
        {(editor
          ? [
              [
                "Awaiting review",
                stories.filter((s) => s.status === "EDITOR_REVIEW").length,
              ],
              [
                "Under investigation",
                stories.filter((s) => s.status === "INVESTIGATING").length,
              ],
              [
                "Changes requested",
                stories.filter((s) => s.status === "CHANGES_REQUESTED").length,
              ],
              [
                "Approved",
                stories.filter((s) => s.status === "APPROVED").length,
              ],
            ]
          : [
              [
                "New story leads",
                stories.filter((s) => s.status === "NEW_LEAD").length,
              ],
              [
                "My active investigations",
                stories.filter(
                  (s) =>
                    s.investigator?._id === user._id &&
                    ["CLAIMED", "INVESTIGATING", "CHANGES_REQUESTED"].includes(
                      s.status,
                    ),
                ).length,
              ],
              [
                "Awaiting review",
                stories.filter((s) => s.status === "EDITOR_REVIEW").length,
              ],
              [
                "Published stories",
                stories.filter((s) => s.status === "PUBLISHED").length,
              ],
            ]
        ).map(([name, count], i) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{String(count).padStart(2, "0")}</strong>
            <small>
              {
                [
                  "Ready for a closer look",
                  "Reporting in progress",
                  "At the editorial desk",
                  "From lead to story",
                ][i]
              }
            </small>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h2>
            {mine
              ? "Your reporting board"
              : editor
                ? "Stories on the desk"
                : "Story discovery"}
          </h2>
          <p className="muted">
            {stories.length} stories in this view · Newest leads first
          </p>
        </div>
        <span className="subtle-tag">PRIVATE NEWSROOM</span>
      </div>
      {!editor && (
        <div className="filters">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search stories"
              placeholder="Search stories, topics, or keywords…"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
            />
          </label>
          <select
            aria-label="Category"
            value={filters.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            aria-label="Location"
            placeholder="Location"
            value={filters.location}
            onChange={(e) => set("location", e.target.value)}
          />
          <select
            aria-label="Priority"
            onChange={(e) => set("priority", e.target.value)}
          >
            <option value="">Any priority</option>
            {["High", "Medium", "Low"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Status"
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Sort"
            onChange={(e) => set("sort", e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="priority">Priority first</option>
          </select>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="empty">Loading the newsroom…</div>
      ) : stories.length ? (
        <div className="story-grid">
          {stories.map((s, i) => (
            <article className="story-card" key={s._id}>
              <div className="card-top">
                <span className="category">{s.category}</span>
                <Badge value={s.priority} />
              </div>
              <Link className="story-title" to={`/stories/${s._id}`}>
                <h2>{s.title}</h2>
                <ArrowUpRight size={20} />
              </Link>
              <p className="story-description">{s.description}</p>
              <div className="story-meta">
                <span>
                  <MapPin size={13} />
                  {s.location}
                </span>
                <span>
                  <Clock3 size={13} />
                  {new Date(s.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="card-status">
                <Badge value={s.status} />
                <span className="evidence-label">Claims need verification</span>
              </div>
              <div className="card-bottom">
                <span className="byline">
                  <span className="avatar small">
                    {
                      (s.submittedBy?.fullName ||
                        s.investigator?.fullName ||
                        "N")[0]
                    }
                  </span>
                  {s.investigator?.fullName ||
                    s.submittedBy?.fullName ||
                    "Newsroom"}
                </span>
                <Link to={`/stories/${s._id}`}>
                  {s.status === "NEW_LEAD" ? "Explore lead" : "Open story"}{" "}
                  <span>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty />
      )}
      <div className="desk-note">
        <span>↳</span>
        <div>
          <strong>A verified journalist does not make a verified story.</strong>
          <p>
            Every lead starts with questions. Build the evidence before drawing
            conclusions.
          </p>
        </div>
      </div>
    </>
  );
}
export function CreateStory() {
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <p className="eyebrow">START THE REPORTING</p>
      <h1>Submit a story lead</h1>
      <p className="muted">
        Share what has been reported, and make the unknowns clear.
      </p>
      <form
        className="panel form-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          if (data.incidentAt)
            data.incidentAt = new Date(data.incidentAt).toISOString();
          else delete data.incidentAt;
          if (data.sourceTitle)
            data.initialSource = {
              title: data.sourceTitle,
              url: data.sourceUrl,
              type: "Website",
              notes: data.sourceNotes,
            };
          delete data.sourceTitle;
          delete data.sourceUrl;
          delete data.sourceNotes;
          try {
            const r = await api.post("/stories", data);
            navigate(`/stories/${r.data._id}`);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Story title"
          name="title"
          minLength={5}
          maxLength={180}
          required
        />
        <Field label="What do we know so far?">
          <textarea
            name="description"
            minLength={20}
            maxLength={5000}
            rows={5}
            required
            placeholder="Attribute claims and explain what still needs to be checked."
          />
        </Field>
        <div className="two-col">
          <Field label="Category">
            <select name="category">
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority">
              <option>Medium</option>
              <option>High</option>
              <option>Low</option>
            </select>
          </Field>
          <Field label="Location" name="location" required minLength={2} />
          <Field
            label="Incident date and time (optional)"
            name="incidentAt"
            type="datetime-local"
          />
        </div>
        <h3>
          Initial source <small>optional</small>
        </h3>
        <Field label="Source title" name="sourceTitle" />
        <Field label="Source URL" name="sourceUrl" type="url" />
        <Field label="Source notes">
          <textarea name="sourceNotes" rows={2} />
        </Field>
        <p className="muted">
          You can attach an optional lead image after creating the story.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Submitting…" : "Create story lead →"}
        </button>
      </form>
    </>
  );
}

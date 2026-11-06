import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../services/api";
import { useAuth } from "../context/Auth";
import { Action, Badge, Field, label } from "../components/UI";
export default function Story() {
  const { id } = useParams(),
    { user } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview"),
    [draft, setDraft] = useState({
      headline: "",
      body: "",
      summary: "",
      facts: "",
    }),
    [saved, setSaved] = useState(""),
    [feedback, setFeedback] = useState(""),
    [ai, setAi] = useState(""),
    [aiInput, setAiInput] = useState(""),
    [task, setTask] = useState("story-brief");
  const load = async () => {
    const r = await api.get(`/stories/${id}`);
    setData(r.data);
  };
  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(() => {
    if (data?.story.draft)
      setDraft({
        headline: "",
        body: "",
        summary: "",
        facts: "",
        ...data.story.draft,
      });
  }, [data?.story._id]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading story…</p>;
  const { story, sources, evidence, investigation, reviews } = data;
  const own =
      story.investigator?._id === user._id && user.role === "journalist",
    editable =
      own &&
      ["CLAIMED", "INVESTIGATING", "CHANGES_REQUESTED"].includes(story.status);
  async function post(path, body) {
    await api.post(path, body);
    await load();
  }
  async function form(e, path) {
    e.preventDefault();
    setError("");
    const element = e.currentTarget;
    try {
      await post(path, Object.fromEntries(new FormData(element)));
      element.reset();
    } catch (e) {
      setSaved(errorMessage(e));
    }
  }
  return (
    <>
      <Link className="back" to="/stories">
        ← Back to story discovery
      </Link>
      <div className="page-heading story-heading">
        <div>
          <div className="button-row">
            <span className="category">{story.category}</span>
            <Badge value={story.priority} />
            <Badge value={story.status} />
          </div>
          <h1>{story.title}</h1>
          <p className="muted">
            {story.location} · Submitted by {story.submittedBy?.fullName} ·{" "}
            {new Date(story.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="story-actions">
        {story.status === "NEW_LEAD" && user.role === "journalist" && (
          <Action
            className="primary"
            onClick={() => post(`/stories/${id}/claim`)}
          >
            Investigate story →
          </Action>
        )}
        {story.status === "CLAIMED" && own && (
          <Action
            className="primary"
            onClick={() => post(`/stories/${id}/start`)}
          >
            Start investigation →
          </Action>
        )}
        <span>
          {story.investigator
            ? `Assigned to ${story.investigator.fullName}`
            : "Available for investigation"}
        </span>
        <Action onClick={load}>Refresh story</Action>
      </div>
      <div className="tabs">
        {[
          "Overview",
          "Sources & evidence",
          "Investigation notes",
          "Story draft",
          "AI assistant",
          "Review history",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => {
              setTab(t);
              setSaved("");
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {saved && (
        <p className="message" role="status">
          {saved}
        </p>
      )}
      {tab === "Overview" && (
        <div className="detail-grid">
          <section className="panel">
            <h2>The lead</h2>
            <p className="prose">{story.description}</p>
            {story.image?.url && (
              <img
                className="lead-image"
                src={story.image.url}
                alt="Lead attachment"
              />
            )}
            {story.incidentAt && (
              <p>
                Incident reported: {new Date(story.incidentAt).toLocaleString()}
              </p>
            )}
            <div className="desk-note">
              <div>
                <strong>
                  Story evidence is separate from journalist verification.
                </strong>
                <p>
                  This lead contains reported claims. Review sources and
                  evidence before making any conclusions.
                </p>
              </div>
            </div>
            {story.status === "NEW_LEAD" &&
              story.submittedBy?._id === user._id && (
                <Upload
                  title="Add an optional lead image"
                  path={`/stories/${id}/image`}
                  after={load}
                  image
                />
              )}
          </section>
          <aside className="panel">
            <h3>Reporting file</h3>
            <div className="file-count">
              <strong>{sources.length}</strong> Sources attached
            </div>
            <div className="file-count">
              <strong>{evidence.length}</strong> Evidence files
            </div>
            <div className="file-count">
              <strong>{investigation?.notes.length || 0}</strong> Investigation
              notes
            </div>
            <h3>Story timeline</h3>
            {story.history.map((h, i) => (
              <div className="timeline" key={i}>
                <strong>{label(h.status)}</strong>
                <small>{new Date(h.at).toLocaleString()}</small>
              </div>
            ))}
          </aside>
        </div>
      )}
      {tab === "Sources & evidence" && (
        <div className="detail-grid">
          <section className="panel">
            <h2>
              Sources <span className="muted">/ {sources.length}</span>
            </h2>
            {sources.length === 0 && (
              <p className="muted">No sources added yet.</p>
            )}
            {sources.map((s) => (
              <div className="entry" key={s._id}>
                <span className="category">{s.type}</span>
                <h3>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title} ↗
                    </a>
                  ) : (
                    s.title
                  )}
                </h3>
                <p className="prose">{s.notes}</p>
                <small>
                  {s.addedBy?.fullName} ·{" "}
                  {new Date(s.createdAt).toLocaleDateString()}
                </small>
              </div>
            ))}
            {editable && (
              <form onSubmit={(e) => form(e, `/stories/${id}/sources`)}>
                <h3>Add a source</h3>
                <Field
                  label="Source title"
                  name="title"
                  required
                  minLength={2}
                />
                <Field label="Source type">
                  <select name="type">
                    {[
                      "Website",
                      "Government source",
                      "Police statement",
                      "Company statement",
                      "Interview",
                      "Previous news report",
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="URL (optional)" name="url" type="url" />
                <Field label="Source notes">
                  <textarea name="notes" rows={3} />
                </Field>
                <button className="primary">Add source</button>
              </form>
            )}
          </section>
          <section className="panel">
            <h2>Evidence</h2>
            <p className="muted">Original materials for human review.</p>
            {evidence.map((e) => (
              <div className="entry" key={e._id}>
                <a href={e.url} target="_blank" rel="noreferrer">
                  {e.title} ↗
                </a>
                <small>
                  {e.format?.toUpperCase()} · {Math.ceil(e.bytes / 1024)} KB
                </small>
              </div>
            ))}
            {editable && (
              <Upload path={`/stories/${id}/evidence`} after={load} />
            )}
          </section>
        </div>
      )}
      {tab === "Investigation notes" && (
        <section className="panel form-panel">
          <h2>Investigation notebook</h2>
          {investigation?.notes.map((n) => (
            <div className="entry" key={n._id}>
              <p className="prose">{n.text}</p>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
            </div>
          ))}
          {!investigation?.notes.length && (
            <p className="muted">
              Record findings, open questions, and the next reporting steps.
            </p>
          )}
          {editable && (
            <form onSubmit={(e) => form(e, `/stories/${id}/notes`)}>
              <Field label="New note">
                <textarea name="text" rows={5} required />
              </Field>
              <button className="primary">Save note</button>
            </form>
          )}
        </section>
      )}
      {tab === "Story draft" && (
        <div className="detail-grid">
          <section className="panel">
            <h2>Develop the story</h2>
            {["headline", "summary", "body", "facts"].map((key) => (
              <Field
                key={key}
                label={
                  key === "facts" ? "Important facts & attribution" : label(key)
                }
              >
                <textarea
                  rows={key === "body" ? 16 : 3}
                  disabled={!editable}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            {editable && (
              <div className="button-row">
                <Action
                  className="primary"
                  onClick={async () => {
                    await api.put(`/stories/${id}/draft`, draft);
                    setSaved("Draft saved.");
                  }}
                >
                  Save draft
                </Action>
                {story.status !== "CLAIMED" && (
                  <Action
                    onClick={async () => {
                      await api.put(`/stories/${id}/draft`, draft);
                      await post(`/stories/${id}/submit-review`);
                      setSaved("Draft submitted to the editorial desk.");
                    }}
                  >
                    Save & submit for review →
                  </Action>
                )}
              </div>
            )}
          </section>
          <section className="panel">
            <h3>Editorial review</h3>
            <Badge value={story.status} />
            {reviews.map((r) => (
              <div className="entry" key={r._id}>
                <strong>{label(r.decision)}</strong>
                <p>{r.feedback || "No additional feedback."}</p>
                <small>{r.editor?.fullName}</small>
              </div>
            ))}
            {user.role === "editor" &&
              ["EDITOR_REVIEW", "APPROVED"].includes(story.status) && (
                <>
                  <Field label="Editor feedback">
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={5}
                    />
                  </Field>
                  <div className="button-row">
                    {(story.status === "APPROVED"
                      ? ["publish"]
                      : ["approve", "request-changes", "reject"]
                    ).map((action) => (
                      <Action
                        key={action}
                        className={
                          action === "approve" || action === "publish"
                            ? "primary"
                            : ""
                        }
                        onClick={() =>
                          post(`/editor/reviews/${id}/${action}`, { feedback })
                        }
                      >
                        {label(action.replace("-", "_"))}
                      </Action>
                    ))}
                  </div>
                </>
              )}
          </section>
        </div>
      )}
      {tab === "AI assistant" && (
        <section className="panel form-panel">
          <span className="category">ASSISTANCE, NOT VERIFICATION</span>
          <h2>A second set of questions.</h2>
          <p className="muted">
            Gemini can help organize your reporting. It cannot determine whether
            a story is true. Story details, source notes, draft, and any text
            below will be sent to Gemini when you generate suggestions.
          </p>
          <Field label="Assistance type">
            <select value={task} onChange={(e) => setTask(e.target.value)}>
              <option value="story-brief">
                Story brief & missing information
              </option>
              <option value="investigation-questions">
                Interview & investigation questions
              </option>
              <option value="summarize">
                Summarize pasted documents or multiple sources
              </option>
              <option value="extract-facts">Extract attributed claims</option>
            </select>
          </Field>
          <Field label="Additional text (optional)">
            <textarea
              rows={7}
              maxLength={30000}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Paste document text or excerpts from multiple sources. Avoid confidential source identities."
            />
          </Field>
          <Action
            className="primary"
            onClick={async () => {
              const r = await api.post(`/ai/${task}`, {
                storyId: id,
                text: aiInput,
              });
              setAi(r.data.text);
            }}
          >
            Generate suggestions
          </Action>
          {ai && (
            <div className="ai-output">
              <Badge value="AI GENERATED" />
              <p className="prose">{ai}</p>
            </div>
          )}
        </section>
      )}
      {tab === "Review history" && (
        <section className="panel form-panel">
          <h2>Editorial decisions</h2>
          {reviews.length ? (
            reviews.map((r) => (
              <div className="entry" key={r._id}>
                <Badge value={r.decision} />
                <p className="prose">
                  {r.feedback || "No additional feedback."}
                </p>
                <small>
                  {r.editor?.fullName} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </small>
              </div>
            ))
          ) : (
            <p className="muted">
              This story has not received an editorial decision.
            </p>
          )}
        </section>
      )}
    </>
  );
}
function Upload({ path, after, title = "Attach evidence", image = false }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="upload"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError("");
        try {
          await api.post(path, new FormData(form));
          form.reset();
          await after();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{title}</h3>
      {!image && (
        <Field label="Evidence title" name="title" minLength={2} required />
      )}
      <Field
        label={
          image
            ? "PNG or JPEG · up to 20 MB"
            : "PNG, JPEG, PDF, MP4 · up to 20 MB"
        }
        name="file"
        type="file"
        accept={
          image
            ? "image/png,image/jpeg"
            : "image/png,image/jpeg,application/pdf,video/mp4"
        }
        required
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy}>{busy ? "Uploading…" : "Upload file"}</button>
    </form>
  );
}

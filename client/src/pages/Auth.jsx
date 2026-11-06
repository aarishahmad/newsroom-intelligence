import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../services/api";
import { useAuth } from "../context/Auth";
import { Field } from "../components/UI";
export default function Auth({ register = false }) {
  const { refresh } = useAuth(),
    navigate = useNavigate();
  const [orgs, setOrgs] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (register)
      api
        .get("/organizations")
        .then((r) => setOrgs(r.data))
        .catch((e) => setError(errorMessage(e)));
  }, [register]);
  return (
    <div className="auth-page">
      <aside>
        <Link to="/" className="brand">
          N
          <span>
            Newsroom<span className="brand-sub">INTELLIGENCE</span>
          </span>
        </Link>
        <div>
          <p className="eyebrow">GOOD REPORTING STARTS HERE</p>
          <h1>
            The next story.
            <br />A clearer starting point.
          </h1>
          <p>
            A shared workspace for leads, evidence, and the people who bring the
            story together.
          </p>
        </div>
        <small>Independent thinking. Collaborative reporting.</small>
      </aside>
      <main>
        <div className="auth-form">
          <p className="eyebrow">YOUR NEWSROOM WORKSPACE</p>
          <h1>{register ? "Join your newsroom" : "Welcome back."}</h1>
          <p className="muted">
            {register
              ? "Create an account. Your organization will review your credentials."
              : "Sign in to pick up where the story left off."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api.post(
                  `/auth/${register ? "register" : "login"}`,
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                await refresh();
                navigate("/dashboard");
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {register && <Field label="Full name" name="fullName" required />}
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <Field
              label="Password"
              name="password"
              type="password"
              minLength={register ? 10 : 1}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
              required
            />
            {register && (
              <>
                <Field label="Organization">
                  <select name="organization" required>
                    <option value="">Select organization</option>
                    {orgs.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="two-col">
                  <Field label="Designation" name="designation" required />
                  <Field label="Location" name="location" required />
                </div>
                <Field label="Professional information (optional)">
                  <textarea name="professionalInfo" rows="2" />
                </Field>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : register
                  ? "Request an account →"
                  : "Sign in →"}
            </button>
          </form>
          <p className="muted">
            {register ? "Already a member?" : "New to the newsroom?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

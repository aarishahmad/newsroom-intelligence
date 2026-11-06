import { useEffect, useState } from "react";
import { api, errorMessage } from "../services/api";
import { useAuth } from "../context/Auth";
import { Badge, Action, Empty } from "../components/UI";
export function Profile() {
  const { user, refresh } = useAuth();
  return (
    <>
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1>Journalist profile</h1>
      <div className="panel form-panel">
        <h2>{user.fullName}</h2>
        <p>{user.email}</p>
        <Badge value={user.verificationStatus} />
        <dl>
          <dt>Organization</dt>
          <dd>{user.organization?.name}</dd>
          <dt>Designation</dt>
          <dd>{user.designation}</dd>
          <dt>Location</dt>
          <dd>{user.location}</dd>
        </dl>
        {user.verificationStatus !== "verified" && (
          <>
            <p>
              Organization approval is required to access leads, submit stories,
              or start an investigation.
            </p>
            {user.verificationFeedback && (
              <p className="error">{user.verificationFeedback}</p>
            )}
            <Action
              className="primary"
              onClick={async () => {
                await api.post("/users/verification-request");
                await refresh();
              }}
            >
              Request verification
            </Action>{" "}
            <Action onClick={refresh}>Refresh status</Action>
          </>
        )}
      </div>
    </>
  );
}
export function Admin() {
  const { user } = useAuth(),
    [members, setMembers] = useState([]),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState({});
  const load = () =>
    api
      .get("/users")
      .then((r) => setMembers(r.data))
      .catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <p className="eyebrow">ORGANIZATION ADMINISTRATION</p>
      <h1>The verification desk</h1>
      <p className="muted">
        {user.organization?.name} · Review credentials and manage newsroom
        access.
      </p>
      <div className="stats">
        {[
          [
            "Pending requests",
            members.filter((u) => u.verificationStatus === "pending").length,
          ],
          [
            "Verified journalists",
            members.filter(
              (u) =>
                u.role === "journalist" && u.verificationStatus === "verified",
            ).length,
          ],
          ["Organization members", members.length],
        ].map(([name, value]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel">
        <h2>Organization members</h2>
        <p className="muted">
          Verification confirms professional access, never the truth of a story.
        </p>
        {members.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Professional information</th>
                  <th>Access</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <strong>{m.fullName}</strong>
                      <small>{m.email}</small>
                      <small>{m.role}</small>
                    </td>
                    <td>
                      {m.designation} · {m.location}
                      <small>
                        {m.professionalInfo || "No additional information"}
                      </small>
                    </td>
                    <td>
                      <Badge value={m.verificationStatus} />
                      <small>{m.active ? "Active account" : "Suspended"}</small>
                    </td>
                    <td>
                      {m.role === "journalist" && (
                        <>
                          <input
                            aria-label={`Feedback for ${m.fullName}`}
                            placeholder="Review feedback"
                            value={feedback[m._id] || ""}
                            onChange={(e) =>
                              setFeedback({
                                ...feedback,
                                [m._id]: e.target.value,
                              })
                            }
                          />
                          <div className="button-row">
                            {["verified", "rejected"].map((status) => (
                              <Action
                                key={status}
                                onClick={async () => {
                                  await api.patch(`/users/${m._id}`, {
                                    verificationStatus: status,
                                    verificationFeedback: feedback[m._id] || "",
                                  });
                                  await load();
                                }}
                              >
                                {status === "verified" ? "Approve" : "Reject"}
                              </Action>
                            ))}
                            <Action
                              onClick={async () => {
                                await api.patch(`/users/${m._id}`, {
                                  active: !m.active,
                                });
                                await load();
                              }}
                            >
                              {m.active ? "Suspend" : "Restore"}
                            </Action>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No members found.</Empty>
        )}
      </div>
    </>
  );
}

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/Auth";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import { Stories, CreateStory } from "./pages/Stories";
import Story from "./pages/Story";
import { Admin, Profile } from "./pages/Administration";
function Guard({ roles, verified = false }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="empty">Opening your newsroom…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  if (
    verified &&
    user.role === "journalist" &&
    user.verificationStatus !== "verified"
  )
    return <Navigate to="/profile" replace />;
  return <Outlet />;
}
function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
function Dashboard() {
  const { user } = useAuth();
  return user.role === "admin" ? (
    <Navigate to="/admin" />
  ) : user.role === "editor" ? (
    <Navigate to="/editor" />
  ) : (
    <Stories />
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route element={<Guard />}>
            <Route element={<Layout />}>
              <Route path="/profile" element={<Profile />} />
              <Route element={<Guard verified />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/stories" element={<Stories />} />
                <Route path="/stories/:id" element={<Story />} />
                <Route element={<Guard roles={["journalist"]} />}>
                  <Route path="/stories/create" element={<CreateStory />} />
                  <Route path="/investigations" element={<Stories />} />
                  <Route path="/investigations/:id" element={<Story />} />
                </Route>
                <Route element={<Guard roles={["editor"]} />}>
                  <Route path="/editor" element={<Stories />} />
                  <Route path="/editor/reviews" element={<Stories />} />
                  <Route path="/editor/stories/:id" element={<Story />} />
                </Route>
              </Route>
              <Route element={<Guard roles={["admin"]} />}>
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/journalists" element={<Admin />} />
                <Route path="/admin/organization" element={<Admin />} />
              </Route>
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Page not found</h1>
                <Link to="/dashboard">Back to newsroom</Link>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

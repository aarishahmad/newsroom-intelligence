import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
const Context = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  return (
    <Context.Provider value={{ user, setUser, loading, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);

import axios from "axios";
export const api = axios.create({ baseURL: "/api", withCredentials: true });
export const errorMessage = (e) =>
  e.response?.data?.message || "Could not connect. Please try again.";

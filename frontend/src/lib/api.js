import axios from "axios";

const TOKEN_KEY = "streamrag_token";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 20000,
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem(TOKEN_KEY);
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

api.interceptors.response.use(
	(response) => response,
	(error) => {
		const url = error.config?.url || "";
		const isAuthCall = url.startsWith("/auth/");
		if (error.response?.status === 401 && !isAuthCall && localStorage.getItem(TOKEN_KEY)) {
			localStorage.removeItem(TOKEN_KEY);
			window.location.assign("/login");
		}
		return Promise.reject(error);
	}
);

export function setAuthToken(token) {
	localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken() {
	return localStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken() {
	localStorage.removeItem(TOKEN_KEY);
}

export async function loginUser(payload) {
	const { data } = await api.post("/auth/login", payload);
	return data;
}

export async function registerUser(payload) {
	const { data } = await api.post("/auth/register", payload);
	return data;
}

export async function queryIncident(payload) {
	const { data } = await api.post("/api/query", payload);
	return data;
}

export async function fetchPipeline(limit = 80) {
	const { data } = await api.get(`/api/events/pipeline?limit=${limit}`);
	return data;
}

export async function fetchTimeline(entityId) {
	const { data } = await api.get(`/api/timeline/${entityId}`);
	return data;
}

export async function fetchStatus() {
	const { data } = await api.get("/api/status");
	return data;
}

export async function publishDemoEvents(runDemo = true) {
	const { data } = await api.post("/api/simulator/publish", { run_demo: runDemo });
	return data;
}

export async function publishCustomEvent(event) {
	const { data } = await api.post("/api/simulator/publish", {
		run_demo: false,
		entity_id: event.entity_id,
		event_type: event.event_type,
		payload: event.payload,
		source: event.source || "simulator",
		event_time: event.event_time || null,
		event_id: event.event_id || null,
	});
	return data;
}

export async function startSimulatorStream(payload) {
	const { data } = await api.post("/api/simulator/stream/start", payload);
	return data;
}

export async function stopSimulatorStream() {
	const { data } = await api.post("/api/simulator/stream/stop");
	return data;
}

export async function fetchSimulatorStreamStatus() {
	const { data } = await api.get("/api/simulator/stream/status");
	return data;
}
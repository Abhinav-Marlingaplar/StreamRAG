export const STATUS_TONE = {
	investigating: "amber",
	root_cause_identified: "blue",
	mitigated: "violet",
	resolved: "green",
};

export const EVENT_TYPE_LABEL = {
	incident_created: "Created",
	incident_updated: "Updated",
	incident_resolved: "Resolved",
};

export const STATUS_OPTIONS = ["investigating", "root_cause_identified", "mitigated", "resolved"];

export const humanize = (value) => String(value || "").replaceAll("_", " ");

export function statusTone(status) {
	return STATUS_TONE[status] || "neutral";
}

const pad = (value) => String(value).padStart(2, "0");

export function formatClock(value, { seconds = true } = {}) {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return seconds ? `${base}:${pad(date.getSeconds())}` : base;
}

export function formatUtc(value) {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatDateTime(value) {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${formatClock(date, { seconds: false })}`;
}

export function timeAgo(value, now = Date.now()) {
	if (!value) return "—";
	const diff = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
	if (diff < 5) return "just now";
	if (diff < 60) return `${diff}s ago`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDuration(ms) {
	if (ms == null || Number.isNaN(ms)) return "—";
	if (ms < 1000) return `${Math.round(ms)} ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
	return `${Math.round(ms / 60000)} min`;
}

export const toMs = (value) => (value ? new Date(value).getTime() : null);

export function pipelineLatency(event) {
	const published = toMs(event.published_at);
	const ingested = toMs(event.ingested_at);
	if (published == null || ingested == null || event.duplicate) return null;
	return Math.max(0, ingested - published);
}

export function newEventId() {
	if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
	return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newIncidentId() {
	return `INC-${Math.floor(7000 + Math.random() * 2999)}`;
}

export function errorMessage(error, fallback) {
	if (error?.response?.data?.detail) {
		const detail = error.response.data.detail;
		return typeof detail === "string" ? detail : JSON.stringify(detail);
	}
	if (error?.code === "ERR_NETWORK") return "Can't reach the StreamRAG API. Is the backend running on port 8000?";
	return fallback;
}

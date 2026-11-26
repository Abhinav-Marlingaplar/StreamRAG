// Geometry for the desktop SVG (viewBox 0 0 1240 800) and the stage script shared by
// the desktop diagram, the mobile layout, and the inspector panel.

export const VIEW = { width: 1240, height: 800 };

const TOP_Y = 68;
const BOTTOM_Y = 500;
const NODE_H = 88;

export const nodes = {
	source: { x: 40, y: TOP_Y, w: 176, h: NODE_H, flow: "ingest", kind: "source", title: "Event source", sub: "CSV · simulator API" },
	kafka: { x: 286, y: TOP_Y, w: 176, h: NODE_H, flow: "ingest", kind: "transport", title: "Kafka", sub: "operations-events" },
	consumer: { x: 532, y: TOP_Y, w: 176, h: NODE_H, flow: "ingest", kind: "process", title: "Consumer worker", sub: "validate · dedupe" },
	versioning: { x: 778, y: TOP_Y, w: 176, h: NODE_H, flow: "ingest", kind: "process", title: "Temporal versioning", sub: "valid_from → valid_to" },
	embed: { x: 1024, y: TOP_Y, w: 176, h: NODE_H, flow: "ingest", kind: "process", title: "Embedding", sub: "MiniLM-L6 · 384-d" },
	query: { x: 40, y: BOTTOM_Y, w: 160, h: NODE_H, flow: "query", kind: "source", title: "User query", sub: "POST /api/query" },
	retrieve: { x: 240, y: BOTTOM_Y, w: 160, h: NODE_H, flow: "query", kind: "process", title: "Semantic retrieval", sub: "pgvector cosine" },
	gate: { x: 440, y: BOTTOM_Y, w: 160, h: NODE_H, flow: "query", kind: "decision", title: "Dynamic gating", sub: "Sc → tier · K · α" },
	tar: { x: 640, y: BOTTOM_Y, w: 160, h: NODE_H, flow: "query", kind: "scoring", title: "TAR scoring", sub: "similarity + recency" },
	evidence: { x: 840, y: BOTTOM_Y, w: 160, h: NODE_H, flow: "query", kind: "evidence", title: "Evidence", sub: "causal top-K" },
	llm: { x: 1040, y: BOTTOM_Y, w: 160, h: NODE_H, flow: "query", kind: "process", title: "LLM generation", sub: "grounded prompt" },
};

export const STORE = { x: 40, y: 236, w: 1160, h: 210 };
export const ANSWER = { x: 560, y: 640, w: 640, h: 132 };

export const edges = {
	"source-kafka": { d: "M216 112 H286", flow: "ingest" },
	"kafka-consumer": { d: "M462 112 H532", flow: "ingest" },
	"consumer-versioning": { d: "M708 112 H778", flow: "ingest" },
	"versioning-store": { d: "M866 156 V236", flow: "ingest" },
	"versioning-embed": { d: "M954 112 H1024", flow: "ingest" },
	"embed-store": { d: "M1112 156 V236", flow: "ingest" },
	"query-retrieve": { d: "M200 544 H240", flow: "query" },
	"retrieve-store": { d: "M304 500 V446", flow: "query" },
	"store-retrieve": { d: "M336 446 V500", flow: "query" },
	"retrieve-gate": { d: "M400 544 H440", flow: "query" },
	"gate-tar": { d: "M600 544 H640", flow: "query" },
	"tar-evidence": { d: "M800 544 H840", flow: "query" },
	"evidence-llm": { d: "M1000 544 H1040", flow: "query" },
	"llm-answer": { d: "M1120 588 V640", flow: "query" },
};

export const FLOWS = {
	ingest: { label: "Flow A", name: "Continuous ingestion" },
	query: { label: "Flow B", name: "Temporal query" },
};

export const stages = [
	{
		flow: "ingest",
		node: "source",
		edges: ["source-kafka"],
		title: "An incident event is published",
		body: "The CSV simulator or the in-app Simulator API publishes a lifecycle event — here evt-1024-04, incident_resolved — as JSON onto Kafka.",
		ref: "simulator/producer.py",
	},
	{
		flow: "ingest",
		node: "kafka",
		edges: ["kafka-consumer"],
		title: "Kafka carries the stream",
		body: "Events land on the operations-events topic. Kafka is transport only; the authoritative state lives in PostgreSQL.",
		ref: "infrastructure/docker-compose.yml",
	},
	{
		flow: "ingest",
		node: "consumer",
		edges: ["consumer-versioning"],
		title: "The worker validates and de-duplicates",
		body: "An aiokafka consumer validates each payload, skips events whose event_id was already stored, and commits the offset only after processing.",
		ref: "backend/app/kafka/consumer.py",
	},
	{
		flow: "ingest",
		node: "versioning",
		edges: ["versioning-store"],
		title: "A new knowledge version opens",
		body: "The raw event is appended to raw_events and a new knowledge version starts at the event time. The previous version is closed — its valid_to becomes 11:00 — instead of being overwritten.",
		ref: "backend/app/core/temporal.py",
	},
	{
		flow: "ingest",
		node: "embed",
		edges: ["versioning-embed", "embed-store"],
		title: "The version is embedded",
		body: "The version text is encoded with all-MiniLM-L6-v2 into a 384-dimension vector and written to the pgvector column on the same row.",
		ref: "backend/app/vectorstore.py",
	},
	{
		flow: "ingest",
		node: "store",
		edges: [],
		title: "Knowledge is ready to query",
		body: "PostgreSQL now holds every version of INC-1024 with its validity window and embedding — current and historical truth side by side.",
		ref: "backend/app/models.py",
	},
	{
		flow: "query",
		node: "query",
		edges: ["query-retrieve"],
		title: "A question arrives",
		body: "“What was the status of INC-1024 as of 10:35?” The entity ID is extracted, and the query time is resolved from as_of, a time in the question, or now.",
		ref: "backend/app/routers/query.py",
	},
	{
		flow: "query",
		node: "retrieve",
		edges: ["retrieve-store", "store-retrieve", "retrieve-gate"],
		title: "Semantic, causal retrieval",
		body: "The query is embedded and pgvector returns the nearest versions by cosine distance, scoped to the entity. Anything with an event time after 10:35 is dropped — the future can't leak into the past.",
		ref: "backend/app/rag/pipeline.py",
	},
	{
		flow: "query",
		node: "gate",
		edges: ["gate-tar"],
		title: "Dynamic gating sets the depth",
		body: "Urgency vs. historical cues (St) and retrieval confidence (Sr) combine into Sc = γ·St + (1−γ)(1−Sr), which selects a tier: K = 1, 3 or 5 with a matching weight α.",
		ref: "backend/app/rag/pipeline.py",
	},
	{
		flow: "query",
		node: "tar",
		edges: ["tar-evidence"],
		title: "Temporal-Aware Retrieval re-ranks",
		body: "Each candidate is scored α·similarity + (1−α)·e^(−λΔt), with λ = 0.02 per minute by default — semantic relevance and temporal proximity in one score.",
		ref: "backend/app/rag/pipeline.py",
	},
	{
		flow: "query",
		node: "evidence",
		edges: ["evidence-llm"],
		title: "Evidence is selected",
		body: "The top-K versions become the evidence set, each carrying its validity window, similarity, recency and TAR score.",
		ref: "backend/app/rag/pipeline.py",
	},
	{
		flow: "query",
		node: "llm",
		edges: ["llm-answer"],
		title: "A grounded answer is generated",
		body: "The prompt restricts the LLM (Groq) to the evidence and its validity windows. Without an API key, an evidence-only fallback answer is returned.",
		ref: "backend/app/llm.py",
	},
	{
		flow: "query",
		node: "answer",
		edges: [],
		title: "Answer, citations and diagnostics",
		body: "The response returns the answer, the cited versions with their scores and Δt, the query time used, and the gating diagnostics (St, Sr, Sc, tier).",
		ref: "backend/app/routers/query.py",
	},
];

export const flowRange = (flow) => {
	if (flow === "all") return [0, stages.length - 1];
	const first = stages.findIndex((stage) => stage.flow === flow);
	const last = stages.length - 1 - [...stages].reverse().findIndex((stage) => stage.flow === flow);
	return [first, last];
};

export const STAGE = {
	ingested: stages.findIndex((stage) => stage.node === "versioning"),
	embedded: stages.findIndex((stage) => stage.node === "embed"),
	ready: stages.findIndex((stage) => stage.node === "store"),
	retrieved: stages.findIndex((stage) => stage.node === "retrieve"),
	evidence: stages.findIndex((stage) => stage.node === "evidence"),
	answered: stages.findIndex((stage) => stage.node === "answer"),
};

export const REPO_URL = "https://github.com/Abhinav-Marlingaplar/StreamRAG";

const configuredGithubUrl = import.meta.env.VITE_GITHUB_URL;
export const githubUrl =
	configuredGithubUrl && !configuredGithubUrl.includes("your-org") ? configuredGithubUrl : REPO_URL;
export const appUrl = import.meta.env.VITE_APP_URL || "/login";
export const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL || "";

export const navSections = [
	{ id: "product", label: "Product" },
	{ id: "architecture", label: "Architecture" },
	{ id: "demo", label: "Demo" },
	{ id: "get-started", label: "Get started" },
];

// Mirrors simulator/demo_scenario.json (INC-1024). Minutes are offsets from 10:00 UTC.
export const scenario = {
	entity: "INC-1024",
	service: "checkout service",
	events: [
		{
			id: "evt-1024-01",
			type: "incident_created",
			time: "10:10",
			minute: 10,
			status: "investigating",
			detail: "Elevated API error rate detected for checkout service.",
		},
		{
			id: "evt-1024-02",
			type: "incident_updated",
			time: "10:30",
			minute: 30,
			status: "root_cause_identified",
			detail: "Root cause: database connection pool exhaustion.",
		},
		{
			id: "evt-1024-03",
			type: "incident_updated",
			time: "10:45",
			minute: 45,
			status: "mitigated",
			detail: "Increased pool size and restarted overloaded API pods.",
		},
		{
			id: "evt-1024-04",
			type: "incident_resolved",
			time: "11:00",
			minute: 60,
			status: "resolved",
			detail: "Pool settings tuned and alert thresholds adjusted.",
		},
	],
};

export const setupSteps = [
	{
		title: "Clone the repository",
		note: null,
		command: `git clone ${REPO_URL}.git\ncd StreamRAG`,
	},
	{
		title: "Start Kafka and PostgreSQL + pgvector",
		note: "Kafka on :9092 · PostgreSQL on :5432",
		command: "docker compose -f infrastructure/docker-compose.yml up -d",
	},
	{
		title: "Run the API",
		note: "Copy backend/.env.example to backend/.env first · API on :8000",
		command: "cd backend\npip install -r requirements.txt\nalembic upgrade head\nuvicorn app.main:app --reload",
	},
	{
		title: "Start the ingestion worker",
		note: "Consumes the operations-events topic",
		command: "cd backend\npython -m app.kafka.consumer",
	},
	{
		title: "Launch the app",
		note: "App on :5173",
		command: "cd frontend\nnpm install\nnpm run dev",
	},
	{
		title: "Stream demo events",
		note: "Or publish from the in-app Event Simulator",
		command: "cd simulator\npython producer.py",
	},
];

export const setupNote = "Run each step from the repository root in its own terminal.";

export const prerequisites = ["Python 3.11+", "Node.js 20+", "Docker Desktop"];

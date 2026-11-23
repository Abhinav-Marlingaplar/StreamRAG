import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const githubUrl = import.meta.env.VITE_GITHUB_URL || "https://github.com/your-org/streamrag";
const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL || "";

const featureCards = [
	{ title: "Real-time Kafka ingestion", text: "Consume incident events continuously and keep retrieval state live." },
	{ title: "Temporal versioning", text: "Store validity windows for every update, not just latest state." },
	{ title: "Historical retrieval", text: "Answer 'as-of' questions with deterministic timeline filtering." },
	{ title: "Semantic search", text: "pgvector retrieval narrows evidence before temporal validation." },
	{ title: "Evidence-grounded generation", text: "LLM synthesizes responses strictly from selected citations." },
	{ title: "Out-of-order safety", text: "Late events are inserted correctly without corrupting current truth." },
];

const setupCommands = [
	"docker compose -f infrastructure/docker-compose.yml up -d",
	"cd backend && pip install -r requirements.txt && alembic upgrade head",
	"cd backend && python -m app.kafka.consumer",
	"cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
	"cd frontend && npm install && npm run dev",
];

function SetupCommand({ command, index }) {
	const [copied, setCopied] = useState(false);

	const copyCommand = async () => {
		try {
			await navigator.clipboard.writeText(command);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {
			setCopied(false);
		}
	};

	return (
		<div className="setup-row">
			<div>
				<p className="caption">Step {index + 1}</p>
				<code>{command}</code>
			</div>
			<button
				className="btn btn-ghost"
				onClick={copyCommand}
				type="button"
			>
				{copied ? "Copied" : "Copy"}
			</button>
		</div>
	);
}

export default function Landing() {
	const pageRef = useRef(null);
	const year = useMemo(() => new Date().getFullYear(), []);

	useEffect(() => {
		const ctx = gsap.context(() => {
			gsap.from(".landing-animate-in", {
				opacity: 0,
				y: 18,
				duration: 0.7,
				stagger: 0.08,
				ease: "power2.out",
			});

			gsap.from(".reveal-up", {
				scrollTrigger: {
					trigger: ".reveal-root",
					start: "top 80%",
				},
				opacity: 0,
				y: 20,
				duration: 0.65,
				stagger: 0.07,
				ease: "power2.out",
			});
		}, pageRef);

		return () => ctx.revert();
	}, []);

	return (
		<div
			className="landing-page"
			ref={pageRef}
		>
			<header className="landing-nav">
				<div className="brand-lockup">
					<span className="brand-dot" />
					<div>
						<p className="brand-title">StreamRAG</p>
						<p className="brand-subtitle">Temporal RAG Infrastructure</p>
					</div>
				</div>
				<div className="landing-nav-links">
					<a href="#architecture">Architecture</a>
					<a href="#workflow">Workflow</a>
					<a href="#setup">Setup</a>
					<Link to="/login">Sign in</Link>
				</div>
			</header>

			<section className="hero-shell">
				<div className="hero-copy">
					<p className="chip landing-animate-in">Local-first runtime · public showcase</p>
					<h1 className="landing-animate-in">
						Real-time incident intelligence with <span>temporal certainty.</span>
					</h1>
					<p className="hero-lead landing-animate-in">
						StreamRAG solves the core failure of static RAG systems: changing truth over time. Ingest events from Kafka, version knowledge deterministically, and answer current and historical questions with evidence-backed citations.
					</p>
					<div className="hero-actions landing-animate-in">
						<a
							className="btn btn-primary"
							href={githubUrl}
							rel="noreferrer"
							target="_blank"
						>
							View GitHub
						</a>
						<a
							className="btn btn-ghost"
							href="#product-preview"
						>
							Explore Demo
						</a>
					</div>
				</div>
				<div className="hero-visual landing-animate-in">
					<div className="pipeline-node">Kafka Events</div>
					<div className="pipeline-arrow">→</div>
					<div className="pipeline-node">Temporal Processor</div>
					<div className="pipeline-arrow">→</div>
					<div className="pipeline-node">RAG Answer + Citations</div>
				</div>
			</section>

			<div className="section-divider" />

			<section className="section-grid reveal-root">
				<article className="panel reveal-up">
					<h2>Why static RAG breaks</h2>
					<p>
						Traditional RAG indexes snapshots. But incident truth changes minute-by-minute. A naive retrieval system often returns outdated information because it cannot reason about <strong>validity over time</strong>.
					</p>
				</article>
				<article className="panel reveal-up">
					<h2>How StreamRAG fixes it</h2>
					<p>
						Every update is versioned with <code>valid_from</code> and <code>valid_to</code>. Retrieval is semantically ranked, then temporally filtered before generation. The LLM never guesses temporal state.
					</p>
				</article>
			</section>

			<section className="feature-grid-large">
				{featureCards.map((feature) => (
					<article
						className="panel reveal-up"
						key={feature.title}
					>
						<h3>{feature.title}</h3>
						<p>{feature.text}</p>
					</article>
				))}
			</section>

			<section
				className="panel"
				id="architecture"
			>
				<h2>Architecture</h2>
				<div className="architecture-flow">
					<div>Simulator / Producers</div>
					<span>→</span>
					<div>Kafka Topic</div>
					<span>→</span>
					<div>FastAPI Worker</div>
					<span>→</span>
					<div>PostgreSQL + pgvector</div>
					<span>→</span>
					<div>Temporal Query + LLM</div>
				</div>
				<p className="muted">
					Local runtime only: frontend, backend, worker, Kafka, and PostgreSQL run on your machine. Public deployment is landing page only.
				</p>
			</section>

			<section
				className="panel"
				id="workflow"
			>
				<h2>Event-to-answer workflow</h2>
				<ol className="workflow-list">
					<li>Ingest event with event-time and payload.</li>
					<li>Apply idempotency and temporal version insertion.</li>
					<li>Store embedding for semantic candidate retrieval.</li>
					<li>Run query embedding and vector search.</li>
					<li>Apply deterministic temporal validity rule.</li>
					<li>Generate answer from valid evidence only.</li>
				</ol>
			</section>

			<section
				className="panel"
				id="product-preview"
			>
				<h2>Product preview</h2>
				<div className="preview-grid">
					<div className="preview-card">Dashboard + monitoring</div>
					<div className="preview-card">Query chat + citations</div>
					<div className="preview-card">Live events + filters</div>
					<div className="preview-card">Timeline + validity windows</div>
					<div className="preview-card">Simulator controls</div>
					<div className="preview-card">Status + latency metrics</div>
				</div>
			</section>

			<section className="panel">
				<h2>Demo video</h2>
				{demoVideoUrl ? (
					<div className="video-frame">
						<iframe
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
							src={demoVideoUrl}
							title="StreamRAG demo video"
						/>
					</div>
				) : (
					<div className="video-placeholder">
						<p>Demo video placeholder</p>
						<p className="muted">
							Set <code>VITE_DEMO_VIDEO_URL</code> to embed your final walkthrough.
						</p>
					</div>
				)}
			</section>

			<section
				className="panel"
				id="setup"
			>
				<h2>Run locally in minutes</h2>
				<div className="setup-list">
					{setupCommands.map((command, index) => (
						<SetupCommand
							command={command}
							index={index}
							key={command}
						/>
					))}
				</div>
			</section>

			<section className="section-grid">
				<article className="panel">
					<h2>Technical details</h2>
					<p>
						StreamRAG enforces temporal correctness with validity windows, semantic candidate retrieval with pgvector, and citations that map to concrete knowledge versions.
					</p>
				</article>
				<article className="panel">
					<h2>Open project</h2>
					<p>Clone, run locally, and inspect every layer from ingestion to RAG response.</p>
					<a
						className="btn btn-primary"
						href={githubUrl}
						rel="noreferrer"
						target="_blank"
					>
						Open GitHub
					</a>
				</article>
			</section>

			<footer className="landing-footer">
				<div>
					<p className="brand-title">StreamRAG</p>
					<p className="muted">Real-time temporal RAG for incident knowledge.</p>
				</div>
				<div className="footer-links">
					<a href={githubUrl}>GitHub</a>
					<a href="#architecture">Architecture</a>
					<a href="#setup">Setup</a>
				</div>
				<p className="muted">© {year} StreamRAG</p>
			</footer>
		</div>
	);
}

import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const githubUrl = import.meta.env.VITE_GITHUB_URL || "https://github.com/your-org/streamrag";
const demoVideoUrl = import.meta.env.VITE_DEMO_VIDEO_URL || "";

const setupCommands = [
	"docker compose -f infrastructure/docker-compose.yml up -d",
	"cd backend && pip install -r requirements.txt && alembic upgrade head",
	"cd backend && python -m app.kafka.consumer",
	"cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
	"cd frontend && npm install && npm run dev",
];

export default function Landing() {
	const rootRef = useRef(null);
	const year = useMemo(() => new Date().getFullYear(), []);

	useEffect(() => {
		const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (prefersReduced) {
			return undefined;
		}
		const ctx = gsap.context(() => {
			gsap.from(".hero-reveal", {
				y: 18,
				opacity: 0,
				duration: 0.6,
				stagger: 0.08,
				ease: "power2.out",
			});
			gsap.utils.toArray(".scroll-reveal").forEach((item) => {
				gsap.from(item, {
					y: 20,
					opacity: 0,
					duration: 0.55,
					ease: "power2.out",
					scrollTrigger: {
						trigger: item,
						start: "top 84%",
					},
				});
			});
		}, rootRef);
		return () => ctx.revert();
	}, []);

	return (
		<div
			className="landing-root"
			ref={rootRef}
		>
			<header className="landing-topbar">
				<div className="brand-lockup">
					<span className="brand-dot" />
					<div>
						<p className="brand-title">StreamRAG</p>
						<p className="brand-subtitle">Temporal Incident Intelligence</p>
					</div>
				</div>
				<nav className="landing-links">
					<a href="#capabilities">Capabilities</a>
					<a href="#architecture">Architecture</a>
					<a href="#setup">Setup</a>
					<Link to="/login">App login</Link>
				</nav>
			</header>

			<section className="landing-hero">
				<div className="hero-copy">
					<p className="chip hero-reveal">Real-time temporal retrieval for live operations</p>
					<h1 className="hero-reveal">Ask what is true now — and what was true before.</h1>
					<p className="hero-reveal">
						StreamRAG ingests operational events from Kafka, preserves temporal truth in PostgreSQL, and answers
						questions with TAR-ranked evidence and citations.
					</p>
					<div className="hero-actions hero-reveal">
						<a
							className="btn btn-primary"
							href={githubUrl}
							rel="noreferrer"
							target="_blank"
						>
							View GitHub
						</a>
						<Link
							className="btn btn-ghost"
							to="/login"
						>
							Open app
						</Link>
					</div>
				</div>
				<div className="hero-visual hero-reveal">
					<div className="pipeline-rail">
						<div>CSV / Simulator</div>
						<span>→</span>
						<div>Kafka</div>
						<span>→</span>
						<div>Consumer</div>
						<span>→</span>
						<div>Temporal Store + pgvector</div>
						<span>→</span>
						<div>TAR Query Engine</div>
					</div>
				</div>
			</section>

			<section className="editorial-block scroll-reveal">
				<div>
					<h2>Why this matters</h2>
					<p>
						Operations truth evolves constantly. Static RAG returns stale answers when incidents change quickly.
						StreamRAG keeps timeline-aware versions and uses temporal-aware retrieval to choose evidence relevant to
						query time.
					</p>
				</div>
				<div>
					<h2>How StreamRAG works</h2>
					<p>
						Events are ingested one-by-one, versioned with validity windows, embedded, and retrieved with adaptive
						TAR scoring that blends semantic relevance and recency decay.
					</p>
				</div>
			</section>

			<section
				className="capability-layout scroll-reveal"
				id="capabilities"
			>
				<h2>Core capabilities</h2>
				<div className="capability-rows">
					<p>Real-time Kafka ingestion with idempotent processing</p>
					<p>Temporal versioning with historical as-of query support</p>
					<p>Adaptive TAR retrieval tiers and transparent evidence scoring</p>
					<p>Incident timeline inspection and citation-grounded responses</p>
					<p>CSV-based simulator for deterministic demo playback</p>
				</div>
			</section>

			<section
				className="architecture-band scroll-reveal"
				id="architecture"
			>
				<h2>Technical architecture</h2>
				<p>React + Vite frontend, FastAPI APIs, aiokafka worker, PostgreSQL + pgvector, and Groq-backed LLM generation.</p>
				<ol>
					<li>Publish operational events into Kafka topic `operations-events`.</li>
					<li>Validate, version, embed, and index through the consumer pipeline.</li>
					<li>Run temporal-aware retrieval and answer generation with citations.</li>
				</ol>
			</section>

			<section className="preview-layout scroll-reveal">
				<h2>Product preview</h2>
				<p>Overview tracks live ingestion, Intelligence unifies querying + timelines, Event Simulator drives deterministic demo streams.</p>
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
						<p className="caption">
							Set <code>VITE_DEMO_VIDEO_URL</code> to embed your walkthrough.
						</p>
					</div>
				)}
			</section>

			<section
				className="setup-layout scroll-reveal"
				id="setup"
			>
				<h2>Run locally</h2>
				<div className="setup-list">
					{setupCommands.map((command, index) => (
						<div
							className="setup-line"
							key={command}
						>
							<span className="caption">Step {index + 1}</span>
							<code>{command}</code>
						</div>
					))}
				</div>
			</section>

			<footer className="landing-footer">
				<div>
					<p className="brand-title">StreamRAG</p>
					<p className="muted">Local-first temporal RAG for operational incidents.</p>
				</div>
				<div className="row">
					<a
						href={githubUrl}
						rel="noreferrer"
						target="_blank"
					>
						GitHub
					</a>
					<Link to="/login">Open app</Link>
				</div>
				<p className="caption">© {year} StreamRAG</p>
			</footer>
		</div>
	);
}
